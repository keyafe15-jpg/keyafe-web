export const AUTH_COPY = {
  title: "Continue with OTP",
  subtitle:
    "Enter your phone number and we’ll send a code. If it’s your first time, we’ll ask for your name and email after the OTP is verified.",
  submit: "Verify OTP",
  createAccount: "Create account",
  submitting: "Verifying…",
  sendOtp: "Send OTP",
  fields: {
    name: { label: "Your name", hint: "Needed the first time you sign up." },
    countryCode: { label: "Code" },
    phone: { label: "Phone", placeholder: "Phone number" },
    email: {
      label: "Email",
      hint: "Optional — we use it for order receipts.",
    },
    otp: { label: "OTP" },
  },
  headerButton: "Log in",
  menu: {
    myOrders: "My orders",
    savedAddresses: "Saved addresses",
    logout: "Log out",
  },
} as const;
