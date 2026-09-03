import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react";
import {
  useAdminOrderLink,
  useCreateOrderLink,
  useUpdateOrderLink,
  type CreateOrderLinkPayload,
  type OrderLinkItemPayload,
} from "@/hooks/useAdminOrderLinks";
import { useFlavours } from "@/hooks/useFlavours";
import {
  Field,
  inputClass,
  textareaClass,
  submitClass,
} from "@/components/form/Field";
import { ManualDiscountFields } from "@/components/form/ManualDiscountFields";
import {
  manualDiscountRupees,
  type ManualDiscountType,
} from "@/lib/manualDiscount";
import {
  OrderItemsEditor,
  orderLinkItemToDraft,
  resolveReferenceImageUrl,
  toOrderLinkItemPayload,
  useOrderItemRefPreviews,
  useOrderItemsState,
  validateOrderItems,
} from "@/components/order-items";
import { useAdminToppings } from "@/hooks/useToppings";
import { cn } from "@/lib/cn";

function publicUrl(token: string): string {
  const base = window.location.origin.replace(/:517[5-9]$/, ":5173");
  return `${base}/o/${token}`;
}

export function OrderLinkFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const create = useCreateOrderLink();
  const update = useUpdateOrderLink();
  const { data: existing } = useAdminOrderLink(id);
  const { data: flavours = [] } = useFlavours();
  const { data: allToppings = [] } = useAdminToppings();
  const { items, setItems, patchItem, removeItem, addItem } =
    useOrderItemsState("CUSTOM");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("7");
  const [discountType, setDiscountType] = useState<ManualDiscountType>("FLAT");
  const [discountValue, setDiscountValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    token: string;
    url: string;
  } | null>(null);

  useOrderItemRefPreviews(items, setItems);

  // Prefill from existing link on edit.
  useEffect(() => {
    if (!existing) return;
    setItems(existing.items.map(orderLinkItemToDraft));
    setCustomerName(existing.customerName ?? "");
    setCustomerPhone(existing.customerPhone ?? "");
    setAdminNotes(existing.adminNotes ?? "");
    setDiscountType(existing.discountType ?? "FLAT");
    setDiscountValue(
      existing.discountValue != null && Number(existing.discountValue) > 0
        ? String(Number(existing.discountValue))
        : "",
    );
    if (existing.expiresAt) {
      const daysLeft = Math.max(
        1,
        Math.ceil(
          (new Date(existing.expiresAt).getTime() - Date.now()) /
            (24 * 3600 * 1000),
        ),
      );
      setExpiresInDays(String(daysLeft));
    } else {
      setExpiresInDays("");
    }
  }, [existing]);

  const itemsValid = validateOrderItems(items);
  const canSubmit = itemsValid && !uploading;

  const itemsTotal = items.reduce(
    (sum, it) => sum + Number(it.unitPrice || 0) * Number(it.qty || 0),
    0,
  );
  const discount = manualDiscountRupees(
    itemsTotal,
    discountType,
    discountValue,
  );
  const grandTotal = itemsTotal - discount;

  const discountPayload = {
    discountType: discount > 0 ? discountType : null,
    discountValue: discount > 0 ? Number(discountValue) : null,
  };

  const submit = async () => {
    setError(null);
    try {
      const itemPayloads: OrderLinkItemPayload[] = [];
      for (const it of items) {
        setUploading(true);
        const referenceImageUrl = await resolveReferenceImageUrl(it);
        itemPayloads.push(
          toOrderLinkItemPayload(
            it,
            referenceImageUrl,
            flavours,
            allToppings,
          ),
        );
      }
      setUploading(false);

      if (isEdit && id) {
        await update.mutateAsync({
          id,
          items: itemPayloads,
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          adminNotes: adminNotes.trim() || null,
          expiresInDays: expiresInDays ? Number(expiresInDays) : null,
          ...discountPayload,
        });
        navigate("/offline-orders");
        return;
      }

      const payload: CreateOrderLinkPayload = {
        items: itemPayloads,
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        adminNotes: adminNotes.trim() || null,
        expiresInDays: expiresInDays ? Number(expiresInDays) : null,
        ...discountPayload,
      };

      const link = await create.mutateAsync(payload);
      setCreated({ token: link.token, url: publicUrl(link.token) });
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : "Failed to save link");
    }
  };

  if (created) return <CreatedView created={created} />;

  return (
    <div className="pb-24">
      <Link
        to="/offline-orders"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-500"
      >
        <ArrowLeft className="h-3 w-3" /> Back to offline orders
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-slate-900">
        {isEdit ? "Edit offline order" : "New offline order"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {isEdit
          ? "Update the items, spec, or price. Customer fills their contact & address."
          : "Lock the reference image, size, flavour and agreed price for one or more items. Customer fills their contact & address."}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <OrderItemsEditor
            items={items}
            patchItem={patchItem}
            removeItem={removeItem}
            addItem={addItem}
            listClassName="space-y-4"
          />

          <Section
            title="Discount"
            subtitle="Optional. Locked on the items total. Customer still pays delivery if they choose it."
          >
            <ManualDiscountFields
              type={discountType}
              value={discountValue}
              onType={setDiscountType}
              onValue={setDiscountValue}
            />
          </Section>

          <Section
            title="Customer (optional)"
            subtitle="If you already know it from WhatsApp — helps pre-fill the WhatsApp share message."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Aarav Kumar"
                  className={inputClass}
                />
              </Field>
              <Field label="Phone" hint="WhatsApp number">
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="9876543210"
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Admin notes"
            subtitle="Internal only. Never shown to customer."
          >
            <textarea
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Black icing, gold drip, edible pearls…"
              className={textareaClass}
            />
          </Section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Summary</h2>
            <div className="mt-3 space-y-1.5 text-sm">
              {items.map((it, idx) => (
                <div
                  key={it.id}
                  className="flex justify-between text-slate-700"
                >
                  <span className="truncate pr-2">
                    {it.productName.trim() || `Item ${idx + 1}`}
                    {Number(it.qty) > 1 ? ` × ${it.qty}` : ""}
                  </span>
                  <span className="tabular-nums">
                    ₹
                    {(Number(it.unitPrice || 0) * Number(it.qty || 0)).toFixed(
                      0,
                    )}
                  </span>
                </div>
              ))}
            </div>

            <hr className="my-4 border-slate-100" />
            {discount > 0 && (
              <div className="mb-2 flex justify-between text-sm text-emerald-700">
                <span>
                  Discount
                  {discountType === "PERCENT" ? ` (${discountValue}%)` : ""}
                </span>
                <span className="tabular-nums">−₹{discount.toFixed(0)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-700">Locked price</span>
              <span className="text-2xl font-semibold tabular-nums text-slate-900">
                ₹{grandTotal.toFixed(0)}
              </span>
            </div>

            <div className="mt-4">
              <Field
                label="Expires in (days)"
                hint="Link stops working after this. Blank = never."
              >
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            {error && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || create.isPending || update.isPending}
              className={cn(submitClass, "mt-5 w-full")}
            >
              {uploading
                ? "Uploading…"
                : create.isPending || update.isPending
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Create link"}
            </button>
            <Link
              to="/offline-orders"
              className="mt-2 block text-center text-xs text-slate-500 hover:text-brand-500"
            >
              Cancel
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className={cn(subtitle || action ? "mt-4" : "mt-3")}>{children}</div>
    </section>
  );
}


function CreatedView({ created }: { created: { token: string; url: string } }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(created.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`Your order link: ${created.url}`)}`;

  return (
    <div className="mx-auto max-w-lg py-8">
      <div className="rounded-card border border-emerald-200 bg-emerald-50/50 p-6 text-center sm:p-8">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl text-slate-900">Link created!</h1>
        <p className="mt-1 text-sm text-slate-600">
          Copy or share it on WhatsApp. Customer opens the link, sees the cake
          spec, and fills their details.
        </p>
      </div>

      <div className="mt-6 rounded-card border border-slate-200 bg-white p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Shareable URL
        </p>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-md bg-slate-100 px-3 py-2 font-mono text-xs text-slate-800">
            {created.url}
          </code>
          <button
            onClick={copy}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copy
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.05 22a10 10 0 1 1 8.68-15L22 3l-1.35 4.95A10 10 0 0 1 12.05 22z" />
          </svg>
          Share on WhatsApp
        </a>
        <Link
          to="/offline-orders"
          className="inline-flex flex-1 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
        >
          Back to offline orders
        </Link>
      </div>
    </div>
  );
}
