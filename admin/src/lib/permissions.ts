import { ADMIN_NAV } from "@/content/nav";
import { useAdminAuth, type AdminUser } from "@/store/adminAuth";

export function staffHasPermission(user: AdminUser | null | undefined, key: string): boolean {
  if (!user) return false;
  if (user.role.isSuperuser) return true;
  if (user.role.permissions.includes(key)) return true;
  if (key.endsWith(".read")) {
    const writeKey = `${key.slice(0, -".read".length)}.write`;
    if (user.role.permissions.includes(writeKey)) return true;
  }
  return false;
}

export function useStaffPermission(key: string) {
  const user = useAdminAuth((s) => s.user);
  return staffHasPermission(user, key);
}

export function firstAllowedPath(user: AdminUser | null): string {
  if (!user) return "/login";
  for (const item of ADMIN_NAV.flatMap((g) => g.items)) {
    if (!item.requiresPermission || staffHasPermission(user, item.requiresPermission)) {
      return item.to;
    }
  }
  return "/login";
}
