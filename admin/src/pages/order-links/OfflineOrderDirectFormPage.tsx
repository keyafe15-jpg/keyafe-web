import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Store,
  Truck,
} from "lucide-react";
import { useCreateOfflineOrder } from "@/hooks/useOfflineOrders";
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
import { manualDiscountRupees, type ManualDiscountType } from "@/lib/manualDiscount";
import {
  OrderItemsEditor,
  resolveReferenceImageUrl,
  toOfflineOrderItemPayload,
  useOrderItemRefPreviews,
  useOrderItemsState,
  validateOrderItems,
} from "@/components/order-items";
import { useFlavours } from "@/hooks/useFlavours";
import { useAdminToppings } from "@/hooks/useToppings";
import { cn } from "@/lib/cn";

interface PincodeInfo {
  serviceable: boolean;
  city?: string | null;
  area?: string | null;
  state?: string | null;
  stateCode?: string | null;
  deliveryFee: number;
}

function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function OfflineOrderDirectFormPage() {
  const navigate = useNavigate();
  const create = useCreateOfflineOrder();
  const { data: flavours = [] } = useFlavours();
  const { data: allToppings = [] } = useAdminToppings();
  const { items, patchItem, removeItem, addItem, setItems } =
    useOrderItemsState("CATALOG");
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

  useOrderItemRefPreviews(items, setItems);

  useEffect(() => {
    if (!screenshotFile) {
      setScreenshotPreview(null);
      return;
    }
    const url = URL.createObjectURL(screenshotFile);
    setScreenshotPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshotFile]);

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

  const itemsValid = validateOrderItems(items);

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
        setUploading(true);
        const referenceImageUrl = await resolveReferenceImageUrl(it);
        itemPayloads.push(
          toOfflineOrderItemPayload(
            it,
            referenceImageUrl,
            flavours,
            allToppings,
          ),
        );
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
          <OrderItemsEditor
            items={items}
            patchItem={patchItem}
            removeItem={removeItem}
            addItem={addItem}
          />

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
