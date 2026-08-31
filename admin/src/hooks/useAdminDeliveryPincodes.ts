import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type DeliveryDistrict = "KOLKATA" | "HOWRAH" | "HOOGHLY";

export interface AdminDeliveryPincode {
  pincode: string;
  city: string;
  area: string | null;
  district: DeliveryDistrict;
  deliveryFee: string;
  sameDayEligible: boolean;
  minOrderAmount: string | null;
  extraLeadHours: number;
  notes: string | null;
  isActive: boolean;
  expressEligible: boolean;
  expressDeliveryFee: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryPincodePayload {
  pincode: string;
  city: string;
  area?: string | null;
  district: DeliveryDistrict;
  deliveryFee: number;
  sameDayEligible: boolean;
  minOrderAmount?: number | null;
  extraLeadHours: number;
  notes?: string | null;
  isActive: boolean;
  expressEligible: boolean;
  expressDeliveryFee?: number | null;
}

export interface DeliveryPincodeImportResult {
  imported: number;
  skippedDuplicates: number;
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ["admin", "delivery-pincodes"] });
};

export function useAdminDeliveryPincodes() {
  return useQuery<AdminDeliveryPincode[]>({
    queryKey: ["admin", "delivery-pincodes"],
    queryFn: () => api.get<AdminDeliveryPincode[]>("/admin/delivery/pincodes"),
    staleTime: 30_000,
  });
}

export function useCreateDeliveryPincode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeliveryPincodePayload) =>
      api.post<AdminDeliveryPincode>("/admin/delivery/pincodes", input),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateDeliveryPincode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pincode,
      ...body
    }: { pincode: string } & Partial<
      Omit<DeliveryPincodePayload, "pincode">
    >) =>
      api.patch<AdminDeliveryPincode>(
        `/admin/delivery/pincodes/${pincode}`,
        body,
      ),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteDeliveryPincode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pincode: string) =>
      api.delete<void>(`/admin/delivery/pincodes/${pincode}`),
    onSuccess: () => invalidate(qc),
  });
}

export function useBulkImportDeliveryPincodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: DeliveryPincodePayload[]) =>
      api.post<DeliveryPincodeImportResult>("/admin/delivery/pincodes/bulk", {
        rows,
      }),
    onSuccess: () => invalidate(qc),
  });
}
