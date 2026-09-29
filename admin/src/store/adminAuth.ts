import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, setAdminAccessToken, setSessionRefresher, setUnauthorizedHandler } from "@/lib/api";

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  hasPassword?: boolean;
  role: {
    slug: string;
    isSuperuser: boolean;
    permissions: string[];
  };
}

interface AuthApiResponse {
  user: AdminUser;
  accessToken: string;
  refreshToken: string;
}

interface AdminAuthState {
  user: AdminUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isSubmitting: boolean;
  error: string | null;
  sendOtp: (phone: string) => Promise<string | null>;
  verifyOtp: (input: { phone: string; otp: string }) => Promise<boolean>;
  loginWithPassword: (input: { phone: string; password: string }) => Promise<boolean>;
  /** Throws with a user-facing message on failure. */
  changePassword: (input: { currentPassword?: string; newPassword: string }) => Promise<void>;
  /** Resolves with the server's (deliberately generic) confirmation message. */
  requestPasswordReset: (phone: string) => Promise<string>;
  logout: () => Promise<void>;
  clearError: () => void;
}

function applySession(user: AdminUser, accessToken: string, refreshToken: string) {
  setAdminAccessToken(accessToken);
  return { user, accessToken, refreshToken, isSubmitting: false, error: null };
}

function clearSession() {
  setAdminAccessToken(null);
  return {
    user: null as AdminUser | null,
    accessToken: null as string | null,
    refreshToken: null as string | null,
    error: null as string | null,
  };
}

export const useAdminAuth = create<AdminAuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isSubmitting: false,
      error: null,

      async sendOtp(phone) {
        set({ isSubmitting: true, error: null });
        try {
          const data = await api.post<{
            message: string;
            expiresInSeconds: number;
            otp?: string;
          }>("/auth/send-otp", { phone });
          set({ isSubmitting: false });
          return data.otp ?? null;
        } catch (err) {
          set({
            isSubmitting: false,
            error: err instanceof Error ? err.message : "Unable to send OTP",
          });
          return null;
        }
      },

      async verifyOtp({ phone, otp }) {
        set({ isSubmitting: true, error: null });
        try {
          const data = await api.post<AuthApiResponse>("/auth/verify-otp", {
            phone,
            otp,
            audience: "admin",
          });
          set(applySession(data.user, data.accessToken, data.refreshToken));
          return true;
        } catch (err) {
          set({
            isSubmitting: false,
            error: err instanceof Error ? err.message : "Authentication failed",
          });
          return false;
        }
      },

      async loginWithPassword({ phone, password }) {
        set({ isSubmitting: true, error: null });
        try {
          const data = await api.post<AuthApiResponse>("/auth/login-password", {
            phone,
            password,
            audience: "admin",
          });
          set(applySession(data.user, data.accessToken, data.refreshToken));
          return true;
        } catch (err) {
          set({
            isSubmitting: false,
            error: err instanceof Error ? err.message : "Sign-in failed",
          });
          return false;
        }
      },

      async changePassword({ currentPassword, newPassword }) {
        const { refreshToken, user } = useAdminAuth.getState();
        await api.post("/auth/password", {
          currentPassword: currentPassword || undefined,
          newPassword,
          refreshToken: refreshToken ?? undefined,
        });
        if (user) set({ user: { ...user, hasPassword: true } });
      },

      async requestPasswordReset(phone) {
        const data = await api.post<{ message: string }>("/auth/forgot-password", {
          phone,
          audience: "admin",
        });
        return data.message;
      },

      async logout() {
        const { refreshToken } = useAdminAuth.getState();
        set(clearSession());
        if (refreshToken) {
          await api.post("/auth/logout", { refreshToken }).catch(() => undefined);
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "keyafe-admin-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.user && !state.accessToken) {
          state.user = null;
        }
        setAdminAccessToken(state?.accessToken ?? null);
      },
    },
  ),
);

// When any API call gets a 401 (expired/invalid JWT), clear the persisted
// session so the login screen is the next thing the user sees — not an error toast.
setUnauthorizedHandler(() => {
  useAdminAuth.setState(clearSession());
});

// An expired access token is renewed silently with the long-lived refresh token,
// so staff stay signed in until they log out.
setSessionRefresher(async () => {
  const { refreshToken } = useAdminAuth.getState();
  if (!refreshToken) return null;
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ refreshToken }),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Session refresh failed: ${res.status}`);
  const data = (await res.json()) as AuthApiResponse;
  useAdminAuth.setState(applySession(data.user, data.accessToken, data.refreshToken));
  return data.accessToken;
});
