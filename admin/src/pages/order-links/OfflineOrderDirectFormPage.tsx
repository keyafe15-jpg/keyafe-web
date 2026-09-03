import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Package,
  Plus,
  Sparkles,
  Store,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { useAdminProducts, useAdminProduct } from "@/hooks/useAdminProducts";
import { useFlavours } from "@/hooks/useFlavours";
import { useAdminToppings, type AdminTopping } from "@/hooks/useToppings";
import { useAdminCakeSizes, type CakeSize } from "@/hooks/useCakeSizes";
import { useCreateOfflineOrder } from "@/hooks/useOfflineOrders";
import type { OrderLinkKind } from "@/hooks/useAdminOrderLinks";
import { TIME_SLOTS } from "@/content/slots";
import { api } from "@/lib/api";
import { uploadImage } from "@/lib/uploads";
import {
  Field,
  inputClass,
  selectClass,
  submitClass,
  textareaClass,
} from "@/components/form/Field";
import { ManualDiscountFields } from "@/components/form/ManualDiscountFields";
import { SearchableSelect } from "@/components/form/SearchableSelect";
import { manualDiscountRupees, type ManualDiscountType } from "@/lib/manualDiscount";
import {
  formatCatalogProductLabel,
  resetCatalogProductPick,
} from "@/lib/catalogProductOptions";
import {
  availableFixedSkus,
  formatOptionSelectLabel,
  getSizeOptionGroup,
  optionUnitPrice,
} from "@/lib/productConfiguration";
import type { AdminProduct } from "@/hooks/useAdminProducts";
import { cn } from "@/lib/cn";

interface PincodeInfo {
  serviceable: boolean;
  city?: string | null;
  area?: string | null;
  state?: string | null;
  stateCode?: string | null;
  deliveryFee: number;
}

interface LineItem {
  id: string; // client-side only, for React keys
  kind: OrderLinkKind;
  productId: string;
  productName: string;
  sizeLabel: string;
  sizeGrams: string;
  flavourId: string;
  messageOnCake: string;
  instructions: string;
  unitPrice: string;
  qty: string;
  refFile: File | null;
  refPreview: string | null;
  expanded: boolean;

  // Pizza-only picker state (auto-populated when a PIZZA product is selected).
  sizeOptionId: string;
  crustOptionId: string;
  crustLabel: string;
  toppingSelections: string[]; // topping IDs (both toppings + condiments)

  // Cake-only picker state (auto-populated when a CAKE product is selected).
  cakeSizeId: string;

  // Fixed-variant SKU (dry cakes, tubs, etc.).
  variantId: string;
}

function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function newItem(kind: OrderLinkKind = "CATALOG"): LineItem {
  return {
    id: crypto.randomUUID(),
    kind,
    productId: "",
    productName: "",
    sizeLabel: "",
    sizeGrams: "",
    flavourId: "",
    messageOnCake: "",
    instructions: "",
    unitPrice: "",
    qty: "1",
    refFile: null,
    refPreview: null,
    expanded: false,
    sizeOptionId: "",
    crustOptionId: "",
    crustLabel: "",
    toppingSelections: [],
    cakeSizeId: "",
    variantId: "",
  };
}

export function OfflineOrderDirectFormPage() {
  const navigate = useNavigate();
  const create = useCreateOfflineOrder();
  const { data: productsPage } = useAdminProducts(1, 100);
  const products = productsPage?.items ?? [];
  const { data: flavours = [] } = useFlavours();
  const { data: allToppings = [] } = useAdminToppings();
  const { data: cakeSizes = [] } = useAdminCakeSizes();

  const [items, setItems] = useState<LineItem[]>(() => [newItem("CATALOG")]);
  const [uploading, setUploading] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">(
    "DELIVERY",
  );
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [pincode, setPincode] = useState("");
  const [pincodeInfo, setPincodeInfo] = useState<PincodeInfo | null>(null);
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [pincodeChecking, setPincodeChecking] = useState(false);

  const [deliveryDate, setDeliveryDate] = useState(todayIso());
  const [slotKey, setSlotKey] = useState<string>(TIME_SLOTS[0].key);

  const [customerNotes, setCustomerNotes] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [paymentMode, setPaymentMode] = useState<"FULL" | "ADVANCE">("FULL");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<ManualDiscountType>("FLAT");
  const [discountValue, setDiscountValue] = useState("");

  const patchItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  };
  const removeItem = (id: string) => {
    setItems((prev) =>
      prev.length === 1 ? prev : prev.filter((it) => it.id !== id),
    );
  };
  const addItem = (kind: OrderLinkKind) =>
    setItems((prev) => [...prev, newItem(kind)]);

  useEffect(() => {
    if (!screenshotFile) {
      setScreenshotPreview(null);
      return;
    }
    const url = URL.createObjectURL(screenshotFile);
    setScreenshotPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshotFile]);

  // Refresh object-URL previews whenever an item's file changes.
  useEffect(() => {
    const created: string[] = [];
    setItems((prev) =>
      prev.map((it) => {
        if (it.refFile) {
          if (it.refPreview?.startsWith("blob:")) return it;
          const url = URL.createObjectURL(it.refFile);
          created.push(url);
          return { ...it, refPreview: url };
        }
        return it.refPreview ? { ...it, refPreview: null } : it;
      }),
    );
    return () => {
      created.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.refFile).join("|")]);

  useEffect(() => {
    setPincodeInfo(null);
    setPincodeError(null);
  }, [pincode]);

  useEffect(() => {
    if (fulfillment !== "DELIVERY") return;
    if (!/^\d{6}$/.test(pincode)) return;
    let cancelled = false;
    setPincodeChecking(true);
    api
      .get<PincodeInfo>(`/delivery/check-pincode/${pincode}`)
      .then((info) => {
        if (cancelled) return;
        setPincodeInfo(info);
        if (!info.serviceable) {
          setPincodeError(
            "We may still deliver here, please call or WhatsApp us to confirm or opt for pickup",
          );
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPincodeError(err instanceof Error ? err.message : "Check failed");
      })
      .finally(() => {
        if (!cancelled) setPincodeChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pincode, fulfillment]);

  const deliveryFee =
    fulfillment === "DELIVERY" && pincodeInfo?.serviceable
      ? Number(pincodeInfo.deliveryFee)
      : 0;

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, it) => sum + Number(it.unitPrice || 0) * Number(it.qty || 0),
        0,
      ),
    [items],
  );
  const discount = useMemo(
    () => manualDiscountRupees(subtotal, discountType, discountValue),
    [subtotal, discountType, discountValue],
  );
  const grandTotal = subtotal - discount + deliveryFee;

  const advanceValid =
    paymentMode === "FULL" ||
    (advanceAmount.trim() !== "" &&
      Number(advanceAmount) > 0 &&
      Number(advanceAmount) <= grandTotal);
  const pendingAmount =
    paymentMode === "FULL"
      ? 0
      : Math.max(grandTotal - (Number(advanceAmount) || 0), 0);

  const addressValid =
    fulfillment === "PICKUP" ||
    (line1.trim().length >= 3 &&
      mapSearchQuery.trim().length >= 3 &&
      /^\d{6}$/.test(pincode) &&
      pincodeInfo?.serviceable === true);

  const itemsValid = items.every(
    (it) =>
      it.productName.trim().length >= 2 &&
      Number(it.unitPrice) > 0 &&
      Number(it.qty) > 0 &&
      (it.kind === "CUSTOM" || it.productId),
  );

  const canSubmit =
    itemsValid &&
    customerName.trim().length >= 2 &&
    /^[0-9+\-\s]{7,15}$/.test(customerPhone.trim()) &&
    !!deliveryDate &&
    addressValid &&
    advanceValid &&
    !uploading &&
    !pincodeChecking;

  const slot = useMemo(
    () => TIME_SLOTS.find((s) => s.key === slotKey) ?? TIME_SLOTS[0],
    [slotKey],
  );

  const submit = async () => {
    setError(null);
    try {
      const itemPayloads = [];
      for (const it of items) {
        let referenceImageUrl: string | null = null;
        if (it.refFile) {
          setUploading(true);
          const res = await uploadImage(it.refFile, "quote-reference");
          referenceImageUrl = res.publicUrl;
        }
        const flavourName =
          flavours.find((f) => f.id === it.flavourId)?.name ?? null;

        // Compose pizza selections into instructions (crust + toppings + condiments).
        const pickedToppingNames = allToppings.filter((t) =>
          it.toppingSelections.includes(t.id),
        );
        const parts: string[] = [];
        if (it.crustLabel) parts.push(`Crust: ${it.crustLabel}`);
        const toppingsPart = pickedToppingNames
          .filter((t) => t.kind === "TOPPING")
          .map((t) => t.name)
          .join(", ");
        if (toppingsPart) parts.push(`Toppings: ${toppingsPart}`);
        const condimentsPart = pickedToppingNames
          .filter((t) => t.kind === "CONDIMENT")
          .map((t) => t.name)
          .join(", ");
        if (condimentsPart) parts.push(`Condiments: ${condimentsPart}`);
        const composedPrefix = parts.join(" · ");
        const finalInstructions = it.instructions.trim();
        const mergedInstructions =
          composedPrefix && finalInstructions
            ? `${composedPrefix}\n${finalInstructions}`
            : composedPrefix || finalInstructions || null;

        itemPayloads.push({
          kind: it.kind,
          productId: it.kind === "CATALOG" ? it.productId : null,
          productName: it.productName.trim(),
          sizeLabel: it.sizeLabel.trim() || null,
          sizeGrams: it.sizeGrams ? Number(it.sizeGrams) : null,
          flavourId: it.flavourId || null,
          flavourName,
          referenceImageUrl,
          messageOnCake: it.messageOnCake.trim() || null,
          instructions: mergedInstructions,
          unitPrice: Number(it.unitPrice),
          qty: Number(it.qty) || 1,
        });
      }
      setUploading(false);

      let paymentScreenshotUrl: string | null = null;
      if (screenshotFile) {
        setUploading(true);
        const res = await uploadImage(screenshotFile, "payment-screenshot");
        paymentScreenshotUrl = res.publicUrl;
        setUploading(false);
      }

      const payload = {
        items: itemPayloads,

        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || null,

        fulfillment,
        deliveryAddress:
          fulfillment === "DELIVERY"
            ? {
                line1: line1.trim(),
                line2: line2.trim() || null,
                landmark: landmark.trim() || null,
                mapSearchQuery: mapSearchQuery.trim(),
                pincode,
                city: pincodeInfo?.city ?? null,
                area: pincodeInfo?.area ?? null,
                state: pincodeInfo?.state ?? null,
                stateCode: pincodeInfo?.stateCode ?? null,
              }
            : null,
        deliveryDate,
        deliverySlotKey: slot.key,
        deliverySlotLabel: slot.label,

        customerNotes: customerNotes.trim() || null,
        adminNotes: adminNotes.trim() || null,
        paymentMode,
        advanceAmount:
          paymentMode === "ADVANCE" ? Number(advanceAmount) || 0 : undefined,
        paymentScreenshotUrl,
        discountType: discount > 0 ? discountType : null,
        discountValue: discount > 0 ? Number(discountValue) : null,
      };

      const order = await create.mutateAsync(payload);
      navigate(`/orders/${order.orderNumber}`);
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : "Failed to place order");
    }
  };

  return (
    <div className="pb-24">
      <Link
        to="/offline-orders"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-500"
      >
        <ArrowLeft className="h-3 w-3" /> Back to offline orders
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-slate-900">
        New offline order — full details
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Enter one or more items and the customer's details. Order is placed
        straight away — no customer link needed.
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
            <div className="space-y-3">
              {items.map((it, idx) => (
                <ItemRow
                  key={it.id}
                  index={idx}
                  item={it}
                  products={products}
                  flavours={flavours}
                  allToppings={allToppings}
                  cakeSizes={cakeSizes}
                  onPatch={(patch) => patchItem(it.id, patch)}
                  onRemove={() => removeItem(it.id)}
                  canRemove={items.length > 1}
                />
              ))}
            </div>
          </Section>

          <Section title="Customer">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Aarav Kumar"
                  className={inputClass}
                />
              </Field>
              <Field label="Phone" required hint="WhatsApp preferred">
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="9876543210"
                  className={inputClass}
                />
              </Field>
              <Field
                label="Email"
                hint="Optional. Confirmation email will be sent."
                className="sm:col-span-2"
              >
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="aarav@example.com"
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          <Section title="Fulfillment">
            <div className="grid grid-cols-2 gap-3">
              <KindButton
                active={fulfillment === "DELIVERY"}
                onClick={() => setFulfillment("DELIVERY")}
                icon={<Truck className="h-5 w-5" />}
                title="Delivery"
                subtitle="We deliver to their address"
              />
              <KindButton
                active={fulfillment === "PICKUP"}
                onClick={() => setFulfillment("PICKUP")}
                icon={<Store className="h-5 w-5" />}
                title="Pickup"
                subtitle="Customer picks up from store"
              />
            </div>

            {fulfillment === "DELIVERY" && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Pincode" required className="sm:col-span-1">
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) =>
                      setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="700001"
                    className={inputClass}
                  />
                  {pincodeChecking && (
                    <p className="mt-1 text-xs text-slate-500">Checking…</p>
                  )}
                  {pincodeInfo?.serviceable && (
                    <p className="mt-1 text-xs text-emerald-700">
                      {pincodeInfo.city}
                      {pincodeInfo.area ? ` · ${pincodeInfo.area}` : ""} · ₹
                      {Number(pincodeInfo.deliveryFee).toFixed(0)} delivery
                    </p>
                  )}
                  {pincodeError && (
                    <p className="mt-1 text-xs text-red-700">{pincodeError}</p>
                  )}
                </Field>
                <Field
                  label="Address line 1"
                  required
                  className="sm:col-span-1"
                >
                  <input
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                    placeholder="12A, Prince Anwar Shah Road"
                    className={inputClass}
                  />
                </Field>
                <Field label="Address line 2" className="sm:col-span-1">
                  <input
                    value={line2}
                    onChange={(e) => setLine2(e.target.value)}
                    placeholder="Flat 3B, Rose Apartments"
                    className={inputClass}
                  />
                </Field>
                <Field label="Landmark" className="sm:col-span-1">
                  <input
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="Near South City Mall"
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="What to search on Uber / Rapido"
                  required
                  className="sm:col-span-2"
                  hint="Whatever the delivery partner should type — building name, landmark, etc."
                >
                  <input
                    value={mapSearchQuery}
                    onChange={(e) => setMapSearchQuery(e.target.value)}
                    placeholder="Rose Apartments, Prince Anwar Shah Road"
                    className={inputClass}
                  />
                </Field>
              </div>
            )}
          </Section>

          <Section title="Delivery date & slot">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" required>
                <input
                  type="date"
                  min={todayIso()}
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Time slot" required>
                <select
                  value={slotKey}
                  onChange={(e) => setSlotKey(e.target.value)}
                  className={selectClass}
                >
                  {TIME_SLOTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section
            title="Discount"
            subtitle="Optional. Flat rupees or a percent off the items — not delivery."
          >
            <ManualDiscountFields
              type={discountType}
              value={discountValue}
              onType={setDiscountType}
              onValue={setDiscountValue}
            />
          </Section>

          <Section
            title="Customer notes"
            subtitle="Anything the kitchen or delivery partner should know."
          >
            <textarea
              rows={3}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Handle gently, ring bell twice…"
              className={textareaClass}
            />
          </Section>

          <Section
            title="Payment"
            subtitle="How much is being collected right now, and proof of it."
          >
            <div className="grid grid-cols-2 gap-3">
              <KindButton
                active={paymentMode === "FULL"}
                onClick={() => setPaymentMode("FULL")}
                icon={<Store className="h-5 w-5" />}
                title="Full payment"
                subtitle="Entire total collected now"
              />
              <KindButton
                active={paymentMode === "ADVANCE"}
                onClick={() => setPaymentMode("ADVANCE")}
                icon={<Truck className="h-5 w-5" />}
                title="Advance only"
                subtitle="Rest stays pending"
              />
            </div>

            {paymentMode === "ADVANCE" && (
              <div className="mt-4">
                <Field
                  label="Advance amount"
                  required
                  hint={`Max ₹${grandTotal.toFixed(0)}.`}
                >
                  <input
                    inputMode="decimal"
                    value={advanceAmount}
                    onChange={(e) =>
                      setAdvanceAmount(e.target.value.replace(/[^0-9.]/g, ""))
                    }
                    placeholder="0"
                    className={inputClass}
                  />
                  {!advanceValid && (
                    <p className="mt-1 text-xs text-red-700">
                      Enter an advance between ₹1 and ₹{grandTotal.toFixed(0)}.
                    </p>
                  )}
                </Field>
              </div>
            )}

            <div className="mt-4">
              <Field
                label="Payment screenshot"
                hint="Optional. Upload proof of the UPI/bank transfer, if any."
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setScreenshotFile(e.target.files?.[0] ?? null)
                  }
                  className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />
                {screenshotPreview && (
                  <img
                    src={screenshotPreview}
                    alt="Payment screenshot preview"
                    className="mt-2 h-32 w-32 rounded-md border border-slate-200 object-cover"
                  />
                )}
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
              placeholder="Called on WhatsApp, paid ₹500 advance…"
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
              <div className="flex justify-between border-t border-slate-100 pt-2 text-slate-700">
                <span>Subtotal</span>
                <span className="tabular-nums">₹{subtotal.toFixed(0)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>
                    Discount
                    {discountType === "PERCENT" ? ` (${discountValue}%)` : ""}
                  </span>
                  <span className="tabular-nums">−₹{discount.toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-700">
                <span>Delivery</span>
                <span className="tabular-nums">
                  {fulfillment === "PICKUP"
                    ? "—"
                    : pincodeInfo?.serviceable
                      ? `₹${deliveryFee.toFixed(0)}`
                      : "—"}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span className="tabular-nums">₹{grandTotal.toFixed(0)}</span>
              </div>
              {paymentMode === "ADVANCE" && Number(advanceAmount) > 0 && (
                <>
                  <div className="flex justify-between text-emerald-700">
                    <span>Advance</span>
                    <span className="tabular-nums">
                      ₹{Number(advanceAmount).toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium text-amber-700">
                    <span>Pending</span>
                    <span className="tabular-nums">
                      ₹{pendingAmount.toFixed(0)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {error && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || create.isPending}
              className={cn(submitClass, "mt-5 w-full")}
            >
              {uploading
                ? "Uploading…"
                : create.isPending
                  ? "Placing order…"
                  : "Place order"}
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

function ItemRow({
  index,
  item,
  products,
  flavours,
  allToppings,
  cakeSizes,
  onPatch,
  onRemove,
  canRemove,
}: {
  index: number;
  item: LineItem;
  products: AdminProduct[];
  flavours: Array<{ id: string; name: string; additionalAmount: string }>;
  allToppings: AdminTopping[];
  cakeSizes: CakeSize[];
  onPatch: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === item.productId),
    [products, item.productId],
  );

  const { data: productDetail } = useAdminProduct(
    item.kind === "CATALOG" && item.productId ? item.productId : undefined,
  );

  const template = productDetail?.template ?? selectedProduct?.template;

  const isPizza = item.kind === "CATALOG" && template === "PIZZA";
  const isCakeCatalog =
    item.kind === "CATALOG" && (template ?? "CAKE") === "CAKE";

  const sizeGroup = getSizeOptionGroup(productDetail);
  const sizeOptions = sizeGroup?.options ?? [];
  const sizePriceMode = sizeGroup?.priceMode ?? "ABSOLUTE";
  const crustOptions = productDetail?.crustOptions ?? [];
  const fixedSkus = availableFixedSkus(productDetail);
  const hasFixedSkus = fixedSkus.length > 0;
  const linkedToppingIds = new Set(productDetail?.toppingIds ?? []);
  const linkedToppings = allToppings.filter((t) => linkedToppingIds.has(t.id));
  const availToppings = linkedToppings.filter((t) => t.kind === "TOPPING");
  const availCondiments = linkedToppings.filter((t) => t.kind === "CONDIMENT");

  // Cake pound picker: only when the product opts in via sellByPound.
  const isPoundCake = isCakeCatalog && productDetail?.sellByPound === true;
  // Size choices from OptionGroup (not ProductVariant table).
  const hasOptionGroupSize =
    sizeOptions.length > 0 && !isPizza && !isPoundCake && !hasFixedSkus;
  const autoPriced =
    isPizza || isPoundCake || hasOptionGroupSize || hasFixedSkus;
  const availableCakeSizes = useMemo(() => {
    if (!isPoundCake) return [];
    return cakeSizes.filter((s) => {
      if (!s.isActive) return false;
      if (productDetail?.minGrams != null && s.grams < productDetail.minGrams)
        return false;
      if (productDetail?.maxGrams != null && s.grams > productDetail.maxGrams)
        return false;
      return true;
    });
  }, [isPoundCake, cakeSizes, productDetail]);

  // Flavours the product actually offers — fall back to master list if none
  // were linked, matching the client-side PDP behaviour.
  const productFlavourIds = new Set(productDetail?.flavorIds ?? []);
  const availableFlavours =
    productFlavourIds.size > 0
      ? flavours.filter((f) => productFlavourIds.has(f.id))
      : flavours;

  // For CATALOG items, hide cake-specific fields when the picked product is
  // a pizza / other so the admin isn't asked for flavour on a pizza.
  const showCakeFields = item.kind === "CUSTOM" || isCakeCatalog;

  useEffect(() => {
    if (item.kind !== "CATALOG" || !selectedProduct || !productDetail) return;
    const patch: Partial<LineItem> = {};
    if (!item.productName) patch.productName = selectedProduct.name;
    const simpleProduct = !autoPriced;
    if (!item.unitPrice && simpleProduct) {
      patch.unitPrice = Number(selectedProduct.basePrice).toFixed(0);
    }
    if (Object.keys(patch).length) onPatch(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, productDetail, autoPriced]);

  // Preselect default size from the size OptionGroup (non-pizza).
  useEffect(() => {
    if (!hasOptionGroupSize || !productDetail || item.sizeOptionId) return;
    const def = sizeOptions.find((o) => o.isDefault) ?? sizeOptions[0];
    if (def?.id) onPatch({ sizeOptionId: def.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOptionGroupSize, productDetail]);

  // ProductVariant SKU (FIXED_VARIANTS table) — separate from optionGroups.
  useEffect(() => {
    if (!hasFixedSkus || !item.variantId) return;
    const sku = fixedSkus.find((v) => v.id === item.variantId);
    if (!sku) return;
    const attrs = sku.attributes as { weightGrams?: number } | null;
    onPatch({
      unitPrice: sku.price.toFixed(0),
      sizeLabel: sku.label,
      sizeGrams: attrs?.weightGrams ? String(attrs.weightGrams) : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFixedSkus, item.variantId, productDetail]);

  // OptionGroup size — price respects ABSOLUTE vs DELTA on the group.
  useEffect(() => {
    if (!hasOptionGroupSize || !productDetail) return;
    const picked = sizeOptions.find((o) => o.id === item.sizeOptionId);
    if (!picked) return;
    const base = Number(productDetail.basePrice);
    onPatch({
      unitPrice: optionUnitPrice(base, picked, sizePriceMode).toFixed(0),
      sizeLabel: picked.label,
      sizeGrams: picked.weightGrams ? String(picked.weightGrams) : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOptionGroupSize, item.sizeOptionId, productDetail]);

  // Preselect default size + crust when the pizza detail arrives.
  useEffect(() => {
    if (!isPizza || !productDetail) return;
    const patch: Partial<LineItem> = {};
    if (!item.sizeOptionId && sizeOptions.length > 0) {
      patch.sizeOptionId =
        sizeOptions.find((o) => o.isDefault)?.id ?? sizeOptions[0].id ?? "";
    }
    if (!item.crustOptionId && crustOptions.length > 0) {
      patch.crustOptionId =
        crustOptions.find((o) => o.isDefault)?.id ?? crustOptions[0].id ?? "";
    }
    if (Object.keys(patch).length) onPatch(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPizza, productDetail]);

  // Preselect default cake size (500g = 1 pound if allowed, else first).
  useEffect(() => {
    if (!isPoundCake || availableCakeSizes.length === 0) return;
    if (item.cakeSizeId) return;
    const oneLb = availableCakeSizes.find((s) => s.grams === 500);
    const pick = oneLb ?? availableCakeSizes[0];
    onPatch({
      cakeSizeId: pick.id,
      sizeGrams: String(pick.grams),
      sizeLabel: pick.label,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPoundCake, availableCakeSizes]);

  // Recompute unit price + size label when any pizza selection changes.
  const pickedSize = sizeOptions.find((o) => o.id === item.sizeOptionId);
  const pickedCrust = crustOptions.find((o) => o.id === item.crustOptionId);
  const pickedToppingsFull = allToppings.filter((t) =>
    item.toppingSelections.includes(t.id),
  );

  // Recompute cake price when size or flavour changes.
  useEffect(() => {
    if (!isPoundCake || !productDetail) return;
    const size = availableCakeSizes.find((s) => s.id === item.cakeSizeId);
    if (!size) return;
    const base = Number(productDetail.basePrice);
    const flavour = flavours.find((f) => f.id === item.flavourId);
    const flavourDelta = flavour ? Number(flavour.additionalAmount) : 0;
    const multiplier = size.grams / 500;
    const computed = (base + flavourDelta) * multiplier;
    onPatch({
      unitPrice: computed.toFixed(0),
      sizeGrams: String(size.grams),
      sizeLabel: size.label,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPoundCake, item.cakeSizeId, item.flavourId, productDetail]);

  useEffect(() => {
    if (!isPizza || !productDetail) return;
    const sizePrice = pickedSize ? Number(pickedSize.price) : 0;
    const crustDelta = pickedCrust ? Number(pickedCrust.price) : 0;
    const toppingsDelta = pickedToppingsFull.reduce(
      (s, t) => s + Number(t.priceDelta),
      0,
    );
    const computed = sizePrice + crustDelta + toppingsDelta;
    const patch: Partial<LineItem> = { unitPrice: computed.toFixed(0) };
    if (pickedSize) patch.sizeLabel = pickedSize.label;
    patch.crustLabel = pickedCrust ? pickedCrust.label : "";
    onPatch(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPizza,
    item.sizeOptionId,
    item.crustOptionId,
    item.toppingSelections.join("|"),
  ]);

  const toggleTopping = (id: string) => {
    const next = item.toppingSelections.includes(id)
      ? item.toppingSelections.filter((x) => x !== id)
      : [...item.toppingSelections, id];
    onPatch({ toppingSelections: next });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                item.kind === "CATALOG"
                  ? "bg-sky-100 text-sky-700"
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
            <span className="text-xs text-slate-400">#{index + 1}</span>
          </div>

          {item.kind === "CATALOG" && (
            <div className="mt-3 space-y-3">
              <Field label="Product" required>
                <SearchableSelect
                  value={item.productId}
                  onChange={(productId) =>
                    onPatch({ productId, ...resetCatalogProductPick() })
                  }
                  searchPlaceholder="Search products…"
                  options={products.map((p) => ({
                    value: p.id,
                    label: formatCatalogProductLabel(p),
                    keywords: p.name,
                  }))}
                />
              </Field>

              {item.productId && productDetail && hasFixedSkus && (
                <Field label="Variant (SKU)" required>
                  <SearchableSelect
                    value={item.variantId}
                    onChange={(variantId) => onPatch({ variantId })}
                    searchPlaceholder="Search SKUs…"
                    allowEmpty={false}
                    placeholder="— Pick SKU —"
                    options={fixedSkus.map((v) => ({
                      value: v.id,
                      label: `${v.label} · ₹${v.price.toFixed(0)}`,
                      keywords: `${v.label} ${v.sku}`,
                    }))}
                  />
                </Field>
              )}

              {item.productId && productDetail && hasOptionGroupSize && (
                <Field
                  label={sizeGroup?.label ?? "Size"}
                  required
                  hint="From product option groups"
                >
                  <SearchableSelect
                    value={item.sizeOptionId}
                    onChange={(sizeOptionId) => onPatch({ sizeOptionId })}
                    searchPlaceholder="Search sizes…"
                    allowEmpty={false}
                    placeholder="— Pick size —"
                    options={sizeOptions.map((o) => ({
                      value: o.id!,
                      label: formatOptionSelectLabel(
                        o,
                        Number(productDetail.basePrice),
                        sizePriceMode,
                      ),
                      keywords: o.label,
                    }))}
                  />
                </Field>
              )}
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <Field
              label={item.kind === "CATALOG" ? "Name (override)" : "Name"}
              required
            >
              <input
                value={item.productName}
                onChange={(e) => onPatch({ productName: e.target.value })}
                placeholder={
                  item.kind === "CATALOG"
                    ? "Uses product name if blank"
                    : "1 pound chocolate cake"
                }
                className={inputClass}
              />
            </Field>
            <Field
              label={autoPriced ? "Unit price (auto)" : "Unit price (₹)"}
              required
            >
              <input
                type="text"
                inputMode="decimal"
                value={item.unitPrice}
                onChange={(e) =>
                  onPatch({ unitPrice: e.target.value.replace(/[^\d.]/g, "") })
                }
                placeholder="500"
                disabled={autoPriced}
                className={cn(
                  inputClass,
                  autoPriced && "bg-slate-100 text-slate-600",
                )}
              />
            </Field>
            <Field label="Qty" required>
              <input
                type="text"
                inputMode="numeric"
                value={item.qty}
                onChange={(e) =>
                  onPatch({ qty: e.target.value.replace(/\D/g, "") })
                }
                placeholder="1"
                className={inputClass}
              />
            </Field>
          </div>

          {isPoundCake && productDetail && (
            <div className="mt-3 space-y-3 rounded-md border border-amber-100 bg-amber-50/40 p-3">
              {availableCakeSizes.length > 0 && (
                <Field label="Size (pounds)" required>
                  <select
                    value={item.cakeSizeId}
                    onChange={(e) => onPatch({ cakeSizeId: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">— Choose —</option>
                    {availableCakeSizes.map((s) => {
                      const flavour = flavours.find(
                        (f) => f.id === item.flavourId,
                      );
                      const flavourDelta = flavour
                        ? Number(flavour.additionalAmount)
                        : 0;
                      const base = productDetail
                        ? Number(productDetail.basePrice)
                        : 0;
                      const price = (base + flavourDelta) * (s.grams / 500);
                      return (
                        <option key={s.id} value={s.id}>
                          {s.label} · ₹{price.toFixed(0)}
                        </option>
                      );
                    })}
                  </select>
                </Field>
              )}
              <Field label="Flavour">
                <select
                  value={item.flavourId}
                  onChange={(e) => onPatch({ flavourId: e.target.value })}
                  className={selectClass}
                >
                  <option value="">— None —</option>
                  {availableFlavours.map((f) => {
                    const delta = Number(f.additionalAmount);
                    return (
                      <option key={f.id} value={f.id}>
                        {f.name}
                        {delta > 0 ? ` (+₹${delta.toFixed(0)}/lb)` : ""}
                      </option>
                    );
                  })}
                </select>
              </Field>
              <Field label="Message on cake">
                <input
                  value={item.messageOnCake}
                  onChange={(e) => onPatch({ messageOnCake: e.target.value })}
                  placeholder="Happy Birthday Aarav"
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {isPizza && productDetail && (
            <div className="mt-3 space-y-3 rounded-md border border-sky-100 bg-sky-50/40 p-3">
              {sizeOptions.length > 0 && (
                <Field label="Size" required>
                  <SearchableSelect
                    value={item.sizeOptionId}
                    onChange={(sizeOptionId) => onPatch({ sizeOptionId })}
                    searchPlaceholder="Search sizes…"
                    allowEmpty={false}
                    placeholder="— Pick size —"
                    options={sizeOptions.map((o) => ({
                      value: o.id!,
                      label: formatOptionSelectLabel(
                        o,
                        Number(productDetail.basePrice),
                        sizePriceMode,
                      ),
                      keywords: o.label,
                    }))}
                  />
                </Field>
              )}
              {crustOptions.length > 0 && (
                <Field label="Crust">
                  <select
                    value={item.crustOptionId}
                    onChange={(e) => onPatch({ crustOptionId: e.target.value })}
                    className={selectClass}
                  >
                    {crustOptions.map((o) => {
                      const delta = Number(o.price);
                      return (
                        <option key={o.id} value={o.id}>
                          {o.label}
                          {delta === 0 ? "" : ` (+₹${delta.toFixed(0)})`}
                        </option>
                      );
                    })}
                  </select>
                </Field>
              )}
              {availToppings.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Toppings
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availToppings.map((t) => {
                      const on = item.toppingSelections.includes(t.id);
                      const delta = Number(t.priceDelta);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTopping(t.id)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                            on
                              ? "border-brand-500 bg-brand-100 text-brand-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-brand-300",
                          )}
                        >
                          {t.name}
                          {delta > 0 && (
                            <span className="ml-1 text-slate-500">
                              +₹{delta.toFixed(0)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {availCondiments.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Condiments / Extras
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availCondiments.map((t) => {
                      const on = item.toppingSelections.includes(t.id);
                      const delta = Number(t.priceDelta);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTopping(t.id)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                            on
                              ? "border-brand-500 bg-brand-100 text-brand-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-brand-300",
                          )}
                        >
                          {t.name}
                          {delta > 0 && (
                            <span className="ml-1 text-slate-500">
                              +₹{delta.toFixed(0)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {!isPizza && !isPoundCake && !hasFixedSkus && !hasOptionGroupSize && (
            <button
              type="button"
              onClick={() => onPatch({ expanded: !item.expanded })}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-700"
            >
              {item.expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {item.expanded ? "Hide" : "Show"} details (size
              {showCakeFields ? ", flavour, message" : ""}
              {item.kind === "CUSTOM" ? ", reference image" : ""})
            </button>
          )}

          {!isPizza && !isPoundCake && item.expanded && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Size label">
                <input
                  value={item.sizeLabel}
                  onChange={(e) => onPatch({ sizeLabel: e.target.value })}
                  placeholder="1 pound / 500g"
                  className={inputClass}
                />
              </Field>
              <Field label="Size (grams)">
                <input
                  type="number"
                  min={1}
                  value={item.sizeGrams}
                  onChange={(e) => onPatch({ sizeGrams: e.target.value })}
                  className={inputClass}
                />
              </Field>
              {showCakeFields && (
                <>
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
                  <Field label="Message on cake">
                    <input
                      value={item.messageOnCake}
                      onChange={(e) =>
                        onPatch({ messageOnCake: e.target.value })
                      }
                      placeholder="Happy Birthday Aarav"
                      className={inputClass}
                    />
                  </Field>
                </>
              )}
              <Field label="Instructions" className="sm:col-span-2">
                <input
                  value={item.instructions}
                  onChange={(e) => onPatch({ instructions: e.target.value })}
                  placeholder="Extra frosting, no nuts…"
                  className={inputClass}
                />
              </Field>
              {item.kind === "CUSTOM" && (
                <Field label="Reference image" className="sm:col-span-2">
                  <div className="flex items-start gap-3">
                    {item.refPreview ? (
                      <div className="relative h-20 w-20 shrink-0">
                        <img
                          src={item.refPreview}
                          alt="Reference"
                          className="h-full w-full rounded-md object-cover ring-1 ring-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onPatch({ refFile: null, refPreview: null })
                          }
                          className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
                          aria-label="Remove image"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400">
                        No image
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                      onChange={(e) =>
                        onPatch({ refFile: e.target.files?.[0] ?? null })
                      }
                      className="block text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-slate-200 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                    />
                  </div>
                </Field>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
          aria-label="Remove item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
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
    <section className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function KindButton({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition",
        active
          ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/30"
          : "border-slate-200 bg-white hover:border-brand-300",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md",
          active ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500",
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-medium text-slate-900">{title}</span>
      <span className="text-xs text-slate-500">{subtitle}</span>
    </button>
  );
}
