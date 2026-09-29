import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Hourglass, ImagePlus, Store, Truck, Wallet, X } from "lucide-react";
import { useCreateOfflineOrder } from "@/hooks/useOfflineOrders";
import { TIME_SLOTS } from "@/content/slots";
import { api } from "@/lib/api";
import { uploadImage } from "@/lib/uploads";
import { gstinIssue, normalizeGstin } from "@/lib/gstin";
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
  useOrderItemsGstOnTop,
  useOrderItemsState,
  validateOrderItems,
} from "@/components/order-items";
import { useFlavours } from "@/hooks/useFlavours";
import { useAdminToppings } from "@/hooks/useToppings";
import { useAdminAddons } from "@/hooks/useAddons";
import { AddressPlacesSearch } from "@/components/address/AddressPlacesSearch";
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
  const { data: allAddons = [] } = useAdminAddons();
  const { items, patchItem, removeItem, addItem, setItems } = useOrderItemsState();
  const [uploading, setUploading] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryPhoneTouched, setDeliveryPhoneTouched] = useState(false);
  const [isSurpriseGift, setIsSurpriseGift] = useState(false);
  const [billingSameAsDelivery, setBillingSameAsDelivery] = useState(true);
  const [billLine1, setBillLine1] = useState("");
  const [billLine2, setBillLine2] = useState("");
  const [billLandmark, setBillLandmark] = useState("");
  const [billMapSearchQuery, setBillMapSearchQuery] = useState("");
  const [billPincode, setBillPincode] = useState("");
  const [isBusinessOrder, setIsBusinessOrder] = useState(false);
  const [customerCompanyName, setCustomerCompanyName] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");

  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
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
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<ManualDiscountType>("FLAT");
  const [discountValue, setDiscountValue] = useState("");
  /** Editable delivery fee; prefilled from pincode table when the check succeeds. */
  const [deliveryFeeInput, setDeliveryFeeInput] = useState("");

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
    if (!deliveryPhoneTouched) setDeliveryPhone(customerPhone);
  }, [customerPhone, deliveryPhoneTouched]);

  useEffect(() => {
    if (fulfillment === "PICKUP") setIsSurpriseGift(false);
  }, [fulfillment]);

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

  useEffect(() => {
    if (fulfillment === "PICKUP") {
      setDeliveryFeeInput("");
      return;
    }
    if (pincodeInfo?.serviceable) {
      setDeliveryFeeInput(String(Number(pincodeInfo.deliveryFee)));
    } else {
      setDeliveryFeeInput("");
    }
  }, [fulfillment, pincodeInfo]);

  const deliveryFee =
    fulfillment === "DELIVERY" && deliveryFeeInput.trim() !== ""
      ? Math.max(0, Number(deliveryFeeInput) || 0)
      : 0;

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + Number(it.unitPrice || 0) * Number(it.qty || 0), 0),
    [items],
  );
  const discount = useMemo(
    () => manualDiscountRupees(subtotal, discountType, discountValue),
    [subtotal, discountType, discountValue],
  );
  const gstOnTop = useOrderItemsGstOnTop(items, discount);
  const grandTotal = subtotal - discount + deliveryFee + gstOnTop;

  const advanceValid =
    paymentMode === "FULL" ||
    (advanceAmount.trim() !== "" &&
      Number(advanceAmount) > 0 &&
      Number(advanceAmount) <= grandTotal);
  const pendingAmount =
    paymentMode === "FULL" ? 0 : Math.max(grandTotal - (Number(advanceAmount) || 0), 0);

  const addressValid =
    fulfillment === "PICKUP" ||
    (line1.trim().length >= 3 &&
      mapSearchQuery.trim().length >= 3 &&
      /^\d{6}$/.test(pincode) &&
      pincodeInfo?.serviceable === true &&
      /^[0-9+\-\s]{7,15}$/.test(deliveryPhone.trim()) &&
      (billingSameAsDelivery ||
        (billLine1.trim().length >= 3 &&
          billMapSearchQuery.trim().length >= 3 &&
          /^\d{6}$/.test(billPincode))));

  const itemsValid = validateOrderItems(items);

  // Only checked when the GST block is open, so ordinary orders are unaffected.
  const gstinError = isBusinessOrder ? gstinIssue(customerGstin) : null;
  const businessValid =
    !isBusinessOrder || (customerCompanyName.trim().length >= 2 && gstinError === null);

  const canSubmit =
    itemsValid &&
    customerName.trim().length >= 2 &&
    /^[0-9+\-\s]{7,15}$/.test(customerPhone.trim()) &&
    !!deliveryDate &&
    addressValid &&
    advanceValid &&
    businessValid &&
    !uploading &&
    !pincodeChecking;

  const slot = useMemo(() => TIME_SLOTS.find((s) => s.key === slotKey) ?? TIME_SLOTS[0], [slotKey]);

  const submit = async () => {
    setError(null);
    try {
      const itemPayloads = [];
      for (const it of items) {
        setUploading(true);
        const referenceImageUrl = await resolveReferenceImageUrl(it);
        itemPayloads.push(
          toOfflineOrderItemPayload(it, referenceImageUrl, flavours, allToppings, allAddons),
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
        customerCompanyName: isBusinessOrder ? customerCompanyName.trim() : null,
        customerGstin: isBusinessOrder ? customerGstin : null,

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
        recipientName:
          fulfillment === "DELIVERY" ? recipientName.trim() || customerName.trim() : null,
        deliveryPhone:
          fulfillment === "DELIVERY" ? deliveryPhone.trim() || customerPhone.trim() : null,
        billingAddress:
          fulfillment === "DELIVERY" && !billingSameAsDelivery
            ? {
                line1: billLine1.trim(),
                line2: billLine2.trim() || null,
                landmark: billLandmark.trim() || null,
                mapSearchQuery: billMapSearchQuery.trim(),
                pincode: billPincode,
                city: null,
                area: null,
                state: null,
                stateCode: null,
              }
            : null,
        billingSameAsDelivery: fulfillment === "DELIVERY" ? billingSameAsDelivery : undefined,
        isSurpriseGift: fulfillment === "DELIVERY" ? isSurpriseGift : false,
        deliveryDate,
        deliverySlotKey: slot.key,
        deliverySlotLabel: slot.label,

        customerNotes: customerNotes.trim() || null,
        adminNotes: adminNotes.trim() || null,
        paymentMode,
        advanceAmount: paymentMode === "ADVANCE" ? Number(advanceAmount) || 0 : undefined,
        paymentScreenshotUrl,
        discountType: discount > 0 ? discountType : null,
        discountValue: discount > 0 ? Number(discountValue) : null,
        deliveryFee: fulfillment === "DELIVERY" ? deliveryFee : undefined,
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
      <h1 className="mt-2 text-xl font-semibold text-slate-900 sm:mt-3 sm:text-2xl">
        New offline order — full details
      </h1>
      <p className="mt-1 hidden text-sm text-slate-500 sm:block">
        Enter one or more items and the customer's details. Order is placed straight away — no
        customer link needed.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4 sm:space-y-6">
          <OrderItemsEditor
            items={items}
            patchItem={patchItem}
            removeItem={removeItem}
            addItem={addItem}
          />

          <Section title="Customer">
            <div className={pairGrid}>
              <Field label="Name" required>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Aarav Kumar"
                  className={inputClass}
                />
              </Field>
              <Field label="Phone" required>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="9876543210"
                  className={inputClass}
                />
              </Field>
              <Field label="Email" className="col-span-2">
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Optional — gets the confirmation email"
                  className={inputClass}
                />
              </Field>

              <CheckboxRow
                checked={isBusinessOrder}
                onChange={setIsBusinessOrder}
                title="Business order — needs a GST invoice"
              />

              {isBusinessOrder && (
                <>
                  <Field label="Company name" required className="col-span-2 sm:col-span-1">
                    <input
                      value={customerCompanyName}
                      onChange={(e) => setCustomerCompanyName(e.target.value)}
                      placeholder="Registered business name"
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="GSTIN"
                    required
                    error={gstinError ?? undefined}
                    className="col-span-2 sm:col-span-1"
                  >
                    <input
                      value={customerGstin}
                      onChange={(e) =>
                        setCustomerGstin(normalizeGstin(e.target.value).slice(0, 15))
                      }
                      placeholder="27AAACR5055K1Z7"
                      spellCheck={false}
                      className={`${inputClass} font-mono tracking-wide`}
                    />
                  </Field>
                </>
              )}
            </div>
          </Section>

          <Section title={fulfillment === "DELIVERY" ? "Delivery" : "Pickup"}>
            <div className="grid grid-cols-2 gap-2">
              <ToggleButton
                active={fulfillment === "DELIVERY"}
                onClick={() => setFulfillment("DELIVERY")}
                icon={<Truck className="h-4 w-4" />}
                title="Delivery"
                subtitle="To their address"
              />
              <ToggleButton
                active={fulfillment === "PICKUP"}
                onClick={() => setFulfillment("PICKUP")}
                icon={<Store className="h-4 w-4" />}
                title="Pickup"
                subtitle="From the store"
              />
            </div>

            <div className={cn(pairGrid, "mt-3")}>
              <Field label="Date" required>
                <input
                  type="date"
                  min={todayIso()}
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className={cn(inputClass, "min-w-0")}
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

              {fulfillment === "DELIVERY" && (
                <>
                  <Field label="Recipient">
                    <input
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder={customerName.trim() || "Same as buyer"}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Delivery phone" required>
                    <input
                      type="tel"
                      value={deliveryPhone}
                      onChange={(e) => {
                        setDeliveryPhoneTouched(true);
                        setDeliveryPhone(e.target.value);
                      }}
                      placeholder={customerPhone.trim() || "9876543210"}
                      className={inputClass}
                    />
                  </Field>
                  <CheckboxRow
                    checked={isSurpriseGift}
                    onChange={setIsSurpriseGift}
                    title="Surprise gift"
                    subtitle="Contact the buyer only, not the recipient"
                  />
                  <Field label="Search address" required className="col-span-2">
                    <AddressPlacesSearch
                      value={mapSearchQuery}
                      onChange={setMapSearchQuery}
                      onPlaceSelect={(place) => {
                        if (place.line1) setLine1(place.line1);
                        if (place.pincode) setPincode(place.pincode);
                      }}
                      placeholder="Building, society, or area"
                    />
                  </Field>
                  <Field label="Address line 1" required className="col-span-2">
                    <input
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      placeholder="12A, Prince Anwar Shah Road"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Line 2">
                    <input
                      value={line2}
                      onChange={(e) => setLine2(e.target.value)}
                      placeholder="Flat 3B"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Landmark">
                    <input
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="Near South City"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Pincode" required>
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="700001"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Delivery ₹">
                    <input
                      inputMode="decimal"
                      value={deliveryFeeInput}
                      onChange={(e) => setDeliveryFeeInput(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="From pincode"
                      className={inputClass}
                      disabled={!pincodeInfo?.serviceable}
                    />
                  </Field>
                  {(pincodeChecking || pincodeInfo?.serviceable || pincodeError) && (
                    <p
                      className={cn(
                        "col-span-2 -mt-1 text-xs",
                        pincodeError ? "text-red-700" : "text-emerald-700",
                        pincodeChecking && "text-slate-500",
                      )}
                    >
                      {pincodeChecking
                        ? "Checking pincode…"
                        : pincodeError
                          ? pincodeError
                          : `${pincodeInfo?.city ?? ""}${pincodeInfo?.area ? ` · ${pincodeInfo.area}` : ""} · table rate ₹${Number(pincodeInfo?.deliveryFee ?? 0).toFixed(0)} — edit if charging differently`}
                    </p>
                  )}

                  <CheckboxRow
                    checked={billingSameAsDelivery}
                    onChange={setBillingSameAsDelivery}
                    title="Billing address same as delivery"
                  />

                  {!billingSameAsDelivery && (
                    <>
                      <Field label="Billing address search" required className="col-span-2">
                        <AddressPlacesSearch
                          value={billMapSearchQuery}
                          onChange={setBillMapSearchQuery}
                          onPlaceSelect={(place) => {
                            if (place.line1) setBillLine1(place.line1);
                            if (place.pincode) setBillPincode(place.pincode);
                          }}
                          placeholder="Billing building or area"
                        />
                      </Field>
                      <Field label="Billing line 1" required className="col-span-2">
                        <input
                          value={billLine1}
                          onChange={(e) => setBillLine1(e.target.value)}
                          placeholder="Registered / billing street"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Line 2">
                        <input
                          value={billLine2}
                          onChange={(e) => setBillLine2(e.target.value)}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Landmark">
                        <input
                          value={billLandmark}
                          onChange={(e) => setBillLandmark(e.target.value)}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Billing pincode" required>
                        <input
                          inputMode="numeric"
                          maxLength={6}
                          value={billPincode}
                          onChange={(e) =>
                            setBillPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                          placeholder="700001"
                          className={inputClass}
                        />
                      </Field>
                    </>
                  )}
                </>
              )}
            </div>
          </Section>

          <Section title="Payment">
            <div className="grid grid-cols-2 gap-2">
              <ToggleButton
                active={paymentMode === "FULL"}
                onClick={() => setPaymentMode("FULL")}
                icon={<Wallet className="h-4 w-4" />}
                title="Full payment"
                subtitle="Entire total collected now"
              />
              <ToggleButton
                active={paymentMode === "ADVANCE"}
                onClick={() => setPaymentMode("ADVANCE")}
                icon={<Hourglass className="h-4 w-4" />}
                title="Advance"
                subtitle="Rest stays pending"
              />
            </div>

            <div className={cn(pairGrid, "mt-3")}>
              {paymentMode === "ADVANCE" && (
                <Field
                  label="Advance amount"
                  required
                  error={
                    advanceAmount.trim() !== "" && !advanceValid
                      ? `Between ₹1 and ₹${grandTotal.toFixed(gstOnTop > 0 ? 2 : 0)}`
                      : undefined
                  }
                  hint={`Max ₹${grandTotal.toFixed(gstOnTop > 0 ? 2 : 0)}`}
                  className="col-span-2"
                >
                  <input
                    inputMode="decimal"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0"
                    className={inputClass}
                  />
                </Field>
              )}
              <div className="col-span-2">
                <ManualDiscountFields
                  type={discountType}
                  value={discountValue}
                  onType={setDiscountType}
                  onValue={setDiscountValue}
                />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <label className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white text-slate-400 transition group-hover:border-brand-500 group-hover:text-brand-600">
                    {screenshotPreview ? (
                      <img
                        src={screenshotPreview}
                        alt="Payment screenshot"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImagePlus className="h-5 w-5" />
                    )}
                  </span>
                  <span className="min-w-0 text-xs">
                    <span className="block font-medium text-slate-700">
                      {screenshotFile ? "Payment screenshot" : "Add payment screenshot"}
                    </span>
                    <span className="block truncate text-slate-500">
                      {screenshotFile?.name ?? "Optional — UPI / bank transfer proof"}
                    </span>
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      if (file) setScreenshotFile(file);
                    }}
                    className="sr-only"
                  />
                </label>
                {screenshotFile && (
                  <button
                    type="button"
                    onClick={() => setScreenshotFile(null)}
                    className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove screenshot"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </Section>

          <Section title="Notes">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <Field label="For kitchen / delivery">
                <textarea
                  rows={2}
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Handle gently, ring bell twice…"
                  className={cn(textareaClass, "min-h-0")}
                />
              </Field>
              <Field label="Internal (admin only)">
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Called on WhatsApp, paid ₹500 advance…"
                  className={cn(textareaClass, "min-h-0")}
                />
              </Field>
            </div>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-slate-900">Summary</h2>
            <div className="mt-3 space-y-1.5 text-sm">
              {items.map((it, idx) => (
                <div key={it.id} className="flex justify-between text-slate-700">
                  <span className="truncate pr-2">
                    {it.productName.trim() || `Item ${idx + 1}`}
                    {Number(it.qty) > 1 ? ` × ${it.qty}` : ""}
                  </span>
                  <span className="tabular-nums">
                    ₹{(Number(it.unitPrice || 0) * Number(it.qty || 0)).toFixed(0)}
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
              {gstOnTop > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>GST (added)</span>
                  <span className="tabular-nums">₹{gstOnTop.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span className="tabular-nums">₹{grandTotal.toFixed(gstOnTop > 0 ? 2 : 0)}</span>
              </div>
              {paymentMode === "ADVANCE" && Number(advanceAmount) > 0 && (
                <>
                  <div className="flex justify-between text-emerald-700">
                    <span>Advance</span>
                    <span className="tabular-nums">₹{Number(advanceAmount).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-amber-700">
                    <span>Pending</span>
                    <span className="tabular-nums">₹{pendingAmount.toFixed(0)}</span>
                  </div>
                </>
              )}
            </div>

            {error && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || create.isPending}
              className={cn(submitClass, "mt-4 w-full sm:mt-5")}
            >
              {uploading ? "Uploading…" : create.isPending ? "Placing order…" : "Place order"}
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

/** Two columns even on phones, so short fields pair up instead of stacking. */
const pairGrid = "grid grid-cols-2 gap-x-2 gap-y-3 sm:gap-x-4";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function CheckboxRow({
  checked,
  onChange,
  title,
  subtitle,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <label className="col-span-2 flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500/20"
      />
      <span className="text-sm text-slate-700">
        <span className="font-medium">{title}</span>
        {subtitle && <span className="text-xs text-slate-500"> — {subtitle}</span>}
      </span>
    </label>
  );
}

function ToggleButton({
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
      aria-pressed={active}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition",
        active
          ? "bg-brand-50/50 border-brand-500 ring-1 ring-brand-500/30"
          : "hover:border-brand-300 border-slate-200 bg-white",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          active ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-900">{title}</span>
        <span className="hidden truncate text-xs text-slate-500 sm:block">{subtitle}</span>
      </span>
    </button>
  );
}
