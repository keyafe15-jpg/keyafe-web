import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type QuoteStatus =
  | "NEW"
  | "CONTACTED"
  | "QUOTED"
  | "CONVERTED"
  | "CLOSED";

export interface QuoteRequest {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  deliveryDate: string;
  description: string;
  referenceImages: string[];
  notes: string | null;
  status: QuoteStatus;
  adminNotes: string | null;
  quotedAmount: string | null;
  quotedAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useAdminQuotes(status: QuoteStatus | "ALL") {
  return useQuery<QuoteRequest[]>({
    queryKey: ["admin", "quotes", status],
    queryFn: () => {
      const q = status === "ALL" ? "" : `?status=${status}`;
      return api.get<QuoteRequest[]>(`/admin/quotes${q}`);
    },
    staleTime: 15_000,
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      status?: QuoteStatus;
      adminNotes?: string | null;
      quotedAmount?: number | null;
    }) => api.patch<QuoteRequest>(`/admin/quotes/${id}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "quotes"] });
    },
  });
}
