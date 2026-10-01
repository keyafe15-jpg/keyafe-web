import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ADMIN_NAV } from "@/content/nav";
import { staffHasPermission, firstAllowedPath } from "@/lib/permissions";
import { useAdminAuth } from "@/store/adminAuth";

/** Pages under a nav item that need more than the item itself. */
const STRICTER_PATHS: { to: string; requiresPermission: string }[] = [
  { to: "/products/new", requiresPermission: "products.write" },
];

function requiredPermissionForPath(pathname: string): string | undefined {
  const items = [...ADMIN_NAV.flatMap((g) => g.items), ...STRICTER_PATHS];
  const matches = items.filter((item) => {
    if (item.to === "/") return pathname === "/";
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  });
  matches.sort((a, b) => b.to.length - a.to.length);
  return matches[0]?.requiresPermission;
}

export function RequirePermission() {
  const user = useAdminAuth((s) => s.user);
  const location = useLocation();
  const required = requiredPermissionForPath(location.pathname);

  if (!required) return <Outlet />;
  if (staffHasPermission(user, required)) return <Outlet />;

  return <Navigate to={firstAllowedPath(user)} replace />;
}
