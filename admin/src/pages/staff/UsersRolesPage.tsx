import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { inputClass, selectClass, submitClass } from "@/components/form/Field";
import { PaginationControls } from "@/components/ClientPagination";
import { useStaffPermission } from "@/lib/permissions";
import { useAdminAuth } from "@/store/adminAuth";
import { useListSearch } from "@/store/listSearch";
import {
  useCreateStaffRole,
  useCreateStaffUser,
  useDeleteStaffUser,
  useStaffPermissions,
  useStaffRoles,
  useStaffUsers,
  useUpdateStaffRole,
  useUpdateStaffUser,
  type StaffPermission,
  type StaffRole,
  type StaffUser,
} from "@/hooks/useAdminStaff";

type PageTab = "staff" | "roles";

export function UsersRolesPage() {
  const canManageRoles = useStaffPermission("roles.manage");
  const [tab, setTab] = useState<PageTab>("staff");

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users & Roles</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tab === "staff"
              ? "Create kitchen and office staff. They sign in with OTP on this admin app. You can delete other staff accounts, but not your own."
              : "Choose what each role can do. Super-admin always has full access."}
          </p>
        </div>
        {canManageRoles && (
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            {(
              [
                { key: "staff", label: "Staff" },
                { key: "roles", label: "Roles" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition",
                  tab === t.key
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "staff" ? <StaffTab /> : <RolesTab />}
    </div>
  );
}

function StaffTab() {
  const { data: roles = [] } = useStaffRoles();
  const [page, setPage] = useState(1);
  const search = useListSearch((s) => s.query);
  const { data, isLoading } = useStaffUsers({ page, search: search || undefined });
  const users = data?.items ?? [];

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <div className="space-y-4">
      <NewStaffForm roles={roles} />

      <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && users.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            {search ? `No staff match “${search}”.` : "No staff users yet."}
          </div>
        )}
        {!isLoading && users.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="hidden border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase md:table-header-group">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Last login</th>
                <th className="w-28 px-4 py-2 text-center font-medium">Active</th>
                <th className="w-14 px-4 py-2 text-right font-medium">
                  <span className="sr-only">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <StaffRow key={user.id} user={user} roles={roles} />
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data && data.totalPages > 1 && (
        <PaginationControls
          page={page}
          pageCount={data.totalPages}
          total={data.total}
          firstItem={(page - 1) * data.pageSize + 1}
          lastItem={Math.min(page * data.pageSize, data.total)}
          onPageChange={setPage}
          noun="staff"
        />
      )}
    </div>
  );
}

function NewStaffForm({ roles }: { roles: StaffRole[] }) {
  const create = useCreateStaffUser();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const defaultRoleId = roles.find((r) => r.slug === "chef")?.id ?? roles[0]?.id;

  useEffect(() => {
    if (!roleId && defaultRoleId) setRoleId(defaultRoleId);
  }, [defaultRoleId, roleId]);

  const submit = async (promote = false) => {
    setError(null);
    try {
      await create.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        roleId,
        promote,
      });
      setName("");
      setPhone("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create";
      if (!promote && message.toLowerCase().includes("promote")) {
        const ok = window.confirm(`${message}\n\nPromote this customer to staff?`);
        if (ok) await submit(true);
        return;
      }
      setError(message);
    }
  };

  return (
    <div className="rounded-card border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1.5fr_auto]">
        <label>
          <span className="mb-1 block text-xs font-medium text-slate-500">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Kitchen staff"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-slate-500">Phone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            placeholder="9876543210"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-slate-500">Role</span>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className={selectClass}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <div className="self-end">
          <button
            type="button"
            disabled={!name.trim() || !phone.trim() || !roleId || create.isPending}
            onClick={() => void submit(false)}
            className={cn(submitClass, "inline-flex items-center gap-1")}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>
      {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function StaffRow({ user, roles }: { user: StaffUser; roles: StaffRole[] }) {
  const update = useUpdateStaffUser();
  const del = useDeleteStaffUser();
  const currentUserId = useAdminAuth((s) => s.user?.id);
  const isSelf = user.id === currentUserId;
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    setError(null);
    if (isSelf) {
      setError("You cannot delete your own account.");
      return;
    }
    if (!confirm(`Delete staff user “${user.name}”? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <tr className="block p-4 hover:bg-slate-50 md:table-row md:p-0">
      <td className="block md:table-cell md:px-4 md:py-3">
        <p className="font-medium text-slate-900">
          {user.name}
          {isSelf && (
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
              You
            </span>
          )}
        </p>
        {user.email && <p className="text-xs text-slate-500">{user.email}</p>}
        {error && <p className="mt-1 text-xs text-brand-700">{error}</p>}
      </td>
      <td className="mt-2 block text-slate-700 tabular-nums md:mt-0 md:table-cell md:px-4 md:py-3">
        <div className="flex items-center justify-between gap-2 md:justify-start">
          <span className="text-xs font-medium text-slate-500 md:hidden">Phone</span>
          {user.phone}
        </div>
      </td>
      <td className="mt-2 block md:mt-0 md:table-cell md:px-4 md:py-3">
        <div className="flex items-center justify-between gap-2 md:justify-start">
          <span className="text-xs font-medium text-slate-500 md:hidden">Role</span>
          <select
            value={user.role.id}
            disabled={update.isPending}
            onChange={(e) => update.mutate({ id: user.id, roleId: e.target.value })}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className="mt-2 block text-slate-500 md:mt-0 md:table-cell md:px-4 md:py-3">
        <div className="flex items-center justify-between gap-2 md:justify-start">
          <span className="text-xs font-medium text-slate-500 md:hidden">Last login</span>
          {user.lastLoginAt
            ? new Date(user.lastLoginAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Never"}
        </div>
      </td>
      <td className="mt-2 block md:mt-0 md:table-cell md:px-4 md:py-3 md:text-center">
        <label className="flex cursor-pointer items-center justify-between gap-2 md:justify-center">
          <span className="text-xs font-medium text-slate-500 md:hidden">Active</span>
          <input
            type="checkbox"
            checked={user.isActive}
            disabled={isSelf}
            onChange={(e) => update.mutate({ id: user.id, isActive: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500 disabled:opacity-50"
            title={isSelf ? "You cannot disable your own account" : undefined}
          />
        </label>
      </td>
      <td className="mt-3 block text-right md:mt-0 md:table-cell md:px-4 md:py-3">
        <button
          type="button"
          onClick={() => void onDelete()}
          disabled={del.isPending || isSelf}
          title={isSelf ? "You cannot delete your own account" : `Delete “${user.name}”`}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:opacity-50",
            isSelf
              ? "cursor-not-allowed text-slate-300"
              : "text-red-500 hover:bg-red-50 hover:text-red-700",
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function RolesTab() {
  const { data: roles = [], isLoading } = useStaffRoles();
  const { data: permissions = [] } = useStaffPermissions();
  const create = useCreateStaffRole();
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = roles.find((r) => r.id === selectedId) ?? roles[0] ?? null;

  useEffect(() => {
    if (!selectedId && roles[0]) setSelectedId(roles[0].id);
  }, [roles, selectedId]);

  const grouped = useMemo(() => groupPermissions(permissions), [permissions]);

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <div className="space-y-3">
        <div className="rounded-card border border-slate-200 bg-white p-3">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New role name"
              className={inputClass}
            />
            <button
              type="button"
              disabled={!name.trim() || create.isPending}
              onClick={async () => {
                const created = await create.mutateAsync({ name: name.trim() });
                setName("");
                setSelectedId(created.id);
              }}
              className={cn(submitClass, "shrink-0 px-3")}
            >
              Add
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
          {isLoading && <p className="p-4 text-sm text-slate-500">Loading…</p>}
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedId(role.id)}
              className={cn(
                "flex w-full flex-col items-start border-b border-slate-100 px-4 py-3 text-left last:border-b-0",
                selected?.id === role.id ? "bg-brand-50" : "hover:bg-slate-50",
              )}
            >
              <span className="text-sm font-medium text-slate-900">{role.name}</span>
              <span className="text-xs text-slate-500">
                {role.isSuperuser
                  ? "All permissions"
                  : `${role.permissionIds.length} permissions · ${role.userCount} staff`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selected && <RoleEditor role={selected} grouped={grouped} />}
    </div>
  );
}

function groupPermissions(permissions: StaffPermission[]) {
  const map = new Map<string, StaffPermission[]>();
  for (const perm of permissions) {
    const list = map.get(perm.category) ?? [];
    list.push(perm);
    map.set(perm.category, list);
  }
  return [...map.entries()];
}

function RoleEditor({
  role,
  grouped,
}: {
  role: StaffRole;
  grouped: [string, StaffPermission[]][];
}) {
  const update = useUpdateStaffRole();
  const [name, setName] = useState(role.name);
  const [ids, setIds] = useState<Set<string>>(() => new Set(role.permissionIds));

  useEffect(() => {
    setName(role.name);
    setIds(new Set(role.permissionIds));
  }, [role.id, role.name, role.permissionIds]);

  const toggle = (id: string) => {
    const next = new Set(ids);
    next.has(id) ? next.delete(id) : next.add(id);
    setIds(next);
    update.mutate({ id: role.id, permissionIds: [...next] });
  };

  return (
    <div className="rounded-card border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name.trim() !== role.name) {
              update.mutate({ id: role.id, name: name.trim() });
            }
          }}
          className="text-lg font-semibold text-slate-900 outline-none"
        />
        {role.isSystem && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] tracking-wide text-slate-500 uppercase">
            System
          </span>
        )}
      </div>
      {role.isSuperuser ? (
        <p className="text-sm text-slate-600">
          Super-admin bypasses every permission check. New features stay available without updating
          this list.
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map(([category, perms]) => (
            <div key={category}>
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                {category}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {perms.map((perm) => (
                  <label
                    key={perm.id}
                    className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={ids.has(perm.id)}
                      onChange={() => toggle(perm.id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500"
                    />
                    <span>
                      <span className="font-medium text-slate-800">{perm.label}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                        {perm.key}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
