import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Sparkles,
  Package,
  ArrowLeft,
  Copy,
  Check,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import {
  useAdminOrderLink,
  useCreateOrderLink,
  useUpdateOrderLink,
  type CreateOrderLinkPayload,
  type OrderLinkItemPayload,
  type OrderLinkKind,
} from "@/hooks/useAdminOrderLinks";
import { useAdminProducts } from "@/hooks/useAdminProducts";
import { useFlavours } from "@/hooks/useFlavours";
import { uploadImage } from "@/lib/uploads";
import {
  Field,
  inputClass,
  selectClass,
  textareaClass,
  submitClass,
} from "@/components/form/Field";
import { ManualDiscountFields } from "@/components/form/ManualDiscountFields";
import {
  manualDiscountRupees,
  type ManualDiscountType,
} from "@/lib/manualDiscount";
import { cn } from "@/lib/cn";

function publicUrl(token: string): string {
  const base = window.location.origin.replace(/:517[5-9]$/, ":5173");
  return `${base}/o/${token}`;
}

interface ItemDraft {
  id: string; // client-side only, for React keys
  kind: OrderLinkKind;
  productId: string;
  productName: string;
  sizeLabel: string;
  sizeGrams: string;
  flavourId: string;
  messageHint: string;
  unitPrice: string;
  qty: string;
  refFile: File | null;
  refPreview: string | null;
  // Existing image URL kept in edit mode (unless user clears or uploads a new one).
  keptImageUrl: string | null;
}

function newItem(kind: OrderLinkKind = "CUSTOM"): ItemDraft {
  return {
    id: crypto.randomUUID(),
    kind,
    productId: "",
    productName: "",
    sizeLabel: "",
    sizeGrams: "",
    flavourId: "",
    messageHint: "",
    unitPrice: "",
    qty: "1",
    refFile: null,
    refPreview: null,
    keptImageUrl: null,
  };
}

export function OrderLinkFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const create = useCreateOrderLink();
  const update = useUpdateOrderLink();
  const { data: existing } = useAdminOrderLink(id);
  const { data: productsPage } = useAdminProducts(1, 100);
  const products = productsPage?.items ?? [];
  const { data: flavours = [] } = useFlavours();

  const [items, setItems] = useState<ItemDraft[]>(() => [newItem("CUSTOM")]);
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

  const patchItem = (itemId: string, patch: Partial<ItemDraft>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    );
  };
  const removeItem = (itemId: string) => {
    setItems((prev) =>
      prev.length === 1 ? prev : prev.filter((it) => it.id !== itemId),
    );
  };
  const addItem = (kind: OrderLinkKind) =>
    setItems((prev) => [...prev, newItem(kind)]);

  // Prefill from existing link on edit.
  useEffect(() => {
    if (!existing) return;
    setItems(
      existing.items.map((it) => ({
        id: it.id,
        kind: it.kind,
        productId: it.productId ?? "",
        productName: it.productName,
        sizeLabel: it.sizeLabel ?? "",
        sizeGrams: it.sizeGrams ? String(it.sizeGrams) : "",
        flavourId: it.flavourId ?? "",
        messageHint: it.messageHint ?? "",
        unitPrice: Number(it.unitPrice).toFixed(0),
        qty: String(it.qty),
        refFile: null,
        refPreview: null,
        keptImageUrl: it.referenceImageUrl,
      })),
    );
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

  // Refresh object-URL previews whenever an item's file changes.
  useEffect(() => {
    const createdUrls: string[] = [];
    setItems((prev) =>
      prev.map((it) => {
        if (it.refFile) {
          if (it.refPreview?.startsWith("blob:")) return it;
          const url = URL.createObjectURL(it.refFile);
          createdUrls.push(url);
          return { ...it, refPreview: url };
        }
        return it.refPreview ? { ...it, refPreview: null } : it;
      }),
    );
    return () => {
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.refFile).join("|")]);

  const flavourName = (flavourId: string) =>
    flavours.find((f) => f.id === flavourId)?.name ?? null;

  const itemsValid = items.every(
    (it) =>
      it.productName.trim().length >= 2 &&
      Number(it.unitPrice) > 0 &&
      Number(it.qty) > 0 &&
      (it.kind === "CUSTOM" || it.productId),
  );
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
        let referenceImageUrl: string | null = it.keptImageUrl;
        if (it.refFile) {
          setUploading(true);
          const res = await uploadImage(it.refFile, "quote-reference");
          referenceImageUrl = res.publicUrl;
        }
        itemPayloads.push({
          kind: it.kind,
          productId: it.kind === "CATALOG" ? it.productId : null,
          productName: it.productName.trim(),
          sizeLabel: it.sizeLabel.trim() || null,
          sizeGrams: it.sizeGrams ? Number(it.sizeGrams) : null,
          flavourId: it.flavourId || null,
          flavourName: flavourName(it.flavourId),
          referenceImageUrl,
          messageHint: it.messageHint.trim() || null,
          unitPrice: Number(it.unitPrice),
          qty: Number(it.qty) || 1,
        });
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
          <Section
            title="Items"
            subtitle="Catalog picks a product from your menu; Custom is a one-off item."
            action={
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addItem("CATALOG")}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
                >
                  <Plus className="h-3 w-3" /> Catalog item
                </button>
                <button
                  type="button"
                  onClick={() => addItem("CUSTOM")}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
                >
                  <Plus className="h-3 w-3" /> Custom item
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              {items.map((item, idx) => (
                <ItemRow
                  key={item.id}
                  index={idx}
                  item={item}
                  products={products}
                  flavours={flavours}
                  onPatch={(patch) => patchItem(item.id, patch)}
                  onRemove={() => removeItem(item.id)}
                  canRemove={items.length > 1}
                />
              ))}
            </div>
          </Section>

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

function ItemRow({
  index,
  item,
  products,
  flavours,
  onPatch,
  onRemove,
  canRemove,
}: {
  index: number;
  item: ItemDraft;
  products: Array<{ id: string; name: string; basePrice: string }>;
  flavours: Array<{ id: string; name: string }>;
  onPatch: (patch: Partial<ItemDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === item.productId),
    [products, item.productId],
  );

  // Auto-fill snapshotted fields when a catalog product is picked.
  useEffect(() => {
    if (item.kind !== "CATALOG" || !selectedProduct) return;
    if (!item.productName) onPatch({ productName: selectedProduct.name });
    if (!item.unitPrice)
      onPatch({ unitPrice: Number(selectedProduct.basePrice).toFixed(0) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.kind, selectedProduct]);

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Item {index + 1}
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              item.kind === "CATALOG"
                ? "bg-blue-50 text-blue-700"
                : "bg-brand-100 text-brand-700",
            )}
          >
            {item.kind === "CATALOG" ? (
              <Package className="h-3 w-3" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {item.kind === "CATALOG" ? "Catalog" : "Custom"}
          </span>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-slate-400 hover:text-red-600"
            aria-label="Remove item"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {item.kind === "CATALOG" && (
        <Field label="Pick a product" required>
          <select
            value={item.productId}
            onChange={(e) =>
              onPatch({ productId: e.target.value, productName: "" })
            }
            className={selectClass}
          >
            <option value="">— Choose —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · ₹{Number(p.basePrice).toFixed(0)}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field
          label={item.kind === "CATALOG" ? "Name (override)" : "Name"}
          required
        >
          <input
            value={item.productName}
            onChange={(e) => onPatch({ productName: e.target.value })}
            placeholder="2 pound chocolate cake"
            className={inputClass}
          />
        </Field>
        <Field label="Flavour">
          <select
            value={item.flavourId}
            onChange={(e) => onPatch({ flavourId: e.target.value })}
            className={selectClass}
          >
            <option value="">— None —</option>
            {flavours.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Size label">
          <input
            value={item.sizeLabel}
            onChange={(e) => onPatch({ sizeLabel: e.target.value })}
            placeholder="1 pound / 500g"
            className={inputClass}
          />
        </Field>
        <Field label="Size (grams)" hint="Optional. e.g. 500 for 1 lb.">
          <input
            type="number"
            min={1}
            value={item.sizeGrams}
            onChange={(e) => onPatch({ sizeGrams: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field
          label="Message on cake (suggestion)"
          hint="Customer can override this at checkout."
          className="sm:col-span-2"
        >
          <input
            value={item.messageHint}
            onChange={(e) => onPatch({ messageHint: e.target.value })}
            placeholder="Happy Birthday Aarav"
            className={inputClass}
          />
        </Field>
        <Field label="Unit price (₹)" required>
          <input
            type="number"
            min={0}
            step="0.01"
            value={item.unitPrice}
            onChange={(e) => onPatch({ unitPrice: e.target.value })}
            placeholder="1500"
            className={inputClass}
          />
        </Field>
        <Field label="Qty" required>
          <input
            type="number"
            min={1}
            value={item.qty}
            onChange={(e) => onPatch({ qty: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Reference image"
        hint={
          item.kind === "CATALOG"
            ? "Optional — leave blank to use the product's primary photo."
            : "Upload the photo the customer sent."
        }
        className="mt-3"
      >
        <div className="flex flex-col items-start gap-3 sm:flex-row">
          {item.refPreview ? (
            <img
              src={item.refPreview}
              alt="Reference"
              className="h-24 w-24 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
            />
          ) : item.keptImageUrl ? (
            <div className="relative h-24 w-24 shrink-0">
              <img
                src={item.keptImageUrl}
                alt="Reference"
                className="h-full w-full rounded-lg object-cover ring-1 ring-slate-200"
              />
              <button
                type="button"
                onClick={() => onPatch({ keptImageUrl: null })}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white transition hover:bg-slate-900"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
              No image
            </div>
          )}
          <div className="flex-1">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                onPatch({
                  refFile: file,
                  keptImageUrl: file ? null : item.keptImageUrl,
                });
              }}
              className="block text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-slate-200 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
            />
            {(item.refFile || item.keptImageUrl) && (
              <button
                type="button"
                onClick={() => onPatch({ refFile: null, keptImageUrl: null })}
                className="mt-2 text-xs text-slate-500 hover:text-brand-500"
              >
                Remove image
              </button>
            )}
          </div>
        </div>
      </Field>
    </div>
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
