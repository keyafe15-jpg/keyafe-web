import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Copy,
  Ban,
  Package,
  Sparkles,
  ExternalLink,
  Check,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  useAdminOrderLinks,
  useDeleteOrderLink,
  useUpdateOrderLink,
  type OrderLink,
  type OrderLinkStatus,
} from "@/hooks/useAdminOrderLinks";
import { cn } from "@/lib/cn";
import { orderLinkUrl } from "@/lib/storefront";
import {
  LINK_DRAFT_KEY,
  PLACE_DRAFT_KEY,
  clearDraft,
  peekDraft,
} from "@/lib/offlineOrderDraft";

const TABS: { key: OrderLinkStatus; label: string }[] = [
  { key: "OPEN", label: "Open" },
  { key: "EXPIRED", label: "Expired" },
  { key: "CANCELLED", label: "Cancelled" },
];

function DraftBanner({
  title,
  summary,
  kindLabel,
  to,
  onDiscard,
}: {
  title: string;
  summary: string;
  kindLabel: string;
  to: string;
  onDiscard: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{title}</p>
        <p className="truncate text-xs text-slate-500">
          {kindLabel}
          {summary ? ` · ${summary}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase">
          Draft
        </span>
        <div className="flex items-center gap-1.5">
          <Link
            to={to}
            className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-slate-700"
          >
            Continue
          </Link>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrderLinksListPage() {
  const [tab, setTab] = useState<OrderLinkStatus>("OPEN");
  const { data: links = [], isLoading } = useAdminOrderLinks(tab);
  const [draftTick, setDraftTick] = useState(0);
  const placeDraft = peekDraft(PLACE_DRAFT_KEY);
  const linkDraft = peekDraft(LINK_DRAFT_KEY);
  void draftTick;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Offline orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            Two ways to place an order without the storefront checkout — send a pre-filled link on
            WhatsApp, or enter the whole thing yourself for a phone customer.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to="/offline-orders/place"
            className="hover:bg-brand-50 inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-500 bg-white px-3 py-2 text-sm font-medium text-brand-700 transition"
          >
            <Plus className="h-4 w-4" /> Enter full details
          </Link>
          <Link
            to="/offline-orders/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Send link to customer
          </Link>
        </div>
      </div>

      {(placeDraft || linkDraft) && (
        <div className="mb-4 space-y-2">
          {placeDraft && (
            <DraftBanner
              title={placeDraft.title}
              summary={placeDraft.summary}
              kindLabel={placeDraft.kindLabel}
              to="/offline-orders/place"
              onDiscard={() => {
                clearDraft(PLACE_DRAFT_KEY);
                setDraftTick((n) => n + 1);
              }}
            />
          )}
          {linkDraft && (
            <DraftBanner
              title={linkDraft.title}
              summary={linkDraft.summary}
              kindLabel={linkDraft.kindLabel}
              to="/offline-orders/new"
              onDiscard={() => {
                clearDraft(LINK_DRAFT_KEY);
                setDraftTick((n) => n + 1);
              }}
            />
          )}
        </div>
      )}

      <div className="mb-5">
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition",
                tab === t.key
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && links.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-500">
            {tab === "OPEN"
              ? "No open links. "
              : tab === "EXPIRED"
                ? "No expired links. "
                : "No cancelled links. "}
            <Link to="/offline-orders/new" className="text-brand-500 hover:underline">
              Send a link
            </Link>
            {" or "}
            <Link to="/offline-orders/place" className="text-brand-500 hover:underline">
              enter full details
            </Link>
            .
          </div>
        )}
        {!isLoading && links.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {links.map((link) => (
              <LinkRow key={link.id} link={link} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LinkRow({ link }: { link: OrderLink }) {
  const [copied, setCopied] = useState(false);
  const update = useUpdateOrderLink();
  const del = useDeleteOrderLink();
  const url = orderLinkUrl(link.token);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const firstItem = link.items[0];
  const extraItemCount = link.items.length - 1;
  const totalPrice = link.items.reduce((sum, it) => sum + Number(it.unitPrice) * it.qty, 0);

  const itemLines = link.items
    .map((it) => {
      const spec = [it.sizeLabel, it.flavourName].filter(Boolean).join(" · ");
      const qtyPart = it.qty > 1 ? ` × ${it.qty}` : "";
      return `🎂 ${it.productName}${spec ? ` · ${spec}` : ""}${qtyPart} — ₹${(Number(it.unitPrice) * it.qty).toFixed(0)}`;
    })
    .join("\n");
  const whatsappMessage = `Hi ${link.customerName ? link.customerName : ""}👋 Your order link:\n\n${itemLines}\n💰 Total: ₹${totalPrice.toFixed(0)}\n\nTap to confirm: ${url}`;
  const whatsappHref = link.customerPhone
    ? `https://wa.me/${link.customerPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(whatsappMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-20 sm:w-20">
        {firstItem?.referenceImageUrl ? (
          <img src={firstItem.referenceImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            {firstItem?.kind === "CATALOG" ? (
              <Package className="h-6 w-6" />
            ) : (
              <Sparkles className="h-6 w-6" />
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {firstItem && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                    firstItem.kind === "CATALOG"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-brand-100 text-brand-700",
                  )}
                >
                  {firstItem.kind === "CATALOG" ? (
                    <Package className="h-3 w-3" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {firstItem.kind}
                </span>
              )}
              <StatusPill status={link.status} />
            </div>
            <p className="mt-1 truncate font-medium text-slate-900">
              {firstItem?.productName}
              {extraItemCount > 0 && (
                <span className="ml-1 text-xs font-normal text-slate-500">
                  +{extraItemCount} more item{extraItemCount === 1 ? "" : "s"}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-slate-500">
              {firstItem &&
                [firstItem.sizeLabel, firstItem.flavourName].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900 tabular-nums">
              ₹{totalPrice.toFixed(0)}
            </p>
            <p className="text-[11px] text-slate-500">
              {new Date(link.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}
              {link.expiresAt &&
                ` · exp ${new Date(link.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
            /o/{link.token}
          </code>
          <button
            onClick={copyUrl}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
            title="Copy full URL"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-600" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy URL
              </>
            )}
          </button>
          {link.status === "OPEN" && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-600"
              title="Open in WhatsApp"
            >
              <svg
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12.05 22a10 10 0 1 1 8.68-15L22 3l-1.35 4.95A10 10 0 0 1 12.05 22zm-1-4h.05a8 8 0 0 0 6.75-3.63l-4.68-1.87c-.19-.08-.36-.03-.5.15l-.9 1.1c-1.13-.5-2.17-1.16-3.1-1.94-.66-.55-1.24-1.2-1.72-1.9l1.1-.87c.16-.14.2-.34.12-.53L6.4 4.13c-.35-.86-.35-1.13-1.4-1.13H3.65C3 3 2.5 3.5 2.5 4.15c0 5.7 4.9 13.85 8.55 13.85z" />
              </svg>
              WhatsApp
            </a>
          )}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
            title="Open customer view"
          >
            <ExternalLink className="h-3 w-3" /> Preview
          </a>
          {link.status === "OPEN" && (
            <>
              <Link
                to={`/offline-orders/${link.id}/edit`}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
                title="Edit link"
              >
                <Pencil className="h-3 w-3" /> Edit
              </Link>
              <button
                onClick={() => {
                  if (confirm("Cancel this link? Customer will see it as cancelled.")) {
                    update.mutate({ id: link.id, status: "CANCELLED" });
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-brand-500 hover:text-brand-700"
                title="Cancel"
              >
                <Ban className="h-3 w-3" /> Cancel
              </button>
            </>
          )}
          {!link.linkedOrder && (
            <button
              onClick={() => {
                const warning =
                  link.status === "OPEN"
                    ? "Delete this link? The customer won't be able to open it any more."
                    : "Delete this link?";
                if (!confirm(warning)) return;
                del.mutate(link.id, {
                  onError: (err) =>
                    alert(err instanceof Error ? err.message : "Could not delete the link"),
                });
              }}
              disabled={del.isPending}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-red-600 hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
              title="Delete link"
            >
              <Trash2 className="h-3 w-3" /> {del.isPending ? "Deleting…" : "Delete"}
            </button>
          )}
          {link.linkedOrder && (
            <Link
              to={`/orders/${link.linkedOrder.orderNumber}`}
              className="text-[11px] font-medium text-brand-700 hover:underline"
            >
              → {link.linkedOrder.orderNumber}
            </Link>
          )}
        </div>

        {link.adminNotes && (
          <p className="mt-2 text-xs text-slate-500 italic">📝 {link.adminNotes}</p>
        )}
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: OrderLinkStatus }) {
  const map: Record<OrderLinkStatus, string> = {
    OPEN: "bg-slate-100 text-slate-700",
    ORDERED: "bg-emerald-50 text-emerald-700",
    EXPIRED: "bg-amber-50 text-amber-700",
    CANCELLED: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        map[status],
      )}
    >
      {status}
    </span>
  );
}
