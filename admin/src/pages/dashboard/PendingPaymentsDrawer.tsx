import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "react-router-dom";
import { ChevronDown, Coffee, MessageCircle, Phone, Search, X } from "lucide-react";
import {
  usePendingCollections,
  type CollectionsScope,
  type PendingCustomer,
  type PendingOrder,
  type UnbilledBreakfast,
} from "@/hooks/useCollections";
import { STALL_KEY } from "@/pages/stall/stall-ui";
import { useUpdateOrder } from "@/hooks/useAdminOrders";
import { StatusPill } from "@/pages/orders/order-ui";
import { useStaffPermission } from "@/lib/permissions";
import { whatsappHref } from "@/lib/contact";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/cn";

function formatDay(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function reminderText(customer: PendingCustomer) {
  const firstName = customer.customerName.trim().split(/\s+/)[0] ?? "";
  const orders = customer.orders.map((o) => o.orderNumber).join(", ");
  return (
    `Hi ${firstName}, a gentle reminder from Keyafe: ${formatINR(customer.pending)} is pending ` +
    `for your order${customer.orders.length === 1 ? "" : "s"} ${orders}. ` +
    `Please share the payment when convenient. Thank you!`
  );
}

export function PendingPaymentsDrawer({
  scope,
  label,
  onClose,
}: {
  /** `null` keeps the drawer closed. */
  scope: CollectionsScope | null;
  label: string;
  onClose: () => void;
}) {
  const open = scope != null;
  const { data, isLoading, isError } = usePendingCollections(scope ?? "all", open);
  const canRecord = useStaffPermission("orders.update");
  const [search, setSearch] = useState("");

  const needle = search.trim().toLowerCase();
  const customers = (data?.customers ?? []).filter(
    (c) =>
      !needle ||
      c.customerName.toLowerCase().includes(needle) ||
      c.phone.includes(needle) ||
      c.orders.some((o) => o.orderNumber.toLowerCase().includes(needle)),
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSearch("");
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Dialog.Title className="text-lg font-semibold text-slate-900">
                  Pending payments
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-slate-500">
                  {label}
                </Dialog.Description>
              </div>
              <Dialog.Close className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            {data && (
              <p className="mt-3 text-2xl font-semibold text-amber-700 tabular-nums">
                {formatINR(data.pending)}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  from {data.customers.length} customer{data.customers.length === 1 ? "" : "s"}
                </span>
              </p>
            )}
            {data && data.customers.length > 3 && (
              <label className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, phone or order"
                  className="w-full min-w-0 bg-transparent text-sm outline-none"
                />
              </label>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-5">
            {isLoading && <p className="p-2 text-sm text-slate-500">Loading…</p>}
            {isError && (
              <p className="p-2 text-sm text-red-600">Could not load pending payments.</p>
            )}
            {data && data.customers.length === 0 && data.breakfast.length === 0 && (
              <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
                Nothing pending — every order in this period is fully paid.
              </p>
            )}
            {data && data.breakfast.length > 0 && !needle && (
              <section className="mb-3">
                <h3 className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <Coffee className="h-3.5 w-3.5" />
                  Breakfast not billed yet
                </h3>
                <ul className="space-y-2">
                  {data.breakfast.map((b) => (
                    <UnbilledBreakfastRow key={b.stallId} breakfast={b} />
                  ))}
                </ul>
              </section>
            )}
            {data && data.customers.length > 0 && customers.length === 0 && (
              <p className="p-2 text-sm text-slate-500">No customer matches “{search}”.</p>
            )}
            <ul className="space-y-2">
              {customers.map((customer) => (
                <CustomerCard key={customer.phone} customer={customer} canRecord={canRecord} />
              ))}
            </ul>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function UnbilledBreakfastRow({ breakfast }: { breakfast: UnbilledBreakfast }) {
  const canBill = useStaffPermission("stall.manage");
  const span =
    breakfast.from === breakfast.to
      ? formatDay(breakfast.from)
      : `${formatDay(breakfast.from)} – ${formatDay(breakfast.to)}`;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-slate-900">
          {breakfast.billToName ?? breakfast.stallName}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {breakfast.billToName ? `${breakfast.stallName} · ` : ""}
          {breakfast.plates} plate{breakfast.plates === 1 ? "" : "s"} · {span}
        </span>
      </span>
      <span className="shrink-0 font-semibold text-amber-700 tabular-nums">
        {formatINR(breakfast.amount)}
      </span>
      {canBill && (
        <Link
          to={`/stall?tab=breakfast&month=${breakfast.from.slice(0, 7)}`}
          onClick={() => localStorage.setItem(STALL_KEY, breakfast.stallId)}
          className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-medium text-brand-600 ring-1 ring-slate-200 transition hover:ring-brand-500"
        >
          Bill it
        </Link>
      )}
    </li>
  );
}

function CustomerCard({ customer, canRecord }: { customer: PendingCustomer; canRecord: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform",
              !expanded && "-rotate-90",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-slate-900">
              {customer.customerName}
            </span>
            <span className="block truncate text-xs text-slate-500">
              {customer.phone} · {customer.orders.length} order
              {customer.orders.length === 1 ? "" : "s"}
            </span>
          </span>
          <span className="shrink-0 font-semibold text-amber-700 tabular-nums">
            {formatINR(customer.pending)}
          </span>
        </button>
        <a
          href={`tel:${customer.phone}`}
          title={`Call ${customer.customerName}`}
          aria-label={`Call ${customer.customerName}`}
          className="shrink-0 rounded-md border border-slate-200 p-2 text-slate-600 transition hover:border-brand-500 hover:text-brand-500"
        >
          <Phone className="h-4 w-4" />
        </a>
        <a
          href={whatsappHref(customer.phone, reminderText(customer))}
          target="_blank"
          rel="noreferrer"
          title="Send a WhatsApp reminder"
          aria-label={`WhatsApp ${customer.customerName}`}
          className="shrink-0 rounded-md border border-slate-200 p-2 text-emerald-600 transition hover:border-emerald-500"
        >
          <MessageCircle className="h-4 w-4" />
        </a>
      </div>
      {expanded && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/60">
          {customer.orders.map((order) => (
            <OrderPaymentRow key={order.id} order={order} canRecord={canRecord} />
          ))}
        </ul>
      )}
    </li>
  );
}

function OrderPaymentRow({ order, canRecord }: { order: PendingOrder; canRecord: boolean }) {
  const update = useUpdateOrder();
  const [recording, setRecording] = useState(false);
  const [amount, setAmount] = useState(String(order.pending));
  const [error, setError] = useState<string | null>(null);

  const amountValue = Number(amount);
  const amountValid = amount.trim() !== "" && amountValue > 0 && amountValue <= order.pending;

  const save = async (body: { advanceAmount: number } | { paymentStatus: "PAID" }) => {
    setError(null);
    try {
      await update.mutateAsync({ id: order.id, ...body });
      setRecording(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save payment");
    }
  };

  return (
    <li className="px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link
          to={`/orders/${order.orderNumber}`}
          className="font-medium text-slate-900 underline-offset-2 hover:text-brand-600 hover:underline"
        >
          {order.orderNumber}
        </Link>
        <StatusPill status={order.status} />
        <span className="ml-auto text-xs text-slate-500">{formatDay(order.deliveryDate)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 tabular-nums">
        <span>Total {formatINR(order.total)}</span>
        <span className="text-emerald-700">Received {formatINR(order.received)}</span>
        <span className="font-semibold text-amber-700">Pending {formatINR(order.pending)}</span>
        {canRecord && !recording && (
          <button
            type="button"
            onClick={() => {
              setAmount(String(order.pending));
              setError(null);
              setRecording(true);
            }}
            className="ml-auto rounded-md bg-white px-2 py-1 text-xs font-medium text-brand-600 ring-1 ring-slate-200 transition hover:ring-brand-500"
          >
            Record payment
          </button>
        )}
      </div>

      {recording && (
        <div className="mt-2 rounded-md border border-slate-200 bg-white p-2.5">
          <div>
            <span className="block text-xs font-medium text-slate-600">Amount received now</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="relative flex-1">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={order.pending}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-label="Amount received now"
                  className="w-full rounded-md border border-slate-200 py-1.5 pr-2 pl-6 text-sm tabular-nums outline-none focus:border-brand-500"
                />
              </span>
              <button
                type="button"
                disabled={!amountValid || update.isPending}
                onClick={() => void save({ advanceAmount: order.received + amountValue })}
                className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => void save({ paymentStatus: "PAID" })}
              className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
            >
              Mark fully paid
            </button>
            <button
              type="button"
              onClick={() => setRecording(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
          {amount.trim() !== "" && amountValue > order.pending && (
            <p className="mt-1.5 text-xs text-brand-700">
              More than the {formatINR(order.pending)} pending on this order.
            </p>
          )}
          {error && <p className="mt-1.5 text-xs text-brand-700">{error}</p>}
        </div>
      )}
    </li>
  );
}
