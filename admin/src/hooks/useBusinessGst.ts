import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface RegisteredAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  /** Two-digit GST state code — decides CGST+SGST vs IGST on every order. */
  stateCode: string;
  pincode: string;
}

export interface BusinessGst {
  legalName: string;
  tradeName: string;
  gstin: string | null;
  gstScheme: "REGULAR" | "COMPOSITE";
  registeredAddress: RegisteredAddress;
  invoicePrefix: string;
  fyStartMonth: number;
}

export function useBusinessGst() {
  return useQuery<BusinessGst>({
    queryKey: ["admin", "business", "gst"],
    queryFn: () => api.get<BusinessGst>("/admin/business/gst"),
    staleTime: 60_000,
  });
}

export function useUpdateBusinessGst() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BusinessGst) =>
      api.patch<BusinessGst>("/admin/business/gst", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "business", "gst"] });
    },
  });
}
