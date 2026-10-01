import { useState, type ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, Download, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useAddStallBreakfast,
  useCreateStallBreakfastBill,
  useDeleteStallBreakfast,
  useDownloadBreakfastStatement,
  useManageStalls,
  useStalls,
  useStallBreakfastMonth,
  useUpdateStall,
  useUpdateStallBreakfast,
  type StallBreakfastEntry,
  type StallBreakfastMonth,
  type Stall,
} from "@/hooks/useStalls";
import { formatDayShort, toInputDate } from "@/lib/dateRange";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/form/Field";
import { useStaffPermission } from "@/lib/permissions";
import { STALL_KEY, Select } from "./stall-ui";
import { BreakfastForm, breakfastLine } from "./StallBreakfast";

const NO_STALLS: Stall[] = [];

const PAYMENT_PILL: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  PAID: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-700",
  REFUNDED: "bg-slate-100 text-slate-600",
};

/** Office breakfast by month: check the plates, then raise the company's bill. */
export function StallBreakfastPanel() {
  const canManage = useStaffPermission("stall.manage");
  const managed = useManageStalls(canManage);
  const counter = useStalls(!canManage);
  const { data: stalls = NO_STALLS, isLoading } = canManage ? managed : counter;
  const offices = stalls.filter((s) => s.kind === "OFFICE");
  const [stallId, setStallId] = useState(() => localStorage.getItem(STALL_KEY));
  const stall = offices.find((s) => s.id === stallId) ?? offices[0] ?? null;
  const thisMonth = toInputDate(new Date()).slice(0, 7);
  const [params] = useSearchParams();
  const [month, setMonth] = useState(() => {
    const linked = params.get("month");
    return linked && /^\d{4}-(0[1-9]|1[0-2])$/.test(linked) && linked <= thisMonth
      ? linked
      : thisMonth;
  });

  if (isLoading) return <div className="p-8 text-center text-sm text-slate-500">Loading…</div>;
  if (!stall) {
    return (
      <div className="rounded-card border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        {canManage ? (
          <>
            Breakfast billing is for office stalls. Add one under{" "}
            <Link to="/stall/menu" className="font-medium text-brand-600 underline">
              Stalls &amp; menus
            </Link>
            .
          </>
        ) : (
          "Breakfast is for office stalls, and none is running."
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-card border border-slate-200 bg-white p-3 sm:p-4">
        {offices.length > 1 && (
          <Select
            value={stall.id}
            onChange={(e) => {
              localStorage.setItem(STALL_KEY, e.target.value);
              setStallId(e.target.value);
            }}
            aria-label="Stall"
            className="w-auto py-1.5"
          >
            {offices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <input
          type="month"
          value={month}
          max={thisMonth}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          aria-label="Month"
          className={cn(inputClass, "w-auto py-1.5")}
        />
        <p className="ml-auto text-xs text-slate-500">
          Breakfast is billed to the company monthly, not counted in daily cash/UPI.
        </p>
      </div>
      <BreakfastMonth
        key={`${stall.id}:${month}`}
        stall={stall}
        month={month}
        canManage={canManage}
      />
    </div>
  );
}

function BreakfastMonth({
  stall,
  month,
  canManage,
}: {
  stall: Stall;
  month: string;
  canManage: boolean;
}) {
  const { data, isLoading, isError, error } = useStallBreakfastMonth(stall.id, month);
  const add = useAddStallBreakfast(stall.id);
  const update = useUpdateStallBreakfast();
  const del = useDeleteStallBreakfast();
  const bill = useCreateStallBreakfastBill(stall.id);
  const statement = useDownloadBreakfastStatement();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const today = toInputDate(new Date());
  const monthEnd = toInputDate(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
  const monthStart = `${month}-01`;
  // Counter staff can only log days inside the counter window, like sales.
  const counterWindow = canManage ? null : stall.counterWindow;
  const latest = counterWindow && counterWindow.to < today ? counterWindow.to : today;
  const maxDate = monthEnd < latest ? monthEnd : latest;
  const minDate =
    counterWindow && counterWindow.from > monthStart ? counterWindow.from : monthStart;
  const canAdd = (canManage || !!counterWindow) && minDate <= maxDate;

  if (isLoading) return <p className="py-6 text-center text-sm text-slate-500">Loading…</p>;
  if (isError || !data) {
    return (
      <p className="py-6 text-center text-sm text-red-600">
        {error instanceof Error ? error.message : "Could not load breakfast."}
      </p>
    );
  }

  const fail = (err: unknown, fallback: string) =>
    setMessage({ tone: "error", text: err instanceof Error ? err.message : fallback });

  const billTo = data.stall;
  const billReady = !!billTo.billToName && !!billTo.billToPhone;
  const monthOver = monthEnd < today;

  const createBill = () => {
    const warn = monthOver ? "" : `\n\n${data.monthLabel} isn't over yet.`;
    if (
      !confirm(
        `Bill ${billTo.billToName} ${formatINR(data.totals.unbilledAmount)} for ${data.totals.unbilledCount} breakfast entr${data.totals.unbilledCount === 1 ? "y" : "ies"}? This issues a GST invoice.${warn}`,
      )
    ) {
      return;
    }
    setMessage(null);
    bill.mutate(month, {
      onSuccess: (order) =>
        setMessage({ tone: "ok", text: `Bill raised as order ${order.orderNumber}.` }),
      onError: (err) => fail(err, "Could not create the bill"),
    });
  };

  const remove = (e: StallBreakfastEntry) => {
    if (!confirm(`Remove ${formatDayShort(e.date)} · ${breakfastLine(e)}?`)) return;
    setMessage(null);
    del.mutate(e.id, { onError: (err) => fail(err, "Could not remove") });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Plates", value: String(data.totals.plates) },
          { label: "Days", value: String(data.totals.days) },
          { label: "Total", value: formatINR(data.totals.amount) },
          { label: "Not billed", value: formatINR(data.totals.unbilledAmount) },
        ].map((t) => (
          <div key={t.label} className="rounded-card border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
              {t.label}
            </p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">{t.value}</p>
          </div>
        ))}
      </div>

      {message && (
        <p
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            message.tone === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800",
          )}
        >
          {message.text}
        </p>
      )}

      {canManage && <BillToCard stall={stall} billTo={billTo} />}

      <section className="rounded-card border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{data.monthLabel}</h2>
          {canAdd && (
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add a day
            </button>
          )}
        </div>
        {adding && canAdd && (
          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <BreakfastForm
              withDate
              minDate={minDate}
              maxDate={maxDate}
              initial={data.last}
              menu={stall.menu}
              itemNames={data.itemNames}
              saving={add.isPending}
              onSubmit={async (input) => {
                setMessage(null);
                try {
                  await add.mutateAsync(input);
                  setAdding(false);
                } catch (err) {
                  fail(err, "Could not save");
                  throw err;
                }
              }}
            />
          </div>
        )}
        {data.entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No breakfast logged in {data.monthLabel}.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {data.entries.map((e) =>
              editingId === e.id ? (
                <li key={e.id} className="py-3">
                  <BreakfastForm
                    withDate
                    maxDate={maxDate}
                    initial={e}
                    menu={stall.menu}
                    itemNames={data.itemNames}
                    submitLabel="Save"
                    saving={update.isPending}
                    onSubmit={async (input) => {
                      setMessage(null);
                      try {
                        await update.mutateAsync({ id: e.id, ...input });
                        setEditingId(null);
                      } catch (err) {
                        fail(err, "Could not save");
                        throw err;
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                </li>
              ) : (
                <EntryRow
                  key={e.id}
                  entry={e}
                  onEdit={canManage ? () => setEditingId(e.id) : undefined}
                  onDelete={canManage || e.date === today ? () => remove(e) : undefined}
                  deleting={del.isPending && del.variables === e.id}
                />
              ),
            )}
          </ul>
        )}
      </section>

      {canManage && (
        <BillsSection
          data={data}
          billReady={billReady}
          creating={bill.isPending}
          onCreate={createBill}
          downloading={statement.isPending}
          onStatement={() =>
            statement.mutate(
              { stallId: stall.id, month },
              { onError: (err) => fail(err, "Could not download the statement") },
            )
          }
        />
      )}
    </div>
  );
}

function EntryRow({
  entry,
  onEdit,
  onDelete,
  deleting,
}: {
  entry: StallBreakfastEntry;
  onEdit?: () => void;
  onDelete?: () => void;
  deleting: boolean;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="w-20 shrink-0 text-xs font-medium text-slate-600">
        {formatDayShort(entry.date)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-900">{breakfastLine(entry)}</p>
        <p className="truncate text-xs text-slate-500">{entry.items}</p>
      </div>
      <span className="text-sm font-semibold text-slate-900 tabular-nums">
        {formatINR(entry.amount)}
      </span>
      {entry.orderId ? (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          Billed
        </span>
      ) : (
        <span className="flex shrink-0 items-center">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit breakfast entry"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              aria-label="Remove breakfast entry"
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </span>
      )}
    </li>
  );
}

function BillsSection({
  data,
  billReady,
  creating,
  onCreate,
  downloading,
  onStatement,
}: {
  data: StallBreakfastMonth;
  billReady: boolean;
  creating: boolean;
  onCreate: () => void;
  downloading: boolean;
  onStatement: () => void;
}) {
  const canBill = billReady && data.totals.unbilledCount > 0;
  return (
    <section className="rounded-card border border-slate-200 bg-white px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <FileText className="h-4 w-4 text-slate-400" /> Month-end bill
      </h2>
      {data.bills.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100">
          {data.bills.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <Link
                to={`/orders/${b.orderNumber}`}
                className="font-mono text-sm font-medium text-brand-600 hover:underline"
              >
                {b.orderNumber}
              </Link>
              <span className="font-mono text-xs text-slate-500">
                {b.invoiceNumber ?? "Invoice not issued"}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  PAYMENT_PILL[b.paymentStatus] ?? "bg-slate-100 text-slate-600",
                )}
              >
                {b.paymentStatus === "PAID" ? "Paid" : "Payment pending"}
              </span>
              <span className="ml-auto text-sm font-semibold text-slate-900 tabular-nums">
                {formatINR(b.total)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-500">
        {data.bills.length > 0
          ? "Open the order for the tax invoice and to mark it paid when the company pays."
          : "Creates one order for the company with a line per day and issues its GST invoice. It shows under Pending until marked paid."}
      </p>
      {!billReady && data.totals.unbilledCount > 0 && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          Add the company&rsquo;s name and phone under Bill to first.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {data.totals.unbilledCount > 0 && (
          <button
            type="button"
            onClick={onCreate}
            disabled={!canBill || creating}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : `Create bill · ${formatINR(data.totals.unbilledAmount)}`}
          </button>
        )}
        {data.entries.length > 0 && (
          <button
            type="button"
            onClick={onStatement}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Preparing…" : "Download statement"}
          </button>
        )}
      </div>
    </section>
  );
}

function BillToCard({ stall, billTo }: { stall: Stall; billTo: StallBreakfastMonth["stall"] }) {
  const update = useUpdateStall();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    name: billTo.billToName ?? "",
    phone: billTo.billToPhone ?? "",
    email: billTo.billToEmail ?? "",
    gstin: billTo.billToGstin ?? "",
    line1: billTo.billToAddress?.line1 ?? "",
    line2: billTo.billToAddress?.line2 ?? "",
    city: billTo.billToAddress?.city ?? "",
    pincode: billTo.billToAddress?.pincode ?? "",
  }));
  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = () => {
    setError(null);
    update.mutate(
      {
        id: stall.id,
        billToName: form.name.trim() || null,
        billToPhone: form.phone.trim() || null,
        billToEmail: form.email.trim() || null,
        billToGstin: form.gstin.trim() || null,
        billToAddress: form.line1.trim()
          ? {
              line1: form.line1.trim(),
              line2: form.line2.trim() || null,
              city: form.city.trim() || null,
              pincode: form.pincode.trim() || null,
            }
          : null,
      },
      {
        onSuccess: () => setEditing(false),
        onError: (err) => setError(err instanceof Error ? err.message : "Could not save"),
      },
    );
  };

  const address = billTo.billToAddress;
  const addressText = address
    ? [address.line1, address.line2, [address.city, address.pincode].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <section className="rounded-card border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Building2 className="h-4 w-4 text-slate-400" /> Bill to
        </h2>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            {billTo.billToName ? "Edit" : "Add company"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={form.name}
              onChange={set("name")}
              placeholder="Company name"
              aria-label="Company name"
              className={inputClass}
            />
            <input
              value={form.phone}
              onChange={set("phone")}
              placeholder="Phone"
              aria-label="Company phone"
              className={inputClass}
            />
            <input
              value={form.email}
              onChange={set("email")}
              placeholder="Email (optional)"
              aria-label="Company email"
              className={inputClass}
            />
            <input
              value={form.gstin}
              onChange={set("gstin")}
              placeholder="GSTIN (optional)"
              aria-label="Company GSTIN"
              className={cn(inputClass, "uppercase")}
            />
            <input
              value={form.line1}
              onChange={set("line1")}
              placeholder="Address line 1"
              aria-label="Address line 1"
              className={cn(inputClass, "sm:col-span-2")}
            />
            <input
              value={form.line2}
              onChange={set("line2")}
              placeholder="Address line 2 (optional)"
              aria-label="Address line 2"
              className={cn(inputClass, "sm:col-span-2")}
            />
            <input
              value={form.city}
              onChange={set("city")}
              placeholder="City"
              aria-label="City"
              className={inputClass}
            />
            <input
              value={form.pincode}
              onChange={set("pincode")}
              placeholder="PIN code"
              inputMode="numeric"
              aria-label="PIN code"
              className={inputClass}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={update.isPending || !form.name.trim() || !form.phone.trim()}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : billTo.billToName ? (
        <div className="mt-1.5 text-sm text-slate-700">
          <p className="font-medium text-slate-900">{billTo.billToName}</p>
          <p className="text-xs text-slate-500">
            {[
              billTo.billToPhone,
              billTo.billToEmail,
              billTo.billToGstin && `GSTIN ${billTo.billToGstin}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {addressText && <p className="text-xs text-slate-500">{addressText}</p>}
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-slate-500">
          Who pays the monthly breakfast bill. Printed on the invoice and statement.
        </p>
      )}
    </section>
  );
}
