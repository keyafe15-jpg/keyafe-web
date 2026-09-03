import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  FolderTree,
  Palette,
  Cake,
  Pizza,
  Link2,
  Zap,
  Truck,
  Ticket,
  Tag,
  Users,
  UserCircle,
  Settings,
  FileText,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  requiresPermission?: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      {
        to: "/orders",
        label: "Orders",
        icon: ShoppingBag,
        requiresPermission: "orders.read",
      },
      { to: "/offline-orders", label: "Offline orders", icon: Link2 },
      { to: "/quotes", label: "Quote Requests", icon: FileText },
    ],
  },
  {
    label: "Catalog",
    items: [
      { to: "/products", label: "Products", icon: Package },
      { to: "/categories", label: "Categories", icon: FolderTree },
      { to: "/flavours", label: "Flavours", icon: Palette },
      { to: "/cake-sizes", label: "Cake sizes", icon: Cake },
      { to: "/toppings", label: "Toppings", icon: Pizza },
      { to: "/tags", label: "Tags", icon: Tag },
    ],
  },
  {
    label: "Store Timings",
    items: [
      { to: "/same-day", label: "Store & Hours", icon: Zap },
      // {
      //   to: "/same-day-categories",
      //   label: "Same-Day Categories",
      //   icon: FolderTree,
      // },
    ],
  },
  {
    label: "Marketing",
    items: [{ to: "/coupons", label: "Coupons", icon: Ticket }],
  },
  {
    label: "Operations",
    items: [{ to: "/delivery", label: "Delivery Zones", icon: Truck }],
  },
  {
    label: "People",
    items: [
      { to: "/customers", label: "Customers", icon: UserCircle },
      { to: "/users", label: "Users & Roles", icon: Users },
    ],
  },
  {
    label: "System",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];
