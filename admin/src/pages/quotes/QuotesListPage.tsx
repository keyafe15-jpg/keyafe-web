import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  MessageCircle,
  Phone,
} from "lucide-react";
import {
  useAdminQuotes,
  useUpdateQuote,
  type QuoteRequest,
  type QuoteStatus,
} from "@/hooks/useAdminQuotes";
import { cn } from "@/lib/cn";

const TABS: { key: QuoteStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "QUOTED", label: "Quoted" },
  { key: "CONVERTED", label: "Converted" },
  { key: "CLOSED", label: "Closed" },
];

const STATUS_TONE: Record<QuoteStatus, string> = {
  NEW: "bg-brand-100 text-brand-700",
  CONTACTED: "bg-amber-50 text-amber-800",
  QUOTED: "bg-sky-50 text-sky-800",
  CONVERTED: "bg-emerald-50 text-emerald-800",
  CLOSED: "bg-slate-100 text-slate-600",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}

export function QuotesListPage() {
  const [tab, setTab] = useState<QuoteStatus | "ALL">("ALL");
  const { data: quotes = [], isLoading } = useAdminQuotes(tab);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: quotes.length };
    for (const q of quotes) c[q.status] = (c[q.status] ?? 0) + 1;
    return c;
  }, [quotes]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Quote Requests
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Custom-design requests from the storefront Get a Quote form.
        </p>
      </div>

      <div className="mb-5 -mx-4 overflow-x-auto sm:mx-0">
        <div className="mx-4 inline-flex min-w-full flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 sm:mx-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition",
                tab === t.key
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {t.label}
              {tab === "ALL" && (counts[t.key] ?? 0) > 0 && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 text-[10px] font-bold",
                    tab === t.key
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-700",
                  )}
                >
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        )}
        {!isLoading && quotes.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-500">
            No quote requests yet.
          </div>
        )}
        {!isLoading && quotes.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {quotes.map((quote) => (
              <QuoteRow key={quote.id} quote={quote} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function QuoteRow({ quote }: { quote: QuoteRequest }) {
  const [open, setOpen] = useState(quote.status === "NEW");
  const update = useUpdateQuote();
  const [adminNotes, setAdminNotes] = useState(quote.adminNotes ?? "");
  const [quotedAmount, setQuotedAmount] = useState(
    quote.quotedAmount ? String(Number(quote.quotedAmount)) : "",
  );
  const [status, setStatus] = useState<QuoteStatus>(quote.status);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAdminNotes(quote.adminNotes ?? "");
    setQuotedAmount(
      quote.quotedAmount ? String(Number(quote.quotedAmount)) : "",
    );
    setStatus(quote.status);
  }, [quote]);

  const save = async () => {
    setError(null);
    const amountRaw = quotedAmount.trim();
    const amount =
      amountRaw === "" ? null : Number(amountRaw.replace(/[^\d.]/g, ""));
    if (amountRaw !== "" && (!Number.isFinite(amount) || (amount ?? 0) < 0)) {
      setError("Enter a valid quote amount");
      return;
    }
    try {
      await update.mutateAsync({
        id: quote.id,
        status,
        adminNotes: adminNotes.trim() || null,
        quotedAmount: amount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition",
            open && "rotate-180",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-900">{quote.name}</p>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                STATUS_TONE[quote.status],
              )}
            >
              {quote.status}
            </span>
            {quote.quotedAmount && (
              <span className="text-xs font-medium text-slate-700">
                ₹{Number(quote.quotedAmount).toFixed(0)}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {quote.phone} · wants {formatDate(quote.deliveryDate)} · received{" "}
            {formatDate(quote.createdAt)}
          </p>
          <p className="mt-1 line-clamp-1 text-sm text-slate-600">
            {quote.description}
          </p>
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-12">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Customer
              </p>
              <p className="mt-1 text-sm text-slate-900">{quote.name}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <a
                  href={`tel:${quote.phone}`}
                  className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
                >
                  <Phone className="h-3 w-3" />
                  {quote.phone}
                </a>
                <a
                  href={whatsappHref(quote.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                >
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </a>
              </div>
              {quote.email && (
                <a
                  href={`mailto:${quote.email}`}
                  className="mt-1 block text-xs text-slate-600 hover:underline"
                >
                  {quote.email}
                </a>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Delivery
              </p>
              <p className="mt-1 text-sm text-slate-900">
                {formatDate(quote.deliveryDate)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                {quote.address}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Request
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
              {quote.description}
            </p>
            {quote.notes && (
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-medium text-slate-700">Notes: </span>
                {quote.notes}
              </p>
            )}
          </div>

          {quote.referenceImages.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                References
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {quote.referenceImages.map((src) => (
                  <a
                    key={src}
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    <img
                      src={src}
                      alt="Reference"
                      className="h-20 w-20 object-cover"
                    />
                    <span className="absolute right-1 top-1 rounded bg-black/50 p-0.5 text-white opacity-0 group-hover:opacity-100">
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-medium text-slate-600">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as QuoteStatus)}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
              >
                {TABS.filter((t) => t.key !== "ALL").map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Quoted amount (₹)
              <input
                type="text"
                inputMode="decimal"
                value={quotedAmount}
                onChange={(e) => setQuotedAmount(e.target.value)}
                placeholder="Optional"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 sm:col-span-1">
              Internal notes
              <input
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Not visible to customer"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
              />
            </label>
          </div>

          {error && <p className="text-xs text-brand-700">{error}</p>}

          <button
            type="button"
            onClick={() => void save()}
            disabled={update.isPending}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {update.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </li>
  );
}
