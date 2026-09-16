import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import { normalizeCustomerPhone, phoneLookupVariants } from "../../lib/phone.js";
import {
  ADMIN_ROLE_SLUG,
  CHEF_PERMISSION_KEYS,
  CHEF_ROLE_SLUG,
  CUSTOMER_ROLE_SLUG,
  PERMISSION_CATALOG,
} from "./rbac.catalog.js";

export async function syncPermissionCatalog() {
  for (const perm of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      create: {
        key: perm.key,
        label: perm.label,
        category: perm.category,
        sortOrder: perm.sortOrder,
      },
      update: {
        label: perm.label,
        category: perm.category,
        sortOrder: perm.sortOrder,
      },
    });
  }
}

export async function seedRbac() {
  await syncPermissionCatalog();

  const adminRole = await prisma.role.upsert({
    where: { slug: ADMIN_ROLE_SLUG },
    create: {
      slug: ADMIN_ROLE_SLUG,
      name: "Admin",
      description: "Full access to the admin panel",
      isSystem: true,
      isSuperuser: true,
    },
    update: {
      name: "Admin",
      isSystem: true,
      isSuperuser: true,
    },
  });

  const chefRole = await prisma.role.upsert({
    where: { slug: CHEF_ROLE_SLUG },
    create: {
      slug: CHEF_ROLE_SLUG,
      name: "Chef",
      description: "Kitchen board — view and update orders",
      isSystem: true,
      isSuperuser: false,
    },
    update: {
      name: "Chef",
      isSystem: true,
      isSuperuser: false,
    },
  });

  await prisma.role.upsert({
    where: { slug: CUSTOMER_ROLE_SLUG },
    create: {
      slug: CUSTOMER_ROLE_SLUG,
      name: "Customer",
      description: "Storefront customer — cannot access admin",
      isSystem: true,
      isSuperuser: false,
    },
    update: {
      name: "Customer",
      isSystem: true,
      isSuperuser: false,
    },
  });

  const chefGrantCount = await prisma.rolePermission.count({
    where: { roleId: chefRole.id },
  });
  if (chefGrantCount === 0) {
    const chefPerms = await prisma.permission.findMany({
      where: { key: { in: [...CHEF_PERMISSION_KEYS] } },
      select: { id: true },
    });
    if (chefPerms.length > 0) {
      await prisma.rolePermission.createMany({
        data: chefPerms.map((p) => ({
          roleId: chefRole.id,
          permissionId: p.id,
        })),
      });
    }
  }

  logger.info(`Seeded ${PERMISSION_CATALOG.length} permissions and system roles`);

  const bootstrapPhoneRaw = process.env.ADMIN_BOOTSTRAP_PHONE?.trim() || "9883186892";
  const phone = normalizeCustomerPhone(bootstrapPhoneRaw);
  const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "Owner";

  let existing = await prisma.user.findUnique({ where: { phone } });
  if (!existing) {
    for (const variant of phoneLookupVariants(phone)) {
      existing = await prisma.user.findUnique({ where: { phone: variant } });
      if (existing) break;
    }
  }

  if (existing) {
    if (existing.roleId !== adminRole.id || !existing.phoneVerifiedAt) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          roleId: adminRole.id,
          isActive: true,
          phone,
          phoneVerifiedAt: existing.phoneVerifiedAt ?? new Date(),
        },
      });
      logger.info(`Promoted ${phone} to super-admin`);
    } else {
      logger.info(`Super-admin already seeded (${phone})`);
    }
    return;
  }

  await prisma.user.create({
    data: {
      name,
      phone,
      roleId: adminRole.id,
      phoneVerifiedAt: new Date(),
    },
  });
  logger.info(`Created super-admin user ${phone}`);
}
