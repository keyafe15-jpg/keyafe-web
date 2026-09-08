import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { normalizeCustomerPhone, phoneLookupVariants } from "../../lib/phone.js";
import { CUSTOMER_ROLE_SLUG } from "./rbac.catalog.js";
import { syncPermissionCatalog } from "./rbac.seed.js";

async function findUserByPhone(phone: string) {
  for (const variant of phoneLookupVariants(phone)) {
    const user = await prisma.user.findUnique({ where: { phone: variant } });
    if (user) return user;
  }
  return null;
}

function serializeStaffUser(user: {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  role: { id: string; slug: string; name: string; isSuperuser: boolean };
}) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    role: user.role,
  };
}

export async function listStaffUsers(opts: {
  page?: number;
  pageSize?: number;
  search?: string | null;
  roleId?: string | null;
  active?: boolean | null;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const search = opts.search?.trim();

  const where: Prisma.UserWhereInput = {
    role: { slug: { not: CUSTOMER_ROLE_SLUG } },
    ...(opts.roleId ? { roleId: opts.roleId } : {}),
    ...(opts.active === true ? { isActive: true } : {}),
    ...(opts.active === false ? { isActive: false } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        role: {
          select: { id: true, slug: true, name: true, isSuperuser: true },
        },
      },
    }),
  ]);

  return {
    items: users.map(serializeStaffUser),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function assertStaffRole(roleId: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw HttpError.badRequest("Role not found");
  if (role.slug === CUSTOMER_ROLE_SLUG) {
    throw HttpError.badRequest("Cannot assign the customer role to staff");
  }
  return role;
}

async function countActiveSuperusers(excludeUserId?: string) {
  return prisma.user.count({
    where: {
      isActive: true,
      role: { isSuperuser: true },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

export async function createStaffUser(input: {
  name: string;
  phone: string;
  email?: string | null;
  roleId: string;
  promote?: boolean;
}) {
  const role = await assertStaffRole(input.roleId);
  const phone = normalizeCustomerPhone(input.phone);
  const email = input.email?.trim() || null;
  const existing = await findUserByPhone(phone);

  if (existing) {
    const existingRole = await prisma.role.findUnique({
      where: { id: existing.roleId },
    });
    const isCustomer = existingRole?.slug === CUSTOMER_ROLE_SLUG;
    if (!isCustomer) {
      throw HttpError.conflict("A staff account with this phone already exists");
    }
    if (!input.promote) {
      throw HttpError.conflict(
        "A customer account exists with this phone. Confirm to promote them to staff.",
      );
    }
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: input.name.trim(),
        phone,
        roleId: role.id,
        isActive: true,
        phoneVerifiedAt: existing.phoneVerifiedAt ?? new Date(),
        ...(email && !existing.email ? { email } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        role: {
          select: { id: true, slug: true, name: true, isSuperuser: true },
        },
      },
    });
    return serializeStaffUser(updated);
  }

  if (email) {
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) {
      throw HttpError.conflict("An account with this email already exists");
    }
  }

  try {
    const created = await prisma.user.create({
      data: {
        name: input.name.trim(),
        phone,
        email,
        roleId: role.id,
        phoneVerifiedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        role: {
          select: { id: true, slug: true, name: true, isSuperuser: true },
        },
      },
    });
    return serializeStaffUser(created);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw HttpError.conflict("A user with this phone or email already exists");
    }
    throw err;
  }
}

export async function updateStaffUser(
  id: string,
  input: {
    name?: string;
    email?: string | null;
    roleId?: string;
    isActive?: boolean;
  },
  actorId: string,
) {
  const existing = await prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!existing) throw HttpError.notFound("Staff user not found");
  if (existing.role.slug === CUSTOMER_ROLE_SLUG) {
    throw HttpError.badRequest("This user is a customer, not staff");
  }

  if (input.roleId) {
    await assertStaffRole(input.roleId);
  }

  const nextRole =
    input.roleId && input.roleId !== existing.roleId
      ? await prisma.role.findUnique({ where: { id: input.roleId } })
      : existing.role;

  const demotingSuperuser =
    existing.role.isSuperuser && nextRole && !nextRole.isSuperuser;
  const disablingSuperuser =
    existing.role.isSuperuser && input.isActive === false && existing.isActive;

  if (demotingSuperuser || disablingSuperuser) {
    const remaining = await countActiveSuperusers(id);
    if (remaining === 0) {
      throw HttpError.conflict("Cannot remove the last active super-admin");
    }
  }

  if (id === actorId && input.isActive === false) {
    throw HttpError.badRequest("You cannot disable your own account");
  }

  if (input.email) {
    const emailTaken = await prisma.user.findFirst({
      where: { email: input.email, NOT: { id } },
    });
    if (emailTaken) {
      throw HttpError.conflict("An account with this email already exists");
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.roleId ? { roleId: input.roleId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      role: {
        select: { id: true, slug: true, name: true, isSuperuser: true },
      },
    },
  });
  return serializeStaffUser(updated);
}

export async function listRoles() {
  const roles = await prisma.role.findMany({
    where: { slug: { not: CUSTOMER_ROLE_SLUG } },
    orderBy: [{ isSuperuser: "desc" }, { name: "asc" }],
    include: {
      permissions: { select: { permissionId: true } },
      _count: { select: { users: true } },
    },
  });
  return roles.map((role) => ({
    id: role.id,
    slug: role.slug,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isSuperuser: role.isSuperuser,
    permissionIds: role.permissions.map((p) => p.permissionId),
    userCount: role._count.users,
  }));
}

export async function listPermissions() {
  await syncPermissionCatalog();
  const permissions = await prisma.permission.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
  return permissions.map((p) => ({
    id: p.id,
    key: p.key,
    label: p.label,
    description: p.description,
    category: p.category,
    sortOrder: p.sortOrder,
  }));
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createRole(input: {
  name: string;
  slug?: string;
  description?: string | null;
}) {
  const slug = input.slug?.trim() || slugify(input.name);
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw HttpError.badRequest("Slug must be lowercase letters, digits, hyphens");
  }
  if (slug === CUSTOMER_ROLE_SLUG) {
    throw HttpError.badRequest("That slug is reserved");
  }
  const dup = await prisma.role.findUnique({ where: { slug } });
  if (dup) throw HttpError.conflict("A role with that slug already exists");

  const created = await prisma.role.create({
    data: {
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      isSystem: false,
      isSuperuser: false,
    },
  });
  return {
    id: created.id,
    slug: created.slug,
    name: created.name,
    description: created.description,
    isSystem: created.isSystem,
    isSuperuser: created.isSuperuser,
    permissionIds: [] as string[],
    userCount: 0,
  };
}

export async function updateRole(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    permissionIds?: string[];
  },
) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw HttpError.notFound("Role not found");
  if (role.slug === CUSTOMER_ROLE_SLUG) {
    throw HttpError.badRequest("Cannot edit the customer role here");
  }

  if (role.isSuperuser && input.permissionIds) {
    throw HttpError.badRequest("Super-admin already has all permissions");
  }

  if (input.permissionIds) {
    const unique = [...new Set(input.permissionIds)];
    const found = await prisma.permission.count({
      where: { id: { in: unique } },
    });
    if (found !== unique.length) {
      throw HttpError.badRequest("One or more permissions are invalid");
    }
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      prisma.rolePermission.createMany({
        data: unique.map((permissionId) => ({ roleId: id, permissionId })),
      }),
    ]);
  }

  const updated = await prisma.role.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
    },
    include: {
      permissions: { select: { permissionId: true } },
      _count: { select: { users: true } },
    },
  });

  return {
    id: updated.id,
    slug: updated.slug,
    name: updated.name,
    description: updated.description,
    isSystem: updated.isSystem,
    isSuperuser: updated.isSuperuser,
    permissionIds: updated.permissions.map((p) => p.permissionId),
    userCount: updated._count.users,
  };
}
