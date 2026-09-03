import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "react-router-dom";
import { X, Phone, Mail, MapPin, ShoppingBag, User } from "lucide-react";
import {
  useAdminCustomerDetail,
  type AdminCustomer,
} from "@/hooks/useAdminCustomers";
import { cn } from "@/lib/cn";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

interface CustomerDetailDrawerProps {
  customer: AdminCustomer | null;
  onClose: () => void;
}

export function CustomerDetailDrawer({
  customer,
  onClose,
}: CustomerDetailDrawerProps) {
  const { data, isLoading, isError } = useAdminCustomerDetail(customer?.id ?? null);

  return (
    <Dialog.Root
      open={customer != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
            <div className="min-w-0 pr-4">
              <Dialog.Title className="truncate text-lg font-semibold text-slate-900">
                {customer?.name ?? "Customer"}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">
                Contact history grouped by phone & email
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoading && (
              <p className="text-sm text-slate-500">Loading details…</p>
            )}
            {isError && (
              <p className="text-sm text-red-600">Could not load customer.</p>
            )}
            {data && (
              <div className="space-y-6">
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Overview
                  </h3>
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    {data.profile && (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          <TypeBadge
                            isRegistered={data.profile.isRegistered}
                          />
                          {data.isOrderOnly && (
                            <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                              Orders only
                            </span>
                          )}
                          {!data.profile.isActive && (
                            <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                              Disabled
                            </span>
                          )}
                        </div>
                        <Row icon={User} label="Account name" value={data.profile.name} />
                        <Row icon={Phone} label="Account phone" value={data.profile.phone} />
                        <Row
                          icon={Mail}
                          label="Account email"
                          value={data.profile.email ?? "—"}
                        />
                        <p className="text-xs text-slate-500">
                          Joined {formatDate(data.profile.createdAt)}
                          {data.profile.lastLoginAt &&
                            ` · Last login ${formatDate(data.profile.lastLoginAt)}`}
                        </p>
                      </>
                    )}
                    {data.isOrderOnly && (
                      <p className="text-slate-600">
                        No account — grouped from checkout snapshots only.
                      </p>
                    )}
                  </div>
                </section>

                {(data.contactVariants.names.length > 1 ||
                  data.contactVariants.emails.length > 1 ||
                  data.contactVariants.phones.length > 1) && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Variants seen on orders
                    </h3>
                    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm text-amber-950">
                      {data.contactVariants.names.length > 1 && (
                        <VariantList label="Names" items={data.contactVariants.names} />
                      )}
                      {data.contactVariants.phones.length > 1 && (
                        <VariantList label="Phones" items={data.contactVariants.phones} />
                      )}
                      {data.contactVariants.emails.length > 1 && (
                        <VariantList label="Emails" items={data.contactVariants.emails} />
                      )}
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Activity
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard
                      label="Total orders"
                      value={String(data.stats.totalOrders)}
                    />
                    <StatCard
                      label="Lifetime spend"
                      value={formatMoney(data.stats.totalSpent)}
                    />
                    <StatCard
                      label="Linked to account"
                      value={String(data.stats.linkedOrders)}
                    />
                    <StatCard
                      label="Guest checkouts"
                      value={String(data.stats.guestCheckoutOrders)}
                      highlight={data.stats.guestCheckoutOrders > 0}
                    />
                  </div>
                </section>

                {data.addresses.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Saved addresses
                    </h3>
                    <div className="space-y-2">
                      {data.addresses.map((a) => (
                        <div
                          key={a.id}
                          className="rounded-lg border border-slate-200 p-3 text-sm"
                        >
                          <div className="flex items-center gap-2 font-medium text-slate-900">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            {a.label ?? "Address"}
                            {a.isDefault && (
                              <span className="rounded bg-brand-50 px-1 py-0.5 text-[10px] font-medium text-brand-700">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-slate-600">
                            {a.line1}
                            {a.line2 ? `, ${a.line2}` : ""}
                          </p>
                          <p className="text-slate-500">
                            {a.city}, {a.state} {a.pincode}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Orders ({data.orders.length})
                  </h3>
                  <div className="space-y-2">
                    {data.orders.map((o) => (
                      <Link
                        key={o.id}
                        to={`/orders/${o.orderNumber}`}
                        className="block rounded-lg border border-slate-200 p-3 text-sm transition hover:border-brand-300 hover:bg-brand-50/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">
                              {o.orderNumber}
                            </p>
                            <p className="text-xs text-slate-500">
                              {o.customerName} · {o.customerPhone}
                            </p>
                          </div>
                          <p className="shrink-0 font-medium tabular-nums text-slate-900">
                            ₹{Number(o.total).toFixed(0)}
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {o.status.replace(/_/g, " ")}
                          </span>
                          {o.isGuestCheckout && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                              Guest checkout
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            {formatDate(o.createdAt)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function VariantList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-amber-900/70">{label}</p>
      <ul className="mt-0.5 list-inside list-disc text-slate-800">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        highlight
          ? "border-amber-200 bg-amber-50/50"
          : "border-slate-200 bg-white",
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}

function TypeBadge({ isRegistered }: { isRegistered: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        isRegistered
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-800",
      )}
    >
      {isRegistered ? "Registered" : "Guest profile"}
    </span>
  );
}
