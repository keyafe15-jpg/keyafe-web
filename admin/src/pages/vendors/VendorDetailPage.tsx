import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  useAdminVendor,
  useCreateVendor,
  useUpdateVendor,
} from "@/hooks/useAdminVendors";
import { useAdminPurchases } from "@/hooks/useAdminBooks";
import { useStaffPermission } from "@/lib/permissions";
import { cn } from "@/lib/cn";
import { VendorForm } from "@/pages/vendors/VendorForm";
import { formatBooksDate, inr, lineQtyLabel, purposeLabel } from "@/pages/expenses/books-ui";
import { channelLabel } from "@/pages/vendors/vendor-ui";
import { PaginationControls } from "@/components/ClientPagination";

export function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const canWrite =
    useStaffPermission("vendors.write") || useStaffPermission("vendors.read");
  const vendorQuery = useAdminVendor(isNew ? undefined : id);
  const create = useCreateVendor();
  const update = useUpdateVendor();
  const [tab, setTab] = useState<"details" | "buys">("details");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const vendor = vendorQuery.data;
  const pending = create.isPending || update.isPending;

  if (!isNew && vendorQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading vendor…</p>;
  }
  if (!isNew && vendorQuery.isError) {
    return (
      <div>
        <Link to="/vendors" className="text-xs text-slate-500 hover:text-brand-500">
          All vendors
        </Link>
        <p className="mt-3 text-sm text-red-700">Vendor not found.</p>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/vendors"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-500"
      >
        <ArrowLeft className="h-3 w-3" /> All vendors
      </Link>

      <div className="mt-3 mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isNew ? "New vendor" : vendor?.name}
          </h1>
          {!isNew && vendor && (
            <p className="mt-1 text-sm text-slate-500">
              {channelLabel(vendor.channel)}
              {!vendor.isActive ? " · Archived — hidden from the active list." : ""}
            </p>
          )}
        </div>
        {!isNew && vendor && canWrite && (
          <button
            type="button"
            disabled={update.isPending}
            onClick={() => {
              setError(null);
              update.mutate(
                { id: vendor.id, isActive: !vendor.isActive },
                {
                  onError: (err) => {
                    setError(err instanceof Error ? err.message : "Could not update");
                  },
                },
              );
            }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {vendor.isActive ? "Archive" : "Restore"}
          </button>
        )}
      </div>

      {!isNew && (
        <div className="mb-4 flex gap-1">
          {(
            [
              ["details", "Details"],
              ["buys", "Buys"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                tab === key
                  ? "bg-brand-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {(isNew || tab === "details") && (
        <div className="rounded-card border border-slate-200 bg-white p-4">
          {canWrite ? (
            <VendorForm
              key={vendor?.id ?? "new"}
              vendor={vendor}
              pending={pending}
              error={error}
              saved={saved}
              submitLabel={isNew ? "Add vendor" : "Save"}
              onSubmit={(body) => {
                setError(null);
                setSaved(false);
                if (isNew) {
                  create.mutate(body, {
                    onSuccess: (created) => navigate(`/vendors/${created.id}`, { replace: true }),
                    onError: (err) => {
                      setError(err instanceof Error ? err.message : "Could not save");
                    },
                  });
                } else if (vendor) {
                  update.mutate(
                    { id: vendor.id, ...body },
                    {
                      onSuccess: () => setSaved(true),
                      onError: (err) => {
                        setError(err instanceof Error ? err.message : "Could not save");
                      },
                    },
                  );
                }
              }}
            />
          ) : vendor ? (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Type</dt>
                <dd>{channelLabel(vendor.channel)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phone</dt>
                <dd>{vendor.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Address</dt>
                <dd>{vendor.address ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Sells</dt>
                <dd>{vendor.supplies.length ? vendor.supplies.join(", ") : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">GSTIN</dt>
                <dd>{vendor.gstin ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Pay</dt>
                <dd>{[vendor.upiId, vendor.accountHint].filter(Boolean).join(" · ") || "—"}</dd>
              </div>
              {vendor.notes && (
                <div>
                  <dt className="text-xs text-slate-500">Notes</dt>
                  <dd>{vendor.notes}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-500">You can view vendors but not add them.</p>
          )}
        </div>
      )}

      {!isNew && tab === "buys" && vendor && <VendorBuysTab vendorId={vendor.id} />}
    </div>
  );
}

function VendorBuysTab({ vendorId }: { vendorId: string }) {
  const [page, setPage] = useState(1);
  const canLog = useStaffPermission("expenses.write");
  const { data, isLoading } = useAdminPurchases({ vendorId, page, pageSize: 20 });
  const buys = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      {canLog && (
        <div className="mb-3 flex justify-end">
          <Link
            to={`/expenses/new-buy?vendorId=${vendorId}`}
            className="inline-flex items-center rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Log a buy
          </Link>
        </div>
      )}
      <div className="overflow-clip rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && buys.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-800">No buys yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              Every bag from this vendor — date, qty, and rate — will show up here.
            </p>
          </div>
        )}
        {!isLoading && buys.length > 0 && (
          <>
            <ul className="divide-y divide-slate-100">
              {buys.map((buy) => (
                <li key={buy.id}>
                  <Link
                    to={`/expenses/buys/${buy.id}`}
                    className="block px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium text-slate-900">{formatBooksDate(buy.date)}</p>
                      <p className="text-sm font-semibold tabular-nums">{inr(buy.total)}</p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {purposeLabel(buy.purpose)}
                      {buy.lines
                        .map(
                          (l) =>
                            ` · ${l.buyItem.name} ${lineQtyLabel(l.qty, l.buyItem.unit, l.buyItem.packSize)} @ ${inr(l.unitPrice)}`,
                        )
                        .join("")}
                    </p>
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
              noun="buys"
              className="mx-4 mb-4"
            />
          </>
        )}
      </div>
    </div>
  );
}
