export const PERMISSION_CATALOG = [
  { key: "dashboard.read", label: "View sales dashboard", category: "overview", sortOrder: 0 },

  { key: "orders.read", label: "View orders", category: "orders", sortOrder: 0 },
  { key: "orders.update", label: "Update order status", category: "orders", sortOrder: 1 },
  { key: "orders.cancel", label: "Cancel orders", category: "orders", sortOrder: 2 },
  // Separate from orders.read: issuing an invoice assigns a permanent number
  // out of the GST series, so it isn't something every order viewer should do.
  {
    key: "invoices.read",
    label: "Download & email tax invoices",
    category: "orders",
    sortOrder: 3,
  },
  // Also assigns a permanent number, but from the challan series rather than
  // the GST invoice series, so it is granted independently.
  { key: "challans.read", label: "Download delivery challans", category: "orders", sortOrder: 4 },

  { key: "offline-orders.read", label: "View offline orders", category: "offline", sortOrder: 0 },
  {
    key: "offline-orders.write",
    label: "Create & edit offline orders",
    category: "offline",
    sortOrder: 1,
  },

  { key: "products.read", label: "View products", category: "catalog", sortOrder: 0 },
  { key: "products.write", label: "Edit products", category: "catalog", sortOrder: 1 },
  { key: "categories.write", label: "Edit categories", category: "catalog", sortOrder: 2 },
  { key: "flavours.write", label: "Edit flavours", category: "catalog", sortOrder: 3 },
  { key: "cake-sizes.write", label: "Edit cake sizes", category: "catalog", sortOrder: 4 },
  { key: "toppings.write", label: "Edit toppings", category: "catalog", sortOrder: 5 },
  { key: "addons.write", label: "Edit add-ons", category: "catalog", sortOrder: 6 },
  { key: "tags.write", label: "Edit tags", category: "catalog", sortOrder: 7 },

  { key: "quotes.read", label: "View quote requests", category: "quotes", sortOrder: 0 },
  { key: "quotes.update", label: "Update quote requests", category: "quotes", sortOrder: 1 },

  { key: "customers.read", label: "View customers", category: "customers", sortOrder: 0 },

  { key: "coupons.write", label: "Manage coupons", category: "marketing", sortOrder: 0 },

  { key: "delivery.write", label: "Manage delivery zones", category: "operations", sortOrder: 0 },
  { key: "store.write", label: "Manage store hours", category: "operations", sortOrder: 1 },

  { key: "settings.update", label: "Update business settings", category: "system", sortOrder: 0 },
  { key: "users.manage", label: "Manage staff users", category: "system", sortOrder: 1 },
  { key: "roles.manage", label: "Manage roles & permissions", category: "system", sortOrder: 2 },
] as const;

export const CHEF_PERMISSION_KEYS = ["orders.read", "orders.update"] as const;

export const CUSTOMER_ROLE_SLUG = "customer";
export const ADMIN_ROLE_SLUG = "admin";
export const CHEF_ROLE_SLUG = "chef";
