import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface BusinessContact {
  supportPhone: string;
  /** Second number shown on the storefront. */
  altPhone: string | null;
  supportEmail: string;
  /** New-order and cancellation emails; null falls back to supportEmail. */
  orderNotificationEmail: string | null;
}

export function useBusinessContact() {
  return useQuery<BusinessContact>({
    queryKey: ["admin", "business", "contact"],
    queryFn: () => api.get<BusinessContact>("/admin/business/contact"),
    staleTime: 60_000,
  });
}

export function useUpdateBusinessContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BusinessContact) =>
      api.patch<BusinessContact>("/admin/business/contact", input),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "business", "contact"], data);
    },
  });
}
