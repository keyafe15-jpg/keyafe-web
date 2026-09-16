import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface StorefrontAnnouncement {
  announcementEnabled: boolean;
  announcementText: string;
  announcementLinkUrl: string | null;
  announcementLinkLabel: string | null;
}

export function useAdminAnnouncement() {
  return useQuery<StorefrontAnnouncement>({
    queryKey: ["admin", "business", "announcement"],
    queryFn: () => api.get<StorefrontAnnouncement>("/admin/business/announcement"),
    staleTime: 30_000,
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StorefrontAnnouncement) =>
      api.patch<StorefrontAnnouncement>("/admin/business/announcement", input),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["admin", "business", "announcement"],
      });
    },
  });
}
