import {
  ChartNoAxesColumn,
  LayoutDashboard,
  ShoppingBag,
  Package,
  FolderTree,
  Store,
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
  MessageSquareQuote,
  GalleryHorizontal,
  ChefHat,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  requiresPermission?: string;
  /** Highlight only on an exact match, when other nav items live under this path. */
  end?: boolean;
  /** `to` is an outside URL, opened in a new tab. */
  external?: boolean;
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
        to: "https://analytics.google.com/analytics/web/",
        label: "Website analytics",
        icon: ChartNoAxesColumn,
        requiresPermission: "dashboard.read",
        external: true,
      },
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
      {
        to: "/reviews",
        label: "Reviews",
        icon: MessageSquareQuote,
        requiresPermission: "reviews.read",
      },
    ],
  },
  {
    label: "Stall",
    items: [
      {
        to: "/stall",
        label: "Stall sales",
        icon: ChefHat,
        requiresPermission: "stall.sell",
        end: true,
      },
      {
        to: "/stall/menu",
        label: "Stalls & menus",
        icon: UtensilsCrossed,
        requiresPermission: "stall.manage",
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
        requiresPermission: "products.read",
      },
      {
        to: "/stores",
        label: "Stores",
        icon: Store,
        requiresPermission: "categories.write",
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
        to: "/hero-slides",
        label: "Hero slider",
        icon: GalleryHorizontal,
        requiresPermission: "settings.update",
      },
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
