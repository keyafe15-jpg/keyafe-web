import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface AdminDepartment {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  categoryCount: number;
}

export function useAdminDepartments() {
  return useQuery<AdminDepartment[]>({
    queryKey: ["admin", "departments"],
    queryFn: () => api.get<AdminDepartment[]>("/admin/departments"),
    staleTime: 30_000,
  });
}

export interface DepartmentPayload {
  name: string;
  slug: string;
  sortOrder?: number;
  isActive?: boolean;
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ["admin", "departments"] });
  void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
  void qc.invalidateQueries({ queryKey: ["categories"] });
  void qc.invalidateQueries({ queryKey: ["departments"] });
};

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DepartmentPayload) =>
      api.post<AdminDepartment>("/admin/departments", input),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: { id: string } & Partial<DepartmentPayload>) =>
      api.patch<AdminDepartment>(`/admin/departments/${id}`, body),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/departments/${id}`),
    onSuccess: () => invalidate(qc),
  });
}
