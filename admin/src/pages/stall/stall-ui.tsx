import { useState, type SelectHTMLAttributes } from "react";
import {
  Banknote,
  ChevronDown,
  Clock,
  MapPin,
  Minus,
  Plus,
  Search,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import {
  useStallSummary,
  type StallInfo,
  type StallMenuItem,
  type StallPaymentMethod,
  type StallSale,
  type StallSaleInput,
  type StallStatus,
  type StallTotals,
} from "@/hooks/useStalls";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/cn";
import { selectClass } from "@/components/form/Field";

/** The stall last picked at the counter or breakfast tab, so both open on the same one. */
export const STALL_KEY = "keyafe.stall.selected";

/** `selectClass` hides the native arrow, so draw one to make it read as a dropdown. */
export function Select({
  className,
  wrapperClassName,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  return (
    <span className={cn("relative inline-block max-w-full", wrapperClassName)}>
      <select {...props} className={cn(selectClass, "cursor-pointer pr-9", className)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </span>
  );
}

/** menuItemId → qty */
export type Cart = Record<string, number>;

export function cartLines(cart: Cart, menu: StallMenuItem[]) {
  return menu
    .filter((m) => (cart[m.id] ?? 0) > 0)
    .map((m) => ({ item: m, qty: cart[m.id]!, amount: m.price * cart[m.id]! }));
}

export function cartTotal(cart: Cart, menu: StallMenuItem[]) {
  return cartLines(cart, menu).reduce((sum, l) => sum + l.amount, 0);
}

export function cartToInput(
  cart: Cart,
  paymentMethod: StallPaymentMethod,
  dueFrom?: string,
): StallSaleInput {
  return {
    kind: "ITEMIZED",
    paymentMethod,
    items: Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, qty]) => ({ menuItemId, qty })),
    ...(paymentMethod === "DUE" ? { dueFrom } : {}),
  };
}

export function methodLabel(method: StallPaymentMethod) {
  return method === "CASH" ? "Cash" : method === "UPI" ? "UPI" : "Due";
}

export function TotalsStrip({ totals, className }: { totals: StallTotals; className?: string }) {
  const cells = [
    { label: "Cash", value: totals.cash, tone: "text-slate-900" },
    { label: "UPI", value: totals.upi, tone: "text-slate-900" },
    ...(totals.due > 0 ? [{ label: "Due", value: totals.due, tone: "text-amber-700" }] : []),
    { label: "Total", value: totals.total, tone: "text-emerald-700" },
  ];
  return (
    <div
      className={cn(
        "grid divide-x divide-slate-100",
        cells.length === 4 ? "grid-cols-4" : "grid-cols-3",
        className,
      )}
    >
      {cells.map((c) => (
        <div key={c.label} className="min-w-0 px-2 text-center first:pl-0 last:pr-0">
          <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
            {c.label}
          </p>
          <p className={cn("truncate text-lg font-semibold tabular-nums sm:text-xl", c.tone)}>
            {formatINR(c.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ItemPicker({
  menu,
  cart,
  onAdd,
  disabled,
}: {
  menu: StallMenuItem[];
  cart: Cart;
  onAdd: (itemId: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? menu.filter((m) => m.name.toLowerCase().includes(q)) : menu;

  return (
    <div>
      {menu.length > SEARCH_FROM && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && shown.length === 1 && shown[0]) {
                e.preventDefault();
                onAdd(shown[0].id);
              }
            }}
            placeholder={`Search ${menu.length} items`}
            aria-label="Search menu items"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-9 pl-9 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-center text-sm text-slate-500">
          No item matches “{query.trim()}”.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
          {shown.map((m) => {
            const qty = cart[m.id] ?? 0;
            return (
              <button
                key={m.id}
                type="button"
                disabled={disabled}
                onClick={() => onAdd(m.id)}
                title={m.name}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-left transition select-none active:scale-[0.97] disabled:opacity-50",
                  qty > 0
                    ? "border-brand-500 bg-brand-100/40 ring-1 ring-brand-500"
                    : "border-slate-200 hover:border-slate-300",
                )}
              >
                <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-tight font-medium text-slate-900">
                  {m.name}
                </span>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                  {formatINR(m.price)}
                </span>
                {qty > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-semibold text-white tabular-nums">
                    {qty}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Menus longer than this get a search box above the grid. */
const SEARCH_FROM = 8;

/** Cart lines with steppers and the two "take payment" buttons. */
export function CartPanel({
  menu,
  cart,
  setCart,
  onPay,
  saving,
}: {
  menu: StallMenuItem[];
  cart: Cart;
  setCart: (next: Cart) => void;
  onPay: (method: StallPaymentMethod, dueFrom?: string) => void;
  saving: boolean;
}) {
  const [askDue, setAskDue] = useState(false);
  const [dueFrom, setDueFrom] = useState("");
  const lines = cartLines(cart, menu);
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  if (lines.length === 0) return null;

  const setQty = (id: string, qty: number) => {
    const next = { ...cart };
    if (qty <= 0) delete next[id];
    else next[id] = qty;
    setCart(next);
  };

  return (
    <div className="rounded-card border border-slate-200 bg-white p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">
          {lines.reduce((n, l) => n + l.qty, 0)} item
          {lines.reduce((n, l) => n + l.qty, 0) === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={() => setCart({})}
          disabled={saving}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      </div>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {lines.map((l) => (
          <li key={l.item.id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-slate-700">{l.item.name}</span>
            <div className="flex shrink-0 items-center rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setQty(l.item.id, l.qty - 1)}
                disabled={saving}
                aria-label={`One less ${l.item.name}`}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center text-sm font-medium tabular-nums">{l.qty}</span>
              <button
                type="button"
                onClick={() => setQty(l.item.id, l.qty + 1)}
                disabled={saving}
                aria-label={`One more ${l.item.name}`}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <span className="w-16 shrink-0 text-right text-slate-900 tabular-nums">
              {formatINR(l.amount)}
            </span>
          </li>
        ))}
      </ul>
      {askDue ? (
        <form
          className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!dueFrom.trim() || saving) return;
            onPay("DUE", dueFrom.trim());
            setAskDue(false);
            setDueFrom("");
          }}
        >
          <label className="block text-xs font-medium text-amber-900">
            Who owes {formatINR(total)}?
            <input
              autoFocus
              value={dueFrom}
              onChange={(e) => setDueFrom(e.target.value)}
              maxLength={80}
              placeholder="Name, desk or company"
              className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAskDue(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!dueFrom.trim() || saving}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Save as due
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onPay("CASH")}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <Banknote className="h-5 w-5" /> Cash {formatINR(total)}
            </button>
            <button
              type="button"
              onClick={() => onPay("UPI")}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-3 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              <Smartphone className="h-5 w-5" /> UPI {formatINR(total)}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setAskDue(true)}
            disabled={saving}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
          >
            <Clock className="h-4 w-4" /> Not paid yet — mark as due
          </button>
        </>
      )}
    </div>
  );
}

const amountInputClass =
  "w-full rounded-lg border border-slate-200 bg-white py-2.5 pr-3 pl-7 text-base text-slate-900 tabular-nums placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none";

/** The day's full cash/UPI/due figure; once entered it replaces the tapped total. */
export function LumpSumForm({
  onSubmit,
  saving,
  tapped,
}: {
  onSubmit: (input: StallSaleInput) => Promise<void>;
  saving: boolean;
  tapped?: { cash: number; upi: number; due: number };
}) {
  const [cash, setCash] = useState("");
  const [upi, setUpi] = useState("");
  const [due, setDue] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [note, setNote] = useState("");
  const cashAmount = Math.max(Number(cash) || 0, 0);
  const upiAmount = Math.max(Number(upi) || 0, 0);
  const dueAmount = Math.max(Number(due) || 0, 0);
  const total = cashAmount + upiAmount + dueAmount;
  const ready = total > 0 && (dueAmount === 0 || dueFrom.trim() !== "");

  const submit = async () => {
    try {
      await onSubmit({
        kind: "CONSOLIDATED",
        cashAmount,
        upiAmount,
        ...(dueAmount > 0 ? { dueAmount, dueFrom: dueFrom.trim() } : {}),
        note: note.trim() || undefined,
      });
    } catch {
      return; // caller shows the error; keep the figures so they can retry
    }
    setCash("");
    setUpi("");
    setDue("");
    setDueFrom("");
    setNote("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !saving) void submit();
      }}
      className="space-y-3"
    >
      <p className="text-sm text-slate-500">
        Enter the full cash and UPI collected for the day, plus anything still owed — this replaces
        the tapped total.
      </p>
      {tapped && tapped.cash + tapped.upi + tapped.due > 0 && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Tapped so far: Cash {formatINR(tapped.cash)} · UPI {formatINR(tapped.upi)}
          {tapped.due > 0 && ` · Due ${formatINR(tapped.due)}`}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Cash", value: cash, set: setCash },
          { label: "UPI", value: upi, set: setUpi },
          { label: "Due", value: due, set: setDue },
        ].map((f) => (
          <label key={f.label} className="block">
            <span className="mb-1 block text-xs font-medium tracking-wide text-slate-500 uppercase">
              {f.label}
            </span>
            <span className="relative block">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">
                ₹
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder="0"
                className={amountInputClass}
              />
            </span>
          </label>
        ))}
      </div>
      {dueAmount > 0 && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium tracking-wide text-amber-800 uppercase">
            Who owes {formatINR(dueAmount)}?
          </span>
          <input
            value={dueFrom}
            onChange={(e) => setDueFrom(e.target.value)}
            maxLength={80}
            placeholder="Name, desk or company"
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
          />
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium tracking-wide text-slate-500 uppercase">
          Note <span className="font-normal normal-case">(optional)</span>
        </span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="e.g. Lunch rush 1–2 pm"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={!ready || saving}
        className="w-full rounded-xl bg-brand-500 px-4 py-3 text-base font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : total > 0 ? `Save ${formatINR(total)}` : "Save"}
      </button>
    </form>
  );
}

function saleSummary(sale: StallSale) {
  if (sale.kind === "CONSOLIDATED") return sale.note ? `Lump sum · ${sale.note}` : "Lump sum";
  return sale.items.map((i) => `${i.qty}× ${i.name}`).join(", ");
}

const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

/** Shown when a lump sum is in: tapped entries stay listed but don't count. */
export function LumpOverrideNote({
  tappedTotal,
  className,
}: {
  tappedTotal: number;
  className?: string;
}) {
  if (tappedTotal <= 0) return null;
  return (
    <p className={cn("rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800", className)}>
      Lump sum counted — tapped entries ({formatINR(tappedTotal)}) are not added.
    </p>
  );
}

export function saleAmount(sale: Pick<StallSale, "cashAmount" | "upiAmount" | "dueAmount">) {
  return sale.cashAmount + sale.upiAmount + sale.dueAmount;
}

const shortDateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

/** "Collect" → Cash / UPI; used wherever an unpaid due is listed. */
export function CollectDue({
  onCollect,
  busy,
}: {
  onCollect: (via: "CASH" | "UPI") => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-50"
      >
        Mark paid
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      {(["CASH", "UPI"] as const).map((via) => (
        <button
          key={via}
          type="button"
          disabled={busy}
          onClick={() => {
            onCollect(via);
            setOpen(false);
          }}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-semibold text-white transition disabled:opacity-50",
            via === "CASH"
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-indigo-600 hover:bg-indigo-700",
          )}
        >
          {methodLabel(via)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Cancel"
        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export function SaleList({
  sales,
  onDelete,
  deletingId,
  onSettle,
  settlingId,
  showAuthor,
  lumpOverride,
}: {
  sales: StallSale[];
  onDelete?: (sale: StallSale) => void;
  deletingId?: string | null;
  onSettle?: (sale: StallSale, via: "CASH" | "UPI") => void;
  settlingId?: string | null;
  showAuthor?: boolean;
  lumpOverride?: boolean;
}) {
  if (sales.length === 0) {
    return <p className="px-1 py-3 text-sm text-slate-500">No entries yet.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {sales.map((s) => {
        const covered = lumpOverride && s.kind === "ITEMIZED";
        return (
          <li key={s.id} className="flex items-start gap-3 py-2.5">
            <span className="w-16 shrink-0 pt-0.5 text-xs text-slate-400 tabular-nums">
              {timeFmt.format(new Date(s.createdAt))}
            </span>
            <div className={cn("min-w-0 flex-1", covered && "opacity-60")}>
              <p className="text-sm text-slate-800">{saleSummary(s)}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
                {s.cashAmount > 0 && <span>Cash {formatINR(s.cashAmount)}</span>}
                {s.upiAmount > 0 && <span>UPI {formatINR(s.upiAmount)}</span>}
                {s.dueAmount > 0 && (
                  <span className="font-medium text-amber-700">
                    Due {formatINR(s.dueAmount)}
                    {s.dueFrom && ` · ${s.dueFrom}`}
                  </span>
                )}
                {s.duePaidAt && (
                  <span className="text-emerald-700">
                    Due{s.dueFrom && ` from ${s.dueFrom}`} paid{" "}
                    {shortDateFmt.format(new Date(s.duePaidAt))}
                    {s.duePaidByName && ` · ${s.duePaidByName}`}
                  </span>
                )}
                {showAuthor && s.createdByName && <span>· {s.createdByName}</span>}
                {covered && <span className="text-amber-700">· covered by lump sum</span>}
              </p>
              {onSettle && s.dueAmount > 0 && !covered && (
                <div className="mt-1.5">
                  <CollectDue onCollect={(via) => onSettle(s, via)} busy={settlingId === s.id} />
                </div>
              )}
            </div>
            <span
              className={cn(
                "shrink-0 pt-0.5 text-sm font-semibold tabular-nums",
                covered ? "text-slate-400 line-through" : "text-slate-900",
              )}
            >
              {formatINR(saleAmount(s))}
            </span>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(s)}
                disabled={deletingId === s.id}
                aria-label="Remove entry"
                className="-mr-1 shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ItemsSold({ items }: { items: { name: string; qty: number; amount: number }[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-3 py-1.5">
          <span className="min-w-0 flex-1 truncate text-slate-700">{i.name}</span>
          <span className="shrink-0 text-slate-500 tabular-nums">×{i.qty}</span>
          <span className="w-20 shrink-0 text-right text-slate-900 tabular-nums">
            {formatINR(i.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** "12–14 Oct", "30 Sep – 2 Oct", or "12 Oct" for a one-day exhibition. */
export function formatStallDates(start: string | null, end: string | null) {
  if (!start || !end) return "";
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const month = (d: Date) => d.toLocaleDateString("en-IN", { month: "short" });
  const year = e.getFullYear() !== new Date().getFullYear() ? ` ${e.getFullYear()}` : "";
  if (start === end) return `${s.getDate()} ${month(s)}${year}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${month(e)}${year}`;
  }
  return `${s.getDate()} ${month(s)} – ${e.getDate()} ${month(e)}${year}`;
}

const STATUS_STYLE: Record<StallStatus, string> = {
  live: "bg-emerald-50 text-emerald-700",
  upcoming: "bg-sky-50 text-sky-700",
  ended: "bg-slate-100 text-slate-500",
};

export function StallStatusBadge({ stall }: { stall: Pick<StallInfo, "kind" | "status"> }) {
  if (stall.kind === "OFFICE") return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        STATUS_STYLE[stall.status],
      )}
    >
      {stall.status === "live" ? "Live" : stall.status === "upcoming" ? "Upcoming" : "Ended"}
    </span>
  );
}

/** Exhibition takings against the stall charge. */
export function StallSummaryCard({ stallId, className }: { stallId: string; className?: string }) {
  const { data } = useStallSummary(stallId);
  if (!data || data.stall.kind !== "EXHIBITION") return null;
  const { stall, totals, charge, net } = data;
  return (
    <div className={cn("rounded-card border border-slate-200 bg-white p-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold text-slate-900">{stall.name}</h2>
        <StallStatusBadge stall={stall} />
      </div>
      <p className="mt-0.5 text-xs text-slate-500">
        {formatStallDates(stall.startDate, stall.endDate)}
        {stall.days != null && ` · ${stall.days} day${stall.days === 1 ? "" : "s"}`}
      </p>
      {stall.location && (
        <p className="mt-1 flex items-start gap-1 text-xs whitespace-pre-line text-slate-500">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          {stall.location}
        </p>
      )}
      <TotalsStrip totals={totals} className="mt-4" />
      <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">
            Stall charge
            {stall.chargeBasis === "PER_DAY" && stall.days != null && charge > 0 && (
              <span className="text-xs">
                {" "}
                ({formatINR(stall.chargeAmount)}/day × {stall.days})
              </span>
            )}
          </dt>
          <dd className="text-slate-900 tabular-nums">− {formatINR(charge)}</dd>
        </div>
        <div className="flex justify-between gap-3 font-semibold">
          <dt className="text-slate-900">Net after charge</dt>
          <dd className={cn("tabular-nums", net < 0 ? "text-red-600" : "text-emerald-700")}>
            {formatINR(net)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function DayStatusPill({ status }: { status: "OPEN" | "CLOSED" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        status === "OPEN" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
      )}
    >
      {status === "OPEN" ? "Open" : "Closed"}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("flex rounded-lg border border-slate-200 bg-slate-50 p-0.5", className)}
    >
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
            value === o.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
