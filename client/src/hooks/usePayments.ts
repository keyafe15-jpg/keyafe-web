import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface PaymentSession {
  orderNumber: string;
  paymentSessionId: string;
  mode: "sandbox" | "production";
  amount: number;
}

export type PaymentState = "PAID" | "PENDING" | "FAILED" | "NOT_ONLINE";

export function usePaymentConfig() {
  return useQuery({
    queryKey: ["payments", "config"],
    queryFn: () =>
      api.get<{ cashfreeEnabled: boolean; mode: "sandbox" | "production" }>("/payments/config"),
    staleTime: 5 * 60_000,
  });
}

export function useCreatePaymentSession() {
  return useMutation({
    mutationFn: (orderId: string) =>
      api.post<PaymentSession>("/payments/cashfree/session", { orderId }),
  });
}

// The order page may be keyed by id or a legacy order number, so refresh every
// cached order rather than guessing which key it used.
export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      api.post<{ state: PaymentState }>("/payments/cashfree/verify", { orderId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useSwitchToCod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      api.post<{ ok: true }>("/payments/cashfree/switch-to-cod", { orderId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}
