import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";

export interface ProductReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
  authorName: string;
  status?: "PENDING" | "APPROVED" | "HIDDEN";
}

export interface ProductReviewsPage {
  summary: { average: number; count: number };
  page: number;
  pageSize: number;
  totalPages: number;
  items: ProductReview[];
}

export type SubmitReviewInput = {
  rating: number;
  title?: string;
  body?: string;
  displayName: string;
  email?: string;
};

export function useProductReviews(slug: string | undefined, page = 1) {
  return useQuery<ProductReviewsPage>({
    queryKey: ["products", slug, "reviews", page],
    queryFn: () =>
      api.get<ProductReviewsPage>(
        `/products/${encodeURIComponent(slug!)}/reviews?page=${page}&pageSize=8`,
      ),
    enabled: Boolean(slug),
    staleTime: 30_000,
  });
}

export function useSubmitProductReview(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitReviewInput) => {
      const token = useAuth.getState().accessToken;
      return api.post<ProductReview>(
        `/products/${encodeURIComponent(slug)}/reviews`,
        body,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products", slug, "reviews"] });
    },
  });
}
