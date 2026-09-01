import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface BusinessUpi {
  upiId: string | null;
  upiPayeeName: string | null;
}

export function useBusinessUpi() {
  return useQuery<BusinessUpi>({
    queryKey: ["admin", "business", "upi"],
    queryFn: () => api.get<BusinessUpi>("/admin/business/upi"),
    staleTime: 60_000,
  });
}

export function useUpdateBusinessUpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BusinessUpi) =>
      api.patch<BusinessUpi>("/admin/business/upi", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "business", "upi"] });
    },
  });
}
