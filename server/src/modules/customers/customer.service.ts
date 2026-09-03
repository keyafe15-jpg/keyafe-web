import { Prisma } from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import {
  normalizeCustomerPhone,
  phoneLookupVariants,
} from "../../lib/phone.js";

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
 * Resolve a customer id for an order.
 *
 * - Logged-in checkout (`userId`) always links to that account.
 * - Guest checkout does NOT attach to a registered account (phoneVerifiedAt set)
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
      if (!linked.phoneVerifiedAt) {
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
    const isRegistered = existing.phoneVerifiedAt != null;
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
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const retry =
        (await findCustomerByPhone(db, input.phone)) ??
        (email ? await db.user.findUnique({ where: { email } }) : null);
      if (retry) {
        if (retry.phoneVerifiedAt && !allowRegisteredLink) return null;
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

function contactOrderWhere(
  user: { id: string; phone: string; email: string | null },
): Prisma.OrderWhereInput {
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

async function aggregateContactStats(
  user: {
    id: string;
    phone: string;
    email: string | null;
    name: string;
  },
) {
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
  const emailVariants = [...emails].filter(
    (e) => !user.email || e !== user.email.toLowerCase(),
  );
  const phoneVariants = [...phones].filter(
    (p) => p !== normalizeCustomerPhone(user.phone),
  );

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
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : row.createdAt,
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
      const hay = [
        order.customerName,
        order.customerPhone,
        order.customerEmail ?? "",
      ]
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
        hasMixedContactInfo:
          names.length > 1 || emails.length > 1 || g.orderCount > 0,
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
    ...(registered === true ? { phoneVerifiedAt: { not: null } } : {}),
    ...(registered === false ? { phoneVerifiedAt: null } : {}),
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
        isRegistered: u.phoneVerifiedAt != null,
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
    const emails = new Set(
      orders.map((o) => o.customerEmail).filter(Boolean) as string[],
    );
    const phones = new Set(
      orders.map((o) => normalizeCustomerPhone(o.customerPhone)),
    );

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
      isRegistered: user.phoneVerifiedAt != null,
      phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    },
    isOrderOnly: false,
    contactVariants: {
      names: [user.name, ...stats.nameVariants],
      emails: [
        ...(user.email ? [user.email] : []),
        ...stats.emailVariants,
      ],
      phones: [
        normalizeCustomerPhone(user.phone),
        ...stats.phoneVariants,
      ],
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

function formatCustomerOrderRow(
  o: Prisma.OrderGetPayload<{ select: typeof ORDER_DETAIL_SELECT }>,
) {
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
