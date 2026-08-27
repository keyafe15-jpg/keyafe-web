export const AUTH_COPY = {
  tabs: { login: "Log in", register: "Register" },
  login: {
    title: "Welcome back",
    subtitle: "Log in to track orders and speed up checkout.",
    submit: "Log in",
    submitting: "Logging in…",
    fields: {
      phone: { label: "Phone", placeholder: "10-digit mobile" },
      password: { label: "Password" },
    },
  },
  register: {
    title: "Create your account",
    subtitle: "Register to save addresses and see your order history.",
    submit: "Create account",
    submitting: "Creating account…",
    fields: {
      name: { label: "Your name" },
      phone: { label: "Phone", placeholder: "10-digit mobile" },
      email: {
        label: "Email",
        hint: "Optional — we use it for order receipts.",
      },
      password: { label: "Password" },
    },
  },
  headerButton: "Log in",
  menu: {
    myOrders: "My orders",
    savedAddresses: "Saved addresses",
    logout: "Log out",
  },
} as const;
