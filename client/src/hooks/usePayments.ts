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
    mutationFn: (orderNumber: string) =>
      api.post<PaymentSession>("/payments/cashfree/session", { orderNumber }),
  });
}

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderNumber: string) =>
      api.post<{ state: PaymentState }>("/payments/cashfree/verify", { orderNumber }),
    onSuccess: (_data, orderNumber) => {
      void qc.invalidateQueries({ queryKey: ["order", orderNumber] });
    },
  });
}

export function useSwitchToCod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderNumber: string) =>
      api.post<{ ok: true }>("/payments/cashfree/switch-to-cod", { orderNumber }),
    onSuccess: (_data, orderNumber) => {
      void qc.invalidateQueries({ queryKey: ["order", orderNumber] });
    },
  });
}
