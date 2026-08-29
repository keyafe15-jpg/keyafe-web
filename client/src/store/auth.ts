import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import { normalizePhone } from "@/lib/validators";

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
  accessToken: string | null;
  refreshToken: string | null;

  sendOtp: (phone: string) => Promise<void>;
  continueWithOtp: (input: {
    phone: string;
    otp: string;
    name?: string;
    email?: string;
  }) => Promise<AuthApiResponse | RequiresProfileResponse | void>;
  login: (input: {
    phone: string;
    otp: string;
  }) => Promise<AuthApiResponse | RequiresProfileResponse | void>;
  register: (input: {
    name: string;
    phone: string;
    email?: string;
    otp: string;
  }) => Promise<AuthApiResponse | RequiresProfileResponse | void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

interface AuthApiResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

interface RequiresProfileResponse {
  requiresProfile: true;
  phone: string;
  message: string;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isSubmitting: false,
      error: null,
      accessToken: null,
      refreshToken: null,

      async sendOtp(phone) {
        const normalizedPhone = normalizePhone(phone);
        set({ isSubmitting: true, error: null });
        try {
          await api.post<{
            message: string;
            expiresInSeconds: number;
            otp?: string;
          }>("/auth/send-otp", { phone: normalizedPhone });
          set({ isSubmitting: false });
        } catch (err) {
          set({
            isSubmitting: false,
            error: err instanceof Error ? err.message : "Unable to send OTP",
          });
        }
      },

      async continueWithOtp({ phone, otp, name, email }) {
        const normalizedPhone = normalizePhone(phone);
        set({ isSubmitting: true, error: null });
        try {
          const data = await api.post<
            AuthApiResponse | RequiresProfileResponse
          >("/auth/verify-otp", {
            phone: normalizedPhone,
            otp,
            name,
            email,
          });

          if ("requiresProfile" in data && data.requiresProfile) {
            set({ isSubmitting: false, error: null });
            return data;
          }

          const authData = data as AuthApiResponse;
          set({
            user: authData.user,
            accessToken: authData.accessToken,
            refreshToken: authData.refreshToken,
            isSubmitting: false,
          });

          return authData;
        } catch (err) {
          set({
            isSubmitting: false,
            error: err instanceof Error ? err.message : "Authentication failed",
          });
        }
      },

      async login({ phone, otp }) {
        return this.continueWithOtp({ phone, otp });
      },

      async register({ name, phone, email, otp }) {
        return this.continueWithOtp({ name, phone, email, otp });
      },

      async logout() {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          error: null,
        });
      },

      clearError: () => set({ error: null }),
    }),
    { name: "keyafe-auth" },
  ),
);
