import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, HandCoins, Hourglass, ImagePlus, Store, Truck, Wallet, X } from "lucide-react";
import { OFFLINE_PAYMENT_METHODS, type OfflinePaymentMethod } from "@/pages/orders/order-ui";
import { useCreateOfflineOrder } from "@/hooks/useOfflineOrders";
import { MAX_PAYMENT_SCREENSHOTS } from "@/hooks/useAdminOrders";
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
import { DeliveryPaidToField } from "@/components/form/DeliveryPaidToField";
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const [recipientIsCustomer, setRecipientIsCustomer] = useState(true);
  const [recipientName, setRecipientName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
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
  const [paymentPlan, setPaymentPlan] = useState<"FULL" | "ADVANCE" | "ON_DELIVERY">("FULL");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<OfflinePaymentMethod | null>(null);
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<ManualDiscountType>("FLAT");
  const [discountValue, setDiscountValue] = useState("");
  /** Editable delivery fee; prefilled from pincode table when the check succeeds. */
  const [deliveryFeeInput, setDeliveryFeeInput] = useState("");
  const [deliveryPaidToRider, setDeliveryPaidToRider] = useState(true);

  useOrderItemRefPreviews(items, setItems);

  useEffect(() => {
    const urls = screenshotFiles.map((file) => URL.createObjectURL(file));
    setScreenshotPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [screenshotFiles]);

  useEffect(() => {
    setPincodeInfo(null);
    setPincodeError(null);
  }, [pincode]);

  const hasOtherRecipient = fulfillment === "DELIVERY" && !recipientIsCustomer;

  useEffect(() => {
    if (!hasOtherRecipient) setIsSurpriseGift(false);
  }, [hasOtherRecipient]);

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
  const chargedDelivery = deliveryPaidToRider ? 0 : deliveryFee;
  const grandTotal = subtotal - discount + chargedDelivery + gstOnTop;

  const advanceValid =
    paymentPlan !== "ADVANCE" ||
    (advanceAmount.trim() !== "" &&
      Number(advanceAmount) > 0 &&
      Number(advanceAmount) <= grandTotal);
  const pendingAmount =
    paymentPlan === "FULL"
      ? 0
      : paymentPlan === "ON_DELIVERY"
        ? grandTotal
        : Math.max(grandTotal - (Number(advanceAmount) || 0), 0);

  const addressValid =
    fulfillment === "PICKUP" ||
    (line1.trim().length >= 3 &&
      mapSearchQuery.trim().length >= 3 &&
      /^\d{6}$/.test(pincode) &&
      pincodeInfo?.serviceable === true &&
      (recipientIsCustomer ||
        (recipientName.trim().length >= 2 && /^[0-9+\-\s]{7,15}$/.test(deliveryPhone.trim()))) &&
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

      const paymentScreenshotUrls: string[] = [];
      if (screenshotFiles.length > 0) {
        setUploading(true);
        for (const file of screenshotFiles) {
          const res = await uploadImage(file, "payment-screenshot");
          paymentScreenshotUrls.push(res.publicUrl);
        }
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
          fulfillment === "DELIVERY"
            ? (recipientIsCustomer ? customerName : recipientName).trim()
            : null,
        deliveryPhone:
          fulfillment === "DELIVERY"
            ? (recipientIsCustomer ? customerPhone : deliveryPhone).trim()
            : null,
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
        isSurpriseGift: hasOtherRecipient && isSurpriseGift,
        deliveryDate,
        deliverySlotKey: slot.key,
        deliverySlotLabel: slot.label,

        customerNotes: customerNotes.trim() || null,
        adminNotes: adminNotes.trim() || null,
        paymentMode: paymentPlan === "FULL" ? ("FULL" as const) : ("ADVANCE" as const),
        advanceAmount:
          paymentPlan === "ADVANCE"
            ? Number(advanceAmount) || 0
            : paymentPlan === "ON_DELIVERY"
              ? 0
              : undefined,
        paymentMethod: paymentMethod ?? undefined,
        paymentScreenshotUrls,
        discountType: discount > 0 ? discountType : null,
        discountValue: discount > 0 ? Number(discountValue) : null,
        deliveryFee: fulfillment === "DELIVERY" ? deliveryFee : undefined,
        deliveryPaidToRider,
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

              {fulfillment === "DELIVERY" && (
                <>
                  <CheckboxRow
                    checked={recipientIsCustomer}
                    onChange={setRecipientIsCustomer}
                    title="Recipient is the customer"
                    subtitle="Uncheck to deliver to someone else"
                  />
                  {!recipientIsCustomer && (
                    <>
                      <Field label="Recipient name" required>
                        <input
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="Who receives it"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Recipient phone" required>
                        <input
                          type="tel"
                          value={deliveryPhone}
                          onChange={(e) => setDeliveryPhone(e.target.value)}
                          placeholder="9876543210"
                          className={inputClass}
                        />
                      </Field>
                      <CheckboxRow
                        checked={isSurpriseGift}
                        onChange={setIsSurpriseGift}
                        title="Surprise gift"
                        subtitle="Contact the buyer only, not the recipient"
                      />
                    </>
                  )}
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
                  {pincodeInfo?.serviceable && (
                    <DeliveryPaidToField
                      paidToRider={deliveryPaidToRider}
                      onChange={setDeliveryPaidToRider}
                      className="col-span-2"
                    />
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <ToggleButton
                active={paymentPlan === "FULL"}
                onClick={() => setPaymentPlan("FULL")}
                icon={<Wallet className="h-4 w-4" />}
                title="Full payment"
                subtitle="All collected now"
              />
              <ToggleButton
                active={paymentPlan === "ADVANCE"}
                onClick={() => setPaymentPlan("ADVANCE")}
                icon={<Hourglass className="h-4 w-4" />}
                title="Advance"
                subtitle="Rest stays pending"
              />
              <ToggleButton
                active={paymentPlan === "ON_DELIVERY"}
                onClick={() => setPaymentPlan("ON_DELIVERY")}
                icon={<HandCoins className="h-4 w-4" />}
                title="Pay on delivery"
                subtitle="Collect later"
              />
            </div>

            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-slate-700">
                {paymentPlan === "ON_DELIVERY" ? "Expected payment mode" : "Payment mode"}
                <span className="ml-1 font-normal text-slate-400">· for your records</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {OFFLINE_PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    aria-pressed={paymentMethod === m.value}
                    onClick={() => setPaymentMethod((cur) => (cur === m.value ? null : m.value))}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition",
                      paymentMethod === m.value
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "hover:border-brand-300 border-slate-200 bg-white text-slate-700",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {paymentPlan === "ON_DELIVERY" && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Record the payment from the order page when it comes in, even weeks later.
                </p>
              )}
            </div>

            <div className={cn(pairGrid, "mt-3")}>
              {paymentPlan === "ADVANCE" && (
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
              <div className="col-span-2">
                <p className="text-xs font-medium text-slate-700">
                  Payment screenshots{" "}
                  <span className="font-normal text-slate-500">
                    — optional, up to {MAX_PAYMENT_SCREENSHOTS} (advance, balance, spare)
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {screenshotPreviews.map((url, index) => (
                    <div key={url} className="relative">
                      <img
                        src={url}
                        alt={`Payment screenshot ${index + 1}`}
                        className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setScreenshotFiles((files) => files.filter((_, i) => i !== index))
                        }
                        className="absolute -top-1.5 -right-1.5 rounded-full bg-white p-0.5 text-slate-500 shadow ring-1 ring-slate-200 hover:text-red-600"
                        aria-label={`Remove screenshot ${index + 1}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {screenshotFiles.length < MAX_PAYMENT_SCREENSHOTS && (
                    <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-slate-400 transition hover:border-brand-500 hover:text-brand-600">
                      <ImagePlus className="h-5 w-5" />
                      <span className="sr-only">Add payment screenshot</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const picked = Array.from(e.target.files ?? []);
                          e.target.value = "";
                          setScreenshotFiles((files) =>
                            [...files, ...picked].slice(0, MAX_PAYMENT_SCREENSHOTS),
                          );
                        }}
                        className="sr-only"
                      />
                    </label>
                  )}
                </div>
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
              {fulfillment === "DELIVERY" && pincodeInfo?.serviceable && deliveryPaidToRider ? (
                <div className="flex justify-between text-slate-500">
                  <span>Delivery · paid to rider, not in total</span>
                  <span className="tabular-nums">₹{deliveryFee.toFixed(0)}</span>
                </div>
              ) : (
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
              )}
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
              {paymentPlan === "ON_DELIVERY" && (
                <div className="flex justify-between font-medium text-amber-700">
                  <span>Due on delivery</span>
                  <span className="tabular-nums">
                    ₹{pendingAmount.toFixed(gstOnTop > 0 ? 2 : 0)}
                  </span>
                </div>
              )}
              {paymentPlan === "ADVANCE" && Number(advanceAmount) > 0 && (
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
