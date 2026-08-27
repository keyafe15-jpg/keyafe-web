import { Link } from "react-router-dom";
import { useCart } from "@/store/cart";
import { CART_COPY } from "@/content/misc";
import { cn } from "@/lib/cn";
import type { CartLine } from "@/types/domain";

export function CartPage() {
  const lines = useCart((s) => s.lines);
  const removeLine = useCart((s) => s.removeLine);
  const updateQty = useCart((s) => s.updateQty);
  const subtotal = useCart((s) => s.subtotal());
  const clear = useCart((s) => s.clear);

  if (lines.length === 0) return <EmptyCart />;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink-900">
            {CART_COPY.heading}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {lines.length} item{lines.length === 1 ? "" : "s"} · Review your
            order before checkout.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm("Empty your cart?")) clear();
          }}
          className="text-xs text-ink-500 hover:text-brand-500"
        >
          Clear cart
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <ul className="space-y-4">
          {lines.map((line) => (
            <CartLineCard
              key={line.id}
              line={line}
              onRemove={() => removeLine(line.id)}
              onQty={(n) => updateQty(line.id, n)}
            />
          ))}
        </ul>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-cream-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-display text-lg text-ink-900">
              Order summary
            </h2>
            <SummaryRow label={CART_COPY.subtotal} value={subtotal} />
            <SummaryRow
              label="Delivery"
              value={null}
              hint="Calculated at checkout"
            />
            <hr className="my-4 border-cream-200" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-700">Total</span>
              <span className="text-2xl font-semibold text-ink-900">
                ₹{subtotal.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-ink-500">
              Inclusive of GST · Delivery added at checkout.
            </p>

            <Link
              to="/checkout"
              className="mt-5 block w-full rounded-full bg-brand-500 py-3 text-center text-sm font-medium text-white transition hover:bg-brand-700"
            >
              {CART_COPY.proceed}
            </Link>
            <Link
              to="/"
              className="mt-2 block text-center text-xs text-ink-500 hover:text-brand-500"
            >
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

function CartLineCard({
  line,
  onRemove,
  onQty,
}: {
  line: CartLine;
  onRemove: () => void;
  onQty: (qty: number) => void;
}) {
  const lineTotal = line.unitPrice * line.qty;
  return (
    <li className="grid gap-4 rounded-card border border-cream-200 bg-white p-4 sm:grid-cols-[110px_1fr_auto]">
      <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-cream-100 sm:h-full sm:w-[110px]">
        {line.image ? (
          <img
            src={line.image}
            alt={line.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-400">
            <ImageIcon />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <Link
            to={`/product/${line.slug}`}
            className="font-medium text-ink-900 hover:text-brand-500"
          >
            {line.name}
          </Link>
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-md p-1.5 text-ink-400 transition hover:bg-cream-100 hover:text-brand-500"
            aria-label={CART_COPY.remove}
            title={CART_COPY.remove}
          >
            <TrashIcon />
          </button>
        </div>

        <dl className="mt-2 space-y-0.5 text-xs text-ink-500">
          {line.sizeLabel && <Detail label="Size" value={line.sizeLabel} />}
          {line.flavourName && (
            <Detail label="Flavour" value={line.flavourName} />
          )}
          {line.messageOnCake && (
            <Detail label="Message" value={`"${line.messageOnCake}"`} />
          )}
          {line.instructions && (
            <Detail label="Notes" value={line.instructions} />
          )}
          {(line.fulfillment || line.date || line.slotLabel) && (
            <Detail
              label={line.fulfillment === "pickup" ? "Pickup" : "Delivery"}
              value={[line.date, line.slotLabel].filter(Boolean).join(" · ")}
            />
          )}
        </dl>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-ink-500">
            ₹{line.unitPrice.toFixed(2)} each
          </span>
          <QtyStepper value={line.qty} onChange={onQty} />
        </div>
      </div>

      <div className="text-right sm:min-w-[110px]">
        <p className="text-[11px] uppercase tracking-wide text-ink-400">
          Total
        </p>
        <p className="text-lg font-semibold tabular-nums text-ink-900">
          ₹{lineTotal.toFixed(2)}
        </p>
      </div>
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-ink-400">{label}:</dt>
      <dd className="truncate text-ink-700">{value}</dd>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | null;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <span className="text-ink-700">{label}</span>
      <span
        className={cn("tabular-nums", value == null && "text-xs text-ink-500")}
      >
        {value == null ? hint : `₹${value.toFixed(2)}`}
      </span>
    </div>
  );
}

function QtyStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-cream-200 bg-white">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="px-2.5 py-1 text-lg text-ink-700 hover:text-brand-500"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="w-7 text-center text-sm tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="px-2.5 py-1 text-lg text-ink-700 hover:text-brand-500"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="M21 15l-5-5-8 8" />
    </svg>
  );
}

function EmptyCart() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-cream-100 text-brand-500">
        <svg
          width={32}
          height={32}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            d="M6 6h15l-1.5 9h-12z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M6 6L5 3H2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="19" r="1.5" />
          <circle cx="17" cy="19" r="1.5" />
        </svg>
      </div>
      <h1 className="mb-3 font-display text-3xl text-ink-900">
        {CART_COPY.empty.title}
      </h1>
      <p className="mb-6 text-ink-500">{CART_COPY.empty.body}</p>
      <Link
        to="/"
        className="inline-block rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        {CART_COPY.empty.cta}
      </Link>
    </section>
  );
}
