import { useState } from "react";
import { Banknote, Minus, Plus, Smartphone, Trash2, X } from "lucide-react";
import type { StallMenuItem, StallSale, StallSaleInput, StallTotals } from "@/hooks/useStalls";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/cn";

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

export function cartToInput(cart: Cart, paymentMethod: "CASH" | "UPI"): StallSaleInput {
  return {
    kind: "ITEMIZED",
    paymentMethod,
    items: Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, qty]) => ({ menuItemId, qty })),
  };
}

export function TotalsStrip({ totals, className }: { totals: StallTotals; className?: string }) {
  const cells = [
    { label: "Cash", value: totals.cash, tone: "text-slate-900" },
    { label: "UPI", value: totals.upi, tone: "text-slate-900" },
    { label: "Total", value: totals.total, tone: "text-emerald-700" },
  ];
  return (
    <div className={cn("grid grid-cols-3 divide-x divide-slate-100", className)}>
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
  return (
    <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
      {menu.map((m) => {
        const qty = cart[m.id] ?? 0;
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            onClick={() => onAdd(m.id)}
            className={cn(
              "relative flex min-h-18 flex-col items-start justify-between rounded-xl border bg-white p-2.5 text-left transition select-none active:scale-[0.97] disabled:opacity-50",
              qty > 0
                ? "border-brand-500 bg-brand-100/40 ring-1 ring-brand-500"
                : "border-slate-200 hover:border-slate-300",
            )}
          >
            <span className="line-clamp-2 pr-5 text-sm leading-tight font-medium text-slate-900">
              {m.name}
            </span>
            <span className="mt-1 text-xs text-slate-500 tabular-nums">{formatINR(m.price)}</span>
            {qty > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-semibold text-white tabular-nums">
                {qty}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

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
  onPay: (method: "CASH" | "UPI") => void;
  saving: boolean;
}) {
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
    </div>
  );
}

const amountInputClass =
  "w-full rounded-lg border border-slate-200 bg-white py-2.5 pr-3 pl-7 text-base text-slate-900 tabular-nums placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none";

/** Consolidated cash/UPI figure for when there was no time to tap items. */
export function LumpSumForm({
  onSubmit,
  saving,
}: {
  onSubmit: (input: StallSaleInput) => Promise<void>;
  saving: boolean;
}) {
  const [cash, setCash] = useState("");
  const [upi, setUpi] = useState("");
  const [note, setNote] = useState("");
  const cashAmount = Math.max(Number(cash) || 0, 0);
  const upiAmount = Math.max(Number(upi) || 0, 0);
  const total = cashAmount + upiAmount;

  const submit = async () => {
    try {
      await onSubmit({
        kind: "CONSOLIDATED",
        cashAmount,
        upiAmount,
        note: note.trim() || undefined,
      });
    } catch {
      return; // caller shows the error; keep the figures so they can retry
    }
    setCash("");
    setUpi("");
    setNote("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (total > 0 && !saving) void submit();
      }}
      className="space-y-3"
    >
      <p className="text-sm text-slate-500">
        No time to tap items? Enter the total you collected — it adds to today&rsquo;s sales.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Cash", value: cash, set: setCash },
          { label: "UPI", value: upi, set: setUpi },
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
        disabled={total <= 0 || saving}
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

export function SaleList({
  sales,
  onDelete,
  deletingId,
  showAuthor,
}: {
  sales: StallSale[];
  onDelete?: (sale: StallSale) => void;
  deletingId?: string | null;
  showAuthor?: boolean;
}) {
  if (sales.length === 0) {
    return <p className="px-1 py-3 text-sm text-slate-500">No entries yet.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {sales.map((s) => (
        <li key={s.id} className="flex items-start gap-3 py-2.5">
          <span className="w-16 shrink-0 pt-0.5 text-xs text-slate-400 tabular-nums">
            {timeFmt.format(new Date(s.createdAt))}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-800">{saleSummary(s)}</p>
            <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
              {s.cashAmount > 0 && <span>Cash {formatINR(s.cashAmount)}</span>}
              {s.upiAmount > 0 && <span>UPI {formatINR(s.upiAmount)}</span>}
              {showAuthor && s.createdByName && <span>· {s.createdByName}</span>}
            </p>
          </div>
          <span className="shrink-0 pt-0.5 text-sm font-semibold text-slate-900 tabular-nums">
            {formatINR(s.cashAmount + s.upiAmount)}
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
      ))}
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
