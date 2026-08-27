import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: {
    slug: string;
    isSuperuser: boolean;
    permissions: string[];
  };
}

interface AdminAuthState {
  user: AdminUser | null;
  isSubmitting: boolean;
  error: string | null;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

// Mocked until Phase 6.5 (real auth wiring).
const fakeDelay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useAdminAuth = create<AdminAuthState>()(
  persist(
    (set) => ({
      user: null,
      isSubmitting: false,
      error: null,
      async login({ email, password }) {
        set({ isSubmitting: true, error: null });
        try {
          await fakeDelay(500);
          if (password.length < 6) throw new Error("Invalid credentials");
          set({
            user: {
              id: "admin-1",
              name: "Owner",
              email,
              role: {
                slug: "admin",
                isSuperuser: true,
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
      async logout() {
        await fakeDelay(150);
        set({ user: null });
      },
    }),
    { name: "keyafe-admin-auth" },
  ),
);
