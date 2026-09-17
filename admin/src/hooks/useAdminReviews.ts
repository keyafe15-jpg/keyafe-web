import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type ReviewStatus = "PENDING" | "APPROVED" | "HIDDEN";

export interface AdminReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  email: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
  authorName: string;
  status: ReviewStatus;
  product: { id: string; slug: string; name: string };
}

export function useAdminReviews(status: ReviewStatus | "ALL") {
  return useQuery<AdminReview[]>({
    queryKey: ["admin", "reviews", status],
    queryFn: () => {
      const q = status === "ALL" ? "" : `?status=${status}`;
      return api.get<AdminReview[]>(`/admin/reviews${q}`);
    },
    staleTime: 15_000,
  });
}

export function useUpdateAdminReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) =>
      api.patch<AdminReview>(`/admin/reviews/${id}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
    },
  });
}
