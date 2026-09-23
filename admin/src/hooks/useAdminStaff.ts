import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface StaffUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: {
    id: string;
    slug: string;
    name: string;
    isSuperuser: boolean;
  };
}

export interface StaffUsersResponse {
  items: StaffUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface StaffRole {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isSuperuser: boolean;
  permissionIds: string[];
  userCount: number;
}

export interface StaffPermission {
  id: string;
  key: string;
  label: string;
  description: string | null;
  category: string;
  sortOrder: number;
}

export function useStaffUsers(params: {
  page: number;
  search?: string;
  roleId?: string;
  active?: "all" | "true" | "false";
}) {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page));
  qs.set("pageSize", "20");
  if (params.search) qs.set("search", params.search);
  if (params.roleId) qs.set("roleId", params.roleId);
  if (params.active && params.active !== "all") qs.set("active", params.active);

  return useQuery<StaffUsersResponse>({
    queryKey: ["admin", "staff", "users", params],
    queryFn: () => api.get<StaffUsersResponse>(`/admin/staff/users?${qs}`),
  });
}

export function useStaffRoles() {
  return useQuery<StaffRole[]>({
    queryKey: ["admin", "staff", "roles"],
    queryFn: () => api.get<StaffRole[]>("/admin/staff/roles"),
  });
}

export function useStaffPermissions() {
  return useQuery<StaffPermission[]>({
    queryKey: ["admin", "staff", "permissions"],
    queryFn: () => api.get<StaffPermission[]>("/admin/staff/permissions"),
  });
}

export function useCreateStaffUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      phone: string;
      email?: string;
      roleId: string;
      promote?: boolean;
    }) => api.post<StaffUser>("/admin/staff/users", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
  });
}

export function useUpdateStaffUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      roleId?: string;
      isActive?: boolean;
    }) => api.patch<StaffUser>(`/admin/staff/users/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
  });
}

export function useDeleteStaffUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; name: string }>(`/admin/staff/users/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
  });
}

export function useCreateStaffRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      api.post<StaffRole>("/admin/staff/roles", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "staff", "roles"] });
    },
  });
}

export function useUpdateStaffRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      description?: string | null;
      permissionIds?: string[];
    }) => api.patch<StaffRole>(`/admin/staff/roles/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
  });
}
