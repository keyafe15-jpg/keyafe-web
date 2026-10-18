import { Prisma } from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { normalizeCustomerPhone, phoneLookupVariants } from "../../lib/phone.js";

type DbClient = PrismaTypes.TransactionClient | typeof prisma;

let cachedCustomerRoleId: string | null = null;

export async function ensureCustomerRole(db: DbClient = prisma) {
  const role = await db.role.upsert({
    where: { slug: "customer" },
    update: {},
    create: {
      slug: "customer",
      name: "Customer",
      description: "Customer role",
      isSystem: true,
      isSuperuser: false,
    },
  });
  cachedCustomerRoleId = role.id;
  return role;
}

async function getCustomerRoleId(db: DbClient): Promise<string> {
  if (cachedCustomerRoleId) return cachedCustomerRoleId;
  const role = await ensureCustomerRole(db);
  return role.id;
}

async function findCustomerByPhone(db: DbClient, phone: string) {
  for (const variant of phoneLookupVariants(phone)) {
    const user = await db.user.findUnique({ where: { phone: variant } });
    if (user) return user;
  }
  return null;
}

/**
 * A real account someone signs in to: OTP-verified, or protected by a password.
 * Anything else is a guest profile created at checkout.
 */
export function isRegisteredAccount(user: {
  phoneVerifiedAt: Date | null;
  passwordHash: string | null;
}): boolean {
  return user.phoneVerifiedAt != null || user.passwordHash != null;
}

/**
 * Resolve a customer id for an order.
 *
 * - Logged-in checkout (`userId`) always links to that account.
 * - Guest checkout does NOT attach to a registered account (see isRegisteredAccount)
 *   even when phone/email match — the order keeps its own name/address snapshot.
 * - True guest profiles (no OTP yet) are created/updated and linked.
 *
 * Pass `allowRegisteredLink: true` for admin-placed orders where linking is intended.
 */
export async function ensureCustomerForOrder(
  db: DbClient,
  input: {
    userId?: string | null;
    name: string;
    phone: string;
    email?: string | null;
    allowRegisteredLink?: boolean;
  },
): Promise<string | null> {
  const phone = normalizeCustomerPhone(input.phone);
  const email = input.email?.trim() || null;
  const name = input.name.trim();
  const allowRegisteredLink = input.allowRegisteredLink ?? false;

  if (input.userId) {
    const linked = await db.user.findUnique({ where: { id: input.userId } });
    if (linked) {
      if (!isRegisteredAccount(linked)) {
        await db.user.update({
          where: { id: linked.id },
          data: {
            name,
            ...(email && !linked.email ? { email } : {}),
          },
        });
      }
      return linked.id;
    }
  }

  const existing =
    (await findCustomerByPhone(db, input.phone)) ??
    (email ? await db.user.findUnique({ where: { email } }) : null);

  if (existing) {
    const isRegistered = isRegisteredAccount(existing);
    if (isRegistered && !allowRegisteredLink) {
      return null;
    }
    if (!isRegistered) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          name,
          ...(email && !existing.email ? { email } : {}),
        },
      });
    }
    return existing.id;
  }

  const roleId = await getCustomerRoleId(db);
  try {
    const created = await db.user.create({
      data: {
        name,
        phone,
        email,
        roleId,
      },
    });
    return created.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const retry =
        (await findCustomerByPhone(db, input.phone)) ??
        (email ? await db.user.findUnique({ where: { email } }) : null);
      if (retry) {
        if (isRegisteredAccount(retry) && !allowRegisteredLink) return null;
        return retry.id;
      }
    }
    throw err;
  }
}

function buildAdminCustomerSearchWhere(search?: string) {
  const q = search?.trim();
  if (!q) return {};
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" as const } },
    ],
  };
}

function contactOrderWhere(user: {
  id: string;
  phone: string;
  email: string | null;
}): Prisma.OrderWhereInput {
  const phoneVariants = phoneLookupVariants(user.phone);
  const or: Prisma.OrderWhereInput[] = [
    { userId: user.id },
    { customerPhone: { in: phoneVariants } },
  ];
  if (user.email) {
    or.push({ customerEmail: { equals: user.email, mode: "insensitive" } });
  }
  return { OR: or };
}

async function aggregateContactStats(user: {
  id: string;
  phone: string;
  email: string | null;
  name: string;
}) {
  const orders = await prisma.order.findMany({
    where: contactOrderWhere(user),
    select: {
      id: true,
      userId: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      total: true,
    },
  });

  const names = new Set<string>();
  const phones = new Set<string>();
  const emails = new Set<string>();
  let linkedOrderCount = 0;
  let guestCheckoutCount = 0;
  let totalSpent = 0;

  for (const order of orders) {
    names.add(order.customerName);
    phones.add(normalizeCustomerPhone(order.customerPhone));
    if (order.customerEmail) emails.add(order.customerEmail.toLowerCase());
    if (order.userId === user.id) linkedOrderCount += 1;
    else guestCheckoutCount += 1;
    totalSpent += Number(order.total);
  }

  names.add(user.name);
  phones.add(normalizeCustomerPhone(user.phone));
  if (user.email) emails.add(user.email.toLowerCase());

  const nameVariants = [...names].filter((n) => n !== user.name);
  const emailVariants = [...emails].filter((e) => !user.email || e !== user.email.toLowerCase());
  const phoneVariants = [...phones].filter((p) => p !== normalizeCustomerPhone(user.phone));

  return {
    totalOrderCount: orders.length,
    linkedOrderCount,
    guestCheckoutCount,
    totalSpent,
    nameVariants,
    emailVariants,
    phoneVariants,
    hasMixedContactInfo:
      nameVariants.length > 0 ||
      emailVariants.length > 0 ||
      phoneVariants.length > 0 ||
      guestCheckoutCount > 0,
  };
}

async function loadCustomerPhoneVariantSet() {
  const users = await prisma.user.findMany({
    where: { role: { slug: "customer" } },
    select: { phone: true },
  });
  const set = new Set<string>();
  for (const u of users) {
    for (const v of phoneLookupVariants(u.phone)) {
      set.add(v);
      set.add(normalizeCustomerPhone(v));
    }
  }
  return set;
}

function mapCustomerListItem(row: {
  id: string;
  userId: string | null;
  name: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  isRegistered: boolean;
  phoneVerifiedAt: Date | null;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date | string;
  isOrderOnly: boolean;
  linkedOrderCount: number;
  totalOrderCount: number;
  guestCheckoutCount: number;
  totalSpent: number;
  nameVariants: string[];
  emailVariants: string[];
  phoneVariants: string[];
  hasMixedContactInfo: boolean;
}) {
  return {
    ...row,
    phoneVerifiedAt: row.phoneVerifiedAt?.toISOString() ?? null,
    emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

async function listOrderOnlyContacts(
  search?: string,
  limit = 50,
  knownPhoneVariants?: Set<string>,
) {
  const known = knownPhoneVariants ?? (await loadCustomerPhoneVariantSet());

  const orders = await prisma.order.findMany({
    where: { userId: null },
    select: {
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      createdAt: true,
      total: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const q = search?.trim().toLowerCase();
  const groups = new Map<
    string,
    {
      canonicalPhone: string;
      names: Set<string>;
      emails: Set<string>;
      orderCount: number;
      totalSpent: number;
      lastOrderAt: Date;
    }
  >();

  for (const order of orders) {
    const canonical = normalizeCustomerPhone(order.customerPhone);
    const matchesUser = phoneLookupVariants(order.customerPhone).some(
      (v) => known.has(v) || known.has(normalizeCustomerPhone(v)),
    );
    if (matchesUser) continue;

    if (q) {
      const hay = [order.customerName, order.customerPhone, order.customerEmail ?? ""]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) continue;
    }

    const existing = groups.get(canonical);
    if (!existing) {
      groups.set(canonical, {
        canonicalPhone: canonical,
        names: new Set([order.customerName]),
        emails: new Set(order.customerEmail ? [order.customerEmail] : []),
        orderCount: 1,
        totalSpent: Number(order.total),
        lastOrderAt: order.createdAt,
      });
      continue;
    }
    existing.names.add(order.customerName);
    if (order.customerEmail) existing.emails.add(order.customerEmail);
    existing.orderCount += 1;
    existing.totalSpent += Number(order.total);
    if (order.createdAt > existing.lastOrderAt) {
      existing.lastOrderAt = order.createdAt;
    }
  }

  return [...groups.values()]
    .sort((a, b) => b.lastOrderAt.getTime() - a.lastOrderAt.getTime())
    .slice(0, limit)
    .map((g) => {
      const names = [...g.names];
      const emails = [...g.emails];
      return mapCustomerListItem({
        id: `contact-${g.canonicalPhone}`,
        userId: null,
        name: names[0] ?? g.canonicalPhone,
        phone: g.canonicalPhone,
        email: emails[0] ?? null,
        isActive: true,
        isRegistered: false,
        phoneVerifiedAt: null,
        emailVerifiedAt: null,
        lastLoginAt: null,
        createdAt: g.lastOrderAt,
        linkedOrderCount: 0,
        totalOrderCount: g.orderCount,
        guestCheckoutCount: g.orderCount,
        totalSpent: g.totalSpent,
        nameVariants: names.slice(1),
        emailVariants: emails.slice(1),
        phoneVariants: [],
        hasMixedContactInfo: names.length > 1 || emails.length > 1 || g.orderCount > 0,
        isOrderOnly: true,
      });
    });
}

export async function listCustomers(
  page = 1,
  pageSize = 20,
  search?: string,
  active?: boolean | null,
  registered?: boolean | null,
) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
  const skip = (safePage - 1) * safePageSize;

  const where = {
    role: { slug: "customer" },
    ...buildAdminCustomerSearchWhere(search),
    ...(active !== null && active !== undefined ? { isActive: active } : {}),
    ...(registered === true
      ? { AND: [{ OR: [{ phoneVerifiedAt: { not: null } }, { passwordHash: { not: null } }] }] }
      : {}),
    ...(registered === false ? { phoneVerifiedAt: null, passwordHash: null } : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: safePageSize,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isActive: true,
        phoneVerifiedAt: true,
        passwordHash: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
  ]);

  const userItems = await Promise.all(
    users.map(async (u) => {
      const stats = await aggregateContactStats(u);
      return mapCustomerListItem({
        id: u.id,
        userId: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        isActive: u.isActive,
        isRegistered: isRegisteredAccount(u),
        phoneVerifiedAt: u.phoneVerifiedAt,
        emailVerifiedAt: u.emailVerifiedAt,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        isOrderOnly: false,
        ...stats,
      });
    }),
  );

  let combinedTotal = total;
  let items = userItems;

  // Append order-only contacts (no user row) on page 1 when not filtering registered-only.
  if (registered !== true && safePage === 1) {
    const orderOnly = await listOrderOnlyContacts(search, 50);
    items = [...userItems, ...orderOnly];
    combinedTotal = total + orderOnly.length;
  }

  const totalPages = Math.max(1, Math.ceil(combinedTotal / safePageSize));

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    total: combinedTotal,
    totalPages,
  };
}

const ORDER_DETAIL_SELECT = {
  id: true,
  orderNumber: true,
  userId: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  fulfillment: true,
  deliveryAddress: true,
  subtotal: true,
  deliveryFee: true,
  total: true,
  status: true,
  paymentStatus: true,
  source: true,
  createdAt: true,
  _count: { select: { items: true } },
} as const;

export async function getCustomerDetail(key: string) {
  if (key.startsWith("contact-")) {
    const phone = key.slice("contact-".length);
    const canonical = normalizeCustomerPhone(phone);
    const phoneVariants = phoneLookupVariants(canonical);

    const orders = await prisma.order.findMany({
      where: {
        userId: null,
        customerPhone: { in: phoneVariants },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: ORDER_DETAIL_SELECT,
    });

    if (orders.length === 0) {
      throw HttpError.notFound("Customer contact not found");
    }

    const names = new Set(orders.map((o) => o.customerName));
    const emails = new Set(orders.map((o) => o.customerEmail).filter(Boolean) as string[]);
    const phones = new Set(orders.map((o) => normalizeCustomerPhone(o.customerPhone)));

    const totalSpent = orders.reduce((s, o) => s + Number(o.total), 0);

    return {
      id: `contact-${canonical}`,
      userId: null,
      profile: null,
      isOrderOnly: true,
      contactVariants: {
        names: [...names],
        emails: [...emails],
        phones: [...phones],
      },
      addresses: [],
      stats: {
        totalOrders: orders.length,
        linkedOrders: 0,
        guestCheckoutOrders: orders.length,
        totalSpent,
      },
      orders: orders.map(formatCustomerOrderRow),
    };
  }

  const user = await prisma.user.findFirst({
    where: { id: key, role: { slug: "customer" } },
    include: {
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!user) throw HttpError.notFound("Customer not found");

  const stats = await aggregateContactStats(user);
  const orders = await prisma.order.findMany({
    where: contactOrderWhere(user),
    orderBy: { createdAt: "desc" },
    take: 50,
    select: ORDER_DETAIL_SELECT,
  });

  return {
    id: user.id,
    userId: user.id,
    profile: {
      name: user.name,
      phone: user.phone,
      email: user.email,
      isActive: user.isActive,
      isRegistered: isRegisteredAccount(user),
      phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    },
    isOrderOnly: false,
    contactVariants: {
      names: [user.name, ...stats.nameVariants],
      emails: [...(user.email ? [user.email] : []), ...stats.emailVariants],
      phones: [normalizeCustomerPhone(user.phone), ...stats.phoneVariants],
    },
    addresses: user.addresses.map((a) => ({
      id: a.id,
      label: a.label,
      recipientName: a.recipientName,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2,
      landmark: a.landmark,
      mapSearchQuery: a.mapSearchQuery,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      isDefault: a.isDefault,
    })),
    stats: {
      totalOrders: stats.totalOrderCount,
      linkedOrders: stats.linkedOrderCount,
      guestCheckoutOrders: stats.guestCheckoutCount,
      totalSpent: stats.totalSpent,
    },
    orders: orders.map(formatCustomerOrderRow),
  };
}

function formatCustomerOrderRow(o: Prisma.OrderGetPayload<{ select: typeof ORDER_DETAIL_SELECT }>) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    userId: o.userId,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    fulfillment: o.fulfillment,
    deliveryAddress: o.deliveryAddress,
    subtotal: o.subtotal.toString(),
    deliveryFee: o.deliveryFee.toString(),
    total: o.total.toString(),
    status: o.status,
    paymentStatus: o.paymentStatus,
    source: o.source,
    createdAt: o.createdAt.toISOString(),
    itemCount: o._count.items,
    isGuestCheckout: o.userId == null,
  };
}

const LOOKUP_LIMIT = 8;

export interface OrderCustomerLookupAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  mapSearchQuery: string;
  city: string;
  state: string;
  pincode: string;
  /** Last non-cancelled delivery charge for this line1 + pincode, if any. */
  deliveryFee: number | null;
  deliveryPaidToRider: boolean | null;
}

export interface OrderCustomerLookupHit {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  companyName: string | null;
  gstin: string | null;
  lastDeliveryFee: number | null;
  lastDeliveryPaidToRider: boolean | null;
  addresses: OrderCustomerLookupAddress[];
}

function isLookupQuery(q: string): boolean {
  const query = q.trim();
  const digits = query.replace(/\D/g, "");
  return query.length >= 3 || digits.length >= 6;
}

function asDeliveryAddress(value: unknown): {
  line1: string;
  line2: string | null;
  landmark: string | null;
  mapSearchQuery: string;
  city: string;
  state: string;
  pincode: string;
} | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Record<string, unknown>;
  const line1 = typeof a.line1 === "string" ? a.line1.trim() : "";
  const pincode = typeof a.pincode === "string" ? a.pincode.trim() : "";
  if (line1.length < 3 || !/^\d{6}$/.test(pincode)) return null;
  return {
    line1,
    line2: typeof a.line2 === "string" && a.line2.trim() ? a.line2.trim() : null,
    landmark: typeof a.landmark === "string" && a.landmark.trim() ? a.landmark.trim() : null,
    mapSearchQuery:
      typeof a.mapSearchQuery === "string" && a.mapSearchQuery.trim()
        ? a.mapSearchQuery.trim()
        : line1,
    city: typeof a.city === "string" ? a.city.trim() : "",
    state: typeof a.state === "string" ? a.state.trim() : "",
    pincode,
  };
}

/**
 * Compact search for admin order forms: name/phone matches plus last GSTIN
 * and saved / last-delivery addresses. Does not write anything.
 */
export async function lookupCustomersForOrder(q: string): Promise<OrderCustomerLookupHit[]> {
  const query = q.trim();
  if (!isLookupQuery(query)) return [];

  const digits = query.replace(/\D/g, "");
  const orUser: Prisma.UserWhereInput[] = [];
  const orOrder: Prisma.OrderWhereInput[] = [];
  if (query.length >= 3) {
    orUser.push(
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
    );
    orOrder.push({ customerName: { contains: query, mode: "insensitive" } });
  }
  if (digits.length >= 3) {
    orUser.push({ phone: { contains: digits } });
    orOrder.push({ customerPhone: { contains: digits } });
  }

  if (orUser.length === 0) return [];

  const [users, orderHits] = await Promise.all([
    prisma.user.findMany({
      where: { role: { slug: "customer" }, OR: orUser },
      take: LOOKUP_LIMIT,
      orderBy: { updatedAt: "desc" },
      include: { addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] } },
    }),
    prisma.order.findMany({
      where: { OR: orOrder },
      take: 40,
      orderBy: { createdAt: "desc" },
      select: {
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        customerCompanyName: true,
        customerGstin: true,
        recipientName: true,
        deliveryPhone: true,
        deliveryAddress: true,
        fulfillment: true,
        status: true,
        deliveryFee: true,
        deliveryPaidToRider: true,
        createdAt: true,
      },
    }),
  ]);

  type Draft = {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    companyName: string | null;
    gstin: string | null;
    lastDeliveryFee: number | null;
    lastDeliveryPaidToRider: boolean | null;
    addresses: OrderCustomerLookupAddress[];
    seenAddr: Set<string>;
  };

  const byPhone = new Map<string, Draft>();

  const ensure = (phoneRaw: string, name: string, email: string | null, id?: string): Draft => {
    const phone = normalizeCustomerPhone(phoneRaw);
    const existing = byPhone.get(phone);
    if (existing) {
      if (!existing.email && email) existing.email = email;
      if (existing.name.length < 2 && name.trim().length >= 2) existing.name = name.trim();
      return existing;
    }
    const draft: Draft = {
      id: id ?? `contact-${phone}`,
      name: name.trim() || phone,
      phone,
      email: email?.trim() || null,
      companyName: null,
      gstin: null,
      lastDeliveryFee: null,
      lastDeliveryPaidToRider: null,
      addresses: [],
      seenAddr: new Set(),
    };
    byPhone.set(phone, draft);
    return draft;
  };

  const pushAddress = (draft: Draft, addr: OrderCustomerLookupAddress) => {
    const key = `${addr.pincode}|${addr.line1.toLowerCase()}`;
    if (draft.seenAddr.has(key)) return;
    draft.seenAddr.add(key);
    draft.addresses.push(addr);
  };

  for (const user of users) {
    const draft = ensure(user.phone, user.name, user.email, user.id);
    draft.id = user.id;
    draft.name = user.name;
    draft.phone = normalizeCustomerPhone(user.phone);
    draft.email = user.email;
    for (const a of user.addresses) {
      pushAddress(draft, {
        id: a.id,
        label: a.label?.trim() || (a.isDefault ? "Default" : "Saved"),
        recipientName: a.recipientName,
        phone: a.phone,
        line1: a.line1,
        line2: a.line2,
        landmark: a.landmark,
        mapSearchQuery: a.mapSearchQuery,
        city: a.city,
        state: a.state,
        pincode: a.pincode,
        deliveryFee: null,
        deliveryPaidToRider: null,
      });
    }
  }

  for (const order of orderHits) {
    const draft = ensure(order.customerPhone, order.customerName, order.customerEmail);
    if (!draft.gstin && order.customerGstin) {
      draft.gstin = order.customerGstin;
      draft.companyName = order.customerCompanyName;
    }
    const qualifies = order.fulfillment === "DELIVERY" && order.status !== "CANCELLED";
    if (!qualifies) continue;

    const fee = Number(order.deliveryFee);
    if (draft.lastDeliveryFee == null) {
      draft.lastDeliveryFee = fee;
      draft.lastDeliveryPaidToRider = order.deliveryPaidToRider;
    }

    const parsed = asDeliveryAddress(order.deliveryAddress);
    if (!parsed) continue;

    const key = `${parsed.pincode}|${parsed.line1.toLowerCase()}`;
    if (draft.seenAddr.has(key)) {
      const existing = draft.addresses.find(
        (a) => `${a.pincode}|${a.line1.toLowerCase()}` === key,
      );
      if (existing && existing.deliveryFee == null) {
        existing.deliveryFee = fee;
        existing.deliveryPaidToRider = order.deliveryPaidToRider;
      }
      continue;
    }

    pushAddress(draft, {
      id: `last-${draft.phone}-${parsed.pincode}-${draft.addresses.length}`,
      label: "Last delivery",
      recipientName: order.recipientName?.trim() || draft.name,
      phone: order.deliveryPhone?.trim() || draft.phone,
      ...parsed,
      deliveryFee: fee,
      deliveryPaidToRider: order.deliveryPaidToRider,
    });
  }

  const ranked = [...byPhone.values()];
  const qLower = query.toLowerCase();
  ranked.sort((a, b) => {
    const aPhone = a.phone.startsWith(digits) || a.phone.includes(digits) ? 0 : 1;
    const bPhone = b.phone.startsWith(digits) || b.phone.includes(digits) ? 0 : 1;
    if (digits.length >= 6 && aPhone !== bPhone) return aPhone - bPhone;
    const aName = a.name.toLowerCase().startsWith(qLower) ? 0 : 1;
    const bName = b.name.toLowerCase().startsWith(qLower) ? 0 : 1;
    if (aName !== bName) return aName - bName;
    return a.name.localeCompare(b.name);
  });

  const top = ranked.slice(0, LOOKUP_LIMIT);
  const needingGst = top.filter((h) => !h.gstin);
  if (needingGst.length > 0) {
    const variants = needingGst.flatMap((h) => phoneLookupVariants(h.phone));
    const gstOrders = await prisma.order.findMany({
      where: { customerPhone: { in: variants }, customerGstin: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { customerPhone: true, customerGstin: true, customerCompanyName: true },
    });
    for (const order of gstOrders) {
      const draft = byPhone.get(normalizeCustomerPhone(order.customerPhone));
      if (draft && !draft.gstin && order.customerGstin) {
        draft.gstin = order.customerGstin;
        draft.companyName = order.customerCompanyName;
      }
    }
  }

  return top.map(({ seenAddr: _seen, ...hit }) => hit);
}

/** One-off: link historical guest orders to customer rows. */
export async function backfillGuestCustomersFromOrders() {
  const orders = await prisma.order.findMany({
    where: { userId: null },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let linked = 0;
  for (const order of orders) {
    const userId = await ensureCustomerForOrder(prisma, {
      name: order.customerName,
      phone: order.customerPhone,
      email: order.customerEmail,
      allowRegisteredLink: false,
    });
    if (!userId) continue;
    await prisma.order.update({
      where: { id: order.id },
      data: { userId },
    });
    linked += 1;
  }
  return { ordersProcessed: linked };
}
