import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: {
    slug: string;
    isSuperuser: boolean;
    permissions: string[];
  };
}

interface AuthState {
  user: AuthUser | null;
  isSubmitting: boolean;
  error: string | null;

  login: (input: { phone: string; password: string }) => Promise<void>;
  register: (input: {
    name: string;
    phone: string;
    email?: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// Real API calls come in Phase 3.5. For now we simulate.
const fakeDelay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isSubmitting: false,
      error: null,

      async login({ phone, password }) {
        set({ isSubmitting: true, error: null });
        try {
          await fakeDelay(600);
          if (password.length < 6) throw new Error("Invalid credentials");
          set({
            user: {
              id: "guest-" + phone,
              name: "Test User",
              phone,
              role: {
                slug: "customer",
                isSuperuser: false,
                permissions: [],
              },
            },
            isSubmitting: false,
          });
        } catch (err) {
          set({
            isSubmitting: false,
            error: err instanceof Error ? err.message : "Login failed",
          });
        }
      },

      async register({ name, phone, email, password }) {
        set({ isSubmitting: true, error: null });
        try {
          await fakeDelay(600);
          if (password.length < 6) throw new Error("Password too short");
          set({
            user: {
              id: "guest-" + phone,
              name,
              phone,
              email,
              role: {
                slug: "customer",
                isSuperuser: false,
                permissions: [],
              },
            },
            isSubmitting: false,
          });
        } catch (err) {
          set({
            isSubmitting: false,
            error: err instanceof Error ? err.message : "Registration failed",
          });
        }
      },

      async logout() {
        await fakeDelay(200);
        set({ user: null });
      },

      clearError: () => set({ error: null }),
    }),
    { name: "keyafe-auth" },
  ),
);
