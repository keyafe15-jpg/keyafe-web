import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Sparkles, Package, ArrowLeft, Copy, Check, X } from "lucide-react";
import {
  useAdminOrderLink,
  useCreateOrderLink,
  useUpdateOrderLink,
  type CreateOrderLinkPayload,
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
  const { data: products = [] } = useAdminProducts();
  const { data: flavours = [] } = useFlavours();

  const [kind, setKind] = useState<OrderLinkKind>("CUSTOM");
  const [productId, setProductId] = useState<string>("");
  const [productName, setProductName] = useState("");
  const [sizeLabel, setSizeLabel] = useState("");
  const [sizeGrams, setSizeGrams] = useState("");
  const [flavourId, setFlavourId] = useState<string>("");
  const [messageHint, setMessageHint] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("7");
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  // Existing image URL kept in edit mode (unless user clears or uploads a new one).
  const [keptImageUrl, setKeptImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    token: string;
    url: string;
  } | null>(null);

  // Prefill from existing link on edit.
  useEffect(() => {
    if (!existing) return;
    setKind(existing.kind);
    setProductId(existing.productId ?? "");
    setProductName(existing.productName);
    setSizeLabel(existing.sizeLabel ?? "");
    setSizeGrams(existing.sizeGrams ? String(existing.sizeGrams) : "");
    setFlavourId(existing.flavourId ?? "");
    setMessageHint(existing.messageHint ?? "");
    setUnitPrice(Number(existing.unitPrice).toFixed(0));
    setQty(String(existing.qty));
    setCustomerName(existing.customerName ?? "");
    setCustomerPhone(existing.customerPhone ?? "");
    setAdminNotes(existing.adminNotes ?? "");
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
    setKeptImageUrl(existing.referenceImageUrl);
  }, [existing]);

  // Preview the selected file locally before upload.
  useEffect(() => {
    if (!refFile) {
      setRefPreview(null);
      return;
    }
    const url = URL.createObjectURL(refFile);
    setRefPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [refFile]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId],
  );

  // When product changes, auto-fill snapshotted fields.
  useEffect(() => {
    if (kind !== "CATALOG" || !selectedProduct) return;
    setProductName(selectedProduct.name);
    if (!unitPrice) setUnitPrice(Number(selectedProduct.basePrice).toFixed(0));
  }, [kind, selectedProduct]); // eslint-disable-line react-hooks/exhaustive-deps

  const flavourName = useMemo(
    () => flavours.find((f) => f.id === flavourId)?.name ?? null,
    [flavours, flavourId],
  );

  const canSubmit =
    productName.trim().length >= 2 &&
    Number(unitPrice) > 0 &&
    (kind === "CUSTOM" || productId) &&
    !uploading;

  const submit = async () => {
    setError(null);
    try {
      let referenceImageUrl: string | null = keptImageUrl;

      if (refFile) {
        setUploading(true);
        const res = await uploadImage(refFile, "quote-reference");
        referenceImageUrl = res.publicUrl;
        setUploading(false);
      }

      if (isEdit && id) {
        await update.mutateAsync({
          id,
          kind,
          productId: kind === "CATALOG" ? productId : null,
          productName: productName.trim(),
          sizeLabel: sizeLabel.trim() || null,
          sizeGrams: sizeGrams ? Number(sizeGrams) : null,
          flavourId: flavourId || null,
          flavourName,
          referenceImageUrl,
          messageHint: messageHint.trim() || null,
          unitPrice: Number(unitPrice),
          qty: Number(qty) || 1,
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          adminNotes: adminNotes.trim() || null,
          expiresInDays: expiresInDays ? Number(expiresInDays) : null,
        });
        navigate("/offline-orders");
        return;
      }

      const payload: CreateOrderLinkPayload = {
        kind,
        productId: kind === "CATALOG" ? productId : null,
        productName: productName.trim(),
        sizeLabel: sizeLabel.trim() || null,
        sizeGrams: sizeGrams ? Number(sizeGrams) : null,
        flavourId: flavourId || null,
        flavourName,
        referenceImageUrl,
        messageHint: messageHint.trim() || null,
        unitPrice: Number(unitPrice),
        qty: Number(qty) || 1,
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        adminNotes: adminNotes.trim() || null,
        expiresInDays: expiresInDays ? Number(expiresInDays) : null,
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
          ? "Update the image, spec, or price. Type stays fixed."
          : "Lock the reference image, size, flavour and agreed price. Customer fills their contact & address."}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Section title="Type">
            <div className="grid grid-cols-2 gap-3">
              <KindButton
                active={kind === "CUSTOM"}
                onClick={() => setKind("CUSTOM")}
                icon={<Sparkles className="h-5 w-5" />}
                title="Custom cake"
                subtitle="One-off design, price you agreed on the call"
              />
              <KindButton
                active={kind === "CATALOG"}
                onClick={() => setKind("CATALOG")}
                icon={<Package className="h-5 w-5" />}
                title="From catalog"
                subtitle="Existing product from your menu"
              />
            </div>
          </Section>

          {kind === "CATALOG" && (
            <Section title="Product">
              <Field label="Pick a product" required>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
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
              {selectedProduct && (
                <p className="mt-2 text-xs text-slate-500">
                  Reference image will use the product's primary photo. Override
                  below if needed.
                </p>
              )}
            </Section>
          )}

          <Section title="Cake spec">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name shown to customer" required>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="2 pound chocolate cake"
                  className={inputClass}
                />
              </Field>
              <Field label="Flavour">
                <select
                  value={flavourId}
                  onChange={(e) => setFlavourId(e.target.value)}
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
                  value={sizeLabel}
                  onChange={(e) => setSizeLabel(e.target.value)}
                  placeholder="1 pound / 500g"
                  className={inputClass}
                />
              </Field>
              <Field label="Size (grams)" hint="Optional. e.g. 500 for 1 lb.">
                <input
                  type="number"
                  min={1}
                  value={sizeGrams}
                  onChange={(e) => setSizeGrams(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field
                label="Message on cake (suggestion)"
                hint="Customer can override this at checkout."
                className="sm:col-span-2"
              >
                <input
                  value={messageHint}
                  onChange={(e) => setMessageHint(e.target.value)}
                  placeholder="Happy Birthday Aarav"
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Reference image"
            subtitle={
              kind === "CATALOG"
                ? "Optional — leave blank to use the product's primary photo."
                : "Upload the photo the customer sent."
            }
          >
            <div className="flex flex-col items-start gap-3 sm:flex-row">
              {refPreview ? (
                <img
                  src={refPreview}
                  alt="Reference"
                  className="h-32 w-32 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
                />
              ) : keptImageUrl ? (
                <div className="relative h-32 w-32 shrink-0">
                  <img
                    src={keptImageUrl}
                    alt="Reference"
                    className="h-full w-full rounded-lg object-cover ring-1 ring-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setKeptImageUrl(null)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white transition hover:bg-slate-900"
                    aria-label="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                  No image
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setRefFile(file);
                    if (file) setKeptImageUrl(null);
                  }}
                  className="block text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-slate-200 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                />
                {(refFile || keptImageUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRefFile(null);
                      setKeptImageUrl(null);
                    }}
                    className="mt-2 text-xs text-slate-500 hover:text-brand-500"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>
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
            <h2 className="text-sm font-semibold text-slate-900">Pricing</h2>
            <div className="mt-3 space-y-3">
              <Field label="Unit price (₹)" required>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="1500"
                  className={inputClass}
                />
              </Field>
              <Field label="Qty" required>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className={inputClass}
                />
              </Field>
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

            <hr className="my-4 border-slate-100" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-700">Locked price</span>
              <span className="text-2xl font-semibold tabular-nums text-slate-900">
                ₹
                {unitPrice
                  ? (Number(unitPrice) * Number(qty || 1)).toFixed(0)
                  : "0"}
              </span>
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

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

function KindButton({
  active,
  onClick,
  icon,
  title,
  subtitle,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition",
        active
          ? "border-brand-500 bg-brand-100/40 text-brand-700"
          : "border-slate-200 bg-white text-slate-700 hover:border-brand-300",
        disabled && "opacity-40",
      )}
    >
      <span className={active ? "text-brand-700" : "text-slate-400"}>
        {icon}
      </span>
      <span className="text-sm font-medium">{title}</span>
      <span className="text-[11px] text-slate-500">{subtitle}</span>
    </button>
  );
}
