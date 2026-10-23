import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface AdminVendor {
  id: string;
  name: string;
  phone: string | null;
  channel: "OFFLINE" | "ONLINE";
  supplies: string[];
  gstin: string | null;
  address: string | null;
  notes: string | null;
  upiId: string | null;
  accountHint: string | null;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type VendorActiveFilter = "ALL" | "ACTIVE" | "ARCHIVED";
export type VendorChannelFilter = "ALL" | "OFFLINE" | "ONLINE";

export interface AdminVendorsPage {
  items: AdminVendor[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface VendorWritePayload {
  name: string;
  phone?: string | null;
  channel?: "OFFLINE" | "ONLINE";
  supplies?: string[];
  gstin?: string | null;
  address?: string | null;
  notes?: string | null;
  upiId?: string | null;
  accountHint?: string | null;
  isActive?: boolean;
}

export function useAdminVendors(filter: {
  search?: string | null;
  active?: VendorActiveFilter;
  channel?: VendorChannelFilter;
  page?: number;
  pageSize?: number;
}) {
  const q = filter.search?.trim() || "";
  const active = filter.active ?? "ACTIVE";
  const channel = filter.channel ?? "ALL";
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("active", active);
  if (channel !== "ALL") params.set("channel", channel);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  const qs = params.toString();
  return useQuery<AdminVendorsPage>({
    queryKey: ["admin", "vendors", { q, active, channel, page, pageSize }],
    queryFn: () => api.get<AdminVendorsPage>(`/admin/vendors?${qs}`),
    staleTime: 15_000,
  });
}

export function useAdminVendor(id: string | undefined) {
  return useQuery<AdminVendor>({
    queryKey: ["admin", "vendor", id],
    queryFn: () => api.get<AdminVendor>(`/admin/vendors/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VendorWritePayload) => api.post<AdminVendor>("/admin/vendors", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "vendors"] });
    },
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<VendorWritePayload>) =>
      api.patch<AdminVendor>(`/admin/vendors/${id}`, body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["admin", "vendors"] });
      void qc.invalidateQueries({ queryKey: ["admin", "vendor", data.id] });
    },
  });
}
