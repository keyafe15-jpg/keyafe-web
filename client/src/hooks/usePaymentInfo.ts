import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface PaymentInfo {
  upiId: string | null;
  payeeName: string;
}

export function usePaymentInfo() {
  return useQuery<PaymentInfo>({
    queryKey: ["store", "payment-info"],
    queryFn: () => api.get<PaymentInfo>("/store/payment-info"),
    staleTime: 5 * 60_000,
  });
}
