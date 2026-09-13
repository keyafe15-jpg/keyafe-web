import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  FolderTree,
  Palette,
  Cake,
  Pizza,
  Sparkles,
  Link2,
  Zap,
  Truck,
  Ticket,
  Tag,
  Users,
  UserCircle,
  Settings,
  FileText,
  Megaphone,
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
      { to: "/", label: "Dashboard", icon: LayoutDashboard, requiresPermission: "dashboard.read" },
      {
        to: "/orders",
        label: "Orders",
        icon: ShoppingBag,
        requiresPermission: "orders.read",
      },
      {
        to: "/offline-orders",
        label: "Offline orders",
        icon: Link2,
        requiresPermission: "offline-orders.read",
      },
      {
        to: "/quotes",
        label: "Quote Requests",
        icon: FileText,
        requiresPermission: "quotes.read",
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      {
        to: "/products",
        label: "Products",
        icon: Package,
        requiresPermission: "products.write",
      },
      {
        to: "/categories",
        label: "Categories",
        icon: FolderTree,
        requiresPermission: "categories.write",
      },
      {
        to: "/flavours",
        label: "Flavours",
        icon: Palette,
        requiresPermission: "flavours.write",
      },
      {
        to: "/cake-sizes",
        label: "Cake sizes",
        icon: Cake,
        requiresPermission: "cake-sizes.write",
      },
      {
        to: "/toppings",
        label: "Toppings",
        icon: Pizza,
        requiresPermission: "toppings.write",
      },
      {
        to: "/addons",
        label: "Add-ons",
        icon: Sparkles,
        requiresPermission: "addons.write",
      },
      {
        to: "/tags",
        label: "Tags",
        icon: Tag,
        requiresPermission: "tags.write",
      },
    ],
  },
  {
    label: "Store Timings",
    items: [
      {
        to: "/same-day",
        label: "Store & Hours",
        icon: Zap,
        requiresPermission: "store.write",
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      {
        to: "/announcement",
        label: "Announcement",
        icon: Megaphone,
        requiresPermission: "settings.update",
      },
      {
        to: "/coupons",
        label: "Coupons",
        icon: Ticket,
        requiresPermission: "coupons.write",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        to: "/delivery",
        label: "Delivery Zones",
        icon: Truck,
        requiresPermission: "delivery.write",
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        to: "/customers",
        label: "Customers",
        icon: UserCircle,
        requiresPermission: "customers.read",
      },
      {
        to: "/users",
        label: "Users & Roles",
        icon: Users,
        requiresPermission: "users.manage",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        to: "/settings",
        label: "Settings",
        icon: Settings,
        requiresPermission: "settings.update",
      },
    ],
  },
];
