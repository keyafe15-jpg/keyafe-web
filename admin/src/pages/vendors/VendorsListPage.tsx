import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Plus } from "lucide-react";
import {
  useAdminVendors,
  type VendorActiveFilter,
  type VendorChannelFilter,
} from "@/hooks/useAdminVendors";
import { PaginationControls } from "@/components/ClientPagination";
import { DebouncedSearchInput } from "@/components/form/DebouncedSearchInput";
import { useListSearch } from "@/store/listSearch";
import { useStaffPermission } from "@/lib/permissions";
import { cn } from "@/lib/cn";
import { channelLabel, supplyLabel } from "@/pages/vendors/vendor-ui";

const PAGE_SIZE = 20;

const STATUS_TABS: { key: VendorActiveFilter; label: string }[] = [
  { key: "ACTIVE", label: "Active" },
  { key: "ARCHIVED", label: "Archived" },
  { key: "ALL", label: "All" },
];

const CHANNEL_TABS: { key: VendorChannelFilter; label: string }[] = [
  { key: "ALL", label: "Any type" },
  { key: "OFFLINE", label: "Offline" },
  { key: "ONLINE", label: "Online" },
];

export function VendorsListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<VendorActiveFilter>("ACTIVE");
  const [channel, setChannel] = useState<VendorChannelFilter>("ALL");
  const search = useListSearch((s) => s.query);
  const setSearch = useListSearch((s) => s.setQuery);
  const navigate = useNavigate();
  const canWrite = useStaffPermission("vendors.write") || useStaffPermission("vendors.read");
  const { data, isLoading, isFetching } = useAdminVendors({
    search: search || null,
    active: status,
    channel,
    page,
    pageSize: PAGE_SIZE,
  });
  const vendors = data?.items ?? [];
  const total = data?.total ?? 0;
  const searching = search.length > 0;

  useEffect(() => {
    setPage(1);
  }, [search]);

  const changeStatus = (next: VendorActiveFilter) => {
    setStatus(next);
    setPage(1);
  };

  const changeChannel = (next: VendorChannelFilter) => {
    setChannel(next);
    setPage(1);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Vendors</h1>
          <p className="mt-1 text-sm text-slate-500">
            {searching
              ? `${total} match${total === 1 ? "" : "es"} for “${search}”`
              : "Who we buy from. Purchases and prices come in the next step."}
          </p>
        </div>
        {canWrite && (
          <Link
            to="/vendors/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add vendor
          </Link>
        )}
      </div>

      <div className="mb-3">
        <DebouncedSearchInput
          placeholder="Search name, phone, address, GSTIN…"
          onDebouncedChange={setSearch}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => changeStatus(t.key)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                status === t.key
                  ? "bg-brand-50 border-brand-500 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {CHANNEL_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => changeChannel(t.key)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                channel === t.key
                  ? "bg-brand-50 border-brand-500 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-clip rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && vendors.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            {searching
              ? `No vendors match “${search}”.`
              : status === "ARCHIVED"
                ? "No archived vendors."
                : "No vendors yet — add the dairy, the flour shop, the gas guy."}
          </div>
        )}
        {!isLoading && vendors.length > 0 && (
          <>
            {isFetching && !isLoading && (
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                Updating results…
              </div>
            )}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Vendor</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Phone</th>
                  <th className="px-4 py-2 font-medium">Address</th>
                  <th className="px-4 py-2 font-medium">Sells</th>
                  <th className="px-4 py-2 font-medium">Pay</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendors.map((v) => (
                  <tr
                    key={v.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a[href^='tel:']")) return;
                      navigate(`/vendors/${v.id}`);
                    }}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{v.name}</span>
                      {!v.isActive && (
                        <span className="ml-2 inline-flex rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-600">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{channelLabel(v.channel)}</td>
                    <td className="px-4 py-3 text-slate-700 tabular-nums">
                      {v.phone ? (
                        <a href={`tel:${v.phone}`} className="text-brand-700 hover:underline">
                          {v.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-3 text-slate-600">
                      {v.address || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {v.supplies.length ? v.supplies.map(supplyLabel).join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.upiId || v.accountHint || "—"}</td>
                    <td className="px-2 py-3 text-slate-300">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-slate-100 md:hidden">
              {vendors.map((v) => (
                <li key={v.id}>
                  <Link
                    to={`/vendors/${v.id}`}
                    className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {v.name}
                        <span className="ml-1.5 text-[10px] font-medium text-slate-500">
                          {channelLabel(v.channel)}
                        </span>
                        {!v.isActive && (
                          <span className="ml-1.5 text-[10px] font-medium text-slate-500">
                            Archived
                          </span>
                        )}
                      </p>
                      {v.phone && (
                        <p className="text-xs text-slate-600 tabular-nums">{v.phone}</p>
                      )}
                      {v.address && (
                        <p className="truncate text-xs text-slate-500">{v.address}</p>
                      )}
                      {v.supplies.length > 0 && (
                        <p className="truncate text-xs text-slate-500">
                          {v.supplies.map(supplyLabel).join(" · ")}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>

            <PaginationControls
              page={data?.page ?? 1}
              pageCount={data?.totalPages ?? 1}
              total={total}
              firstItem={data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0}
              lastItem={data ? Math.min(data.page * data.pageSize, data.total) : 0}
              onPageChange={setPage}
              noun="vendors"
              className="mx-4 mb-4"
            />
          </>
        )}
      </div>
    </div>
  );
}
