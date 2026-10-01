import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useOrderLink, usePlaceOrderLink } from "@/hooks/useOrderLink";
import { usePincodeCheck, type PincodeCheckResult } from "@/hooks/usePincodeCheck";
import { PRODUCT_COPY } from "@/content/product";
import { usePaymentConfig } from "@/hooks/usePayments";
import { payWithCashfree } from "@/lib/cashfree";
import { AddressPlacesSearch } from "@/components/address/AddressPlacesSearch";
import { BusinessGstFields } from "@/components/checkout/BusinessGstFields";
import { gstinIssue } from "@/lib/gstin";
import { cn } from "@/lib/cn";
import { manualDiscountRupees } from "@/lib/manualDiscount";
import { stateNameFromCode, WEST_BENGAL_CODE } from "@/lib/indiaStates";
import { gstAddedOnTop } from "@keyafe/shared";

type Fulfillment = "DELIVERY" | "PICKUP";
type PayChoice = "FULL" | "ADVANCE" | "COD";

const PHONE_RE = /^[0-9+\-\s]{7,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_RE = /^\d{6}$/;

const MISSING_DETAILS: [fields: string[], label: string][] = [
  [["date"], "a date"],
  [["name"], "your name"],
  [["phone"], "your phone number"],
  [["email"], "a valid email"],
  [["companyName", "gstin"], "your GST details"],
  [["recipientName", "deliveryPhone"], "the recipient's details"],
  [["mapSearchQuery", "line1", "pincode"], "your delivery address"],
  [["billMapSearchQuery", "billLine1", "billPincode"], "the billing address"],
  [["advanceAmount"], "an advance amount"],
];

/** "Add your name, phone number and delivery address to continue", or null when complete. */
function missingDetailsHint(
  errors: Record<string, string>,
  pincodeResult: PincodeCheckResult | null,
): string | null {
  if (errors.pincode && pincodeResult && !pincodeResult.serviceable) return errors.pincode;
  const missing = MISSING_DETAILS.filter(([fields]) => fields.some((f) => errors[f])).map(
    ([, label]) => label,
  );
  if (missing.length === 0) return null;
  const list =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;
  return `Add ${list} to continue`;
}

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function OrderLinkPage() {
  const { token = "" } = useParams<{ token: string }>();
  const { data: link, isLoading, isError, error } = useOrderLink(token);

  if (isLoading) return <PageSkeleton />;
  if (isError || !link)
    return (
      <PageError
        title="Order link not found"
        message={error instanceof Error ? error.message : "This link isn't valid."}
      />
    );

  if (link.status === "ORDERED") {
    return (
      <PageError
        title="Already ordered"
        message="This link has already been used."
        cta={
          link.linkedOrder ? (
            <Link
              to={`/order/${link.linkedOrder.id}/success`}
              className="rounded-full bg-brand-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              View your order
            </Link>
          ) : undefined
        }
      />
    );
  }
  if (link.status === "EXPIRED")
    return (
      <PageError
        title="Link expired"
        message="This order link has expired. Please contact the bakery for a fresh one."
      />
    );
  if (link.status === "CANCELLED")
    return (
      <PageError
        title="Link cancelled"
        message="This link was cancelled. Please contact the bakery."
      />
    );

  return <LinkForm link={link} />;
}

function LinkForm({ link }: { link: NonNullable<ReturnType<typeof useOrderLink>["data"]> }) {
  const navigate = useNavigate();
  const place = usePlaceOrderLink({ token: link.token });
  const pincodeCheck = usePincodeCheck();
  const { data: paymentConfig } = usePaymentConfig();
  const onlinePaymentAvailable =
    link.allowOnlinePayment && (paymentConfig?.cashfreeEnabled ?? false);

  const [fulfillment, setFulfillment] = useState<Fulfillment>("DELIVERY");
  const [name, setName] = useState(link.customerName ?? "");
  const [phone, setPhone] = useState(link.customerPhone ?? "");
  const [email, setEmail] = useState("");
  const [recipientIsMe, setRecipientIsMe] = useState(true);
  const [recipientName, setRecipientName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [isSurpriseGift, setIsSurpriseGift] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [billingSameAsDelivery, setBillingSameAsDelivery] = useState(true);
  const [billLine1, setBillLine1] = useState("");
  const [billLine2, setBillLine2] = useState("");
  const [billLandmark, setBillLandmark] = useState("");
  const [billMapSearchQuery, setBillMapSearchQuery] = useState("");
  const [billPincode, setBillPincode] = useState("");
  const [isBusinessOrder, setIsBusinessOrder] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [pincode, setPincode] = useState("");
  const [pincodeResult, setPincodeResult] = useState<PincodeCheckResult | null>(null);
  const [date, setDate] = useState<string>(
    link.suggestedDate ? link.suggestedDate.slice(0, 10) : "",
  );
  const [slotKey, setSlotKey] = useState<string>(
    link.suggestedSlotKey ?? PRODUCT_COPY.timeSlots[0].key,
  );
  const [notes, setNotes] = useState("");
  const [selectedPayChoice, setPayChoice] = useState<PayChoice>("FULL");
  const payChoice: PayChoice = onlinePaymentAvailable ? selectedPayChoice : "COD";
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const slot = PRODUCT_COPY.timeSlots.find((s) => s.key === slotKey) ?? PRODUCT_COPY.timeSlots[0];

  const subtotal = link.items.reduce((sum, it) => sum + Number(it.unitPrice) * it.qty, 0);
  const discount = manualDiscountRupees(subtotal, link.discountType, link.discountValue);
  const lockedDeliveryFee =
    link.deliveryFee != null && Number.isFinite(Number(link.deliveryFee))
      ? Number(link.deliveryFee)
      : null;
  const deliveryFee =
    fulfillment === "DELIVERY" && pincodeResult?.serviceable
      ? (lockedDeliveryFee ?? pincodeResult.deliveryFee)
      : 0;
  const gstOnTop = gstAddedOnTop(
    link.items.map((it) => ({
      amount: Number(it.unitPrice) * it.qty,
      gstRate: it.product?.gstRate,
      priceIsGstInclusive: it.product?.priceIsGstInclusive,
    })),
    discount,
  );
  const total = subtotal - discount + (link.deliveryPaidToRider ? 0 : deliveryFee) + gstOnTop;

  const payNowAmount =
    payChoice === "FULL" ? total : payChoice === "ADVANCE" ? Number(advanceAmount) || 0 : 0;

  const hasOtherRecipient = fulfillment === "DELIVERY" && !recipientIsMe;

  useEffect(() => {
    if (!hasOtherRecipient) setIsSurpriseGift(false);
  }, [hasOtherRecipient]);

  useEffect(() => {
    if (fulfillment !== "DELIVERY") {
      setPincodeResult(null);
      return;
    }
    if (!PINCODE_RE.test(pincode)) {
      setPincodeResult(null);
      return;
    }
    pincodeCheck.mutate(pincode, {
      onSuccess: (res) => setPincodeResult(res),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode, fulfillment]);

  const allErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Enter your name";
    if (!PHONE_RE.test(phone.trim())) e.phone = "Enter a valid phone";
    if (email.trim() && !EMAIL_RE.test(email.trim())) e.email = "Enter a valid email";
    if (isBusinessOrder) {
      if (companyName.trim().length < 2) e.companyName = "Enter the registered business name";
      const issue = gstinIssue(gstin);
      if (issue) e.gstin = issue;
    }
    if (!date) e.date = "Pick a delivery date";
    if (fulfillment === "DELIVERY") {
      if (line1.trim().length < 3) e.line1 = "Street address is required";
      if (!PINCODE_RE.test(pincode)) e.pincode = "6-digit pincode";
      else if (pincodeResult && !pincodeResult.serviceable)
        e.pincode = "We may still deliver here, please call or WhatsApp us to confirm";
      if (mapSearchQuery.trim().length < 3)
        e.mapSearchQuery = "Tell us what to search on Uber / Rapido";
      if (!recipientIsMe) {
        if (recipientName.trim().length < 2) e.recipientName = "Enter the recipient's name";
        if (!PHONE_RE.test(deliveryPhone.trim())) e.deliveryPhone = "Enter a valid phone";
      }
      if (!billingSameAsDelivery) {
        if (billLine1.trim().length < 3) e.billLine1 = "Billing street address is required";
        if (!PINCODE_RE.test(billPincode)) e.billPincode = "6-digit pincode";
        if (billMapSearchQuery.trim().length < 3)
          e.billMapSearchQuery = "Tell us what to search on Uber / Rapido";
      }
    }
    if (
      payChoice === "ADVANCE" &&
      (!advanceAmount.trim() || Number(advanceAmount) <= 0 || Number(advanceAmount) > total)
    )
      e.advanceAmount = `Enter an advance between ₹1 and ₹${total.toFixed(0)}`;
    return e;
  }, [
    name,
    phone,
    email,
    isBusinessOrder,
    companyName,
    gstin,
    date,
    fulfillment,
    line1,
    pincode,
    pincodeResult,
    mapSearchQuery,
    recipientIsMe,
    recipientName,
    deliveryPhone,
    billingSameAsDelivery,
    billLine1,
    billPincode,
    billMapSearchQuery,
    payChoice,
    advanceAmount,
    total,
  ]);
  const isValid = Object.keys(allErrors).length === 0;
  // Errors stay hidden until the first submit attempt so a fresh form isn't all red.
  const errors: Record<string, string> = showErrors ? allErrors : {};
  const missingHint = missingDetailsHint(allErrors, pincodeResult);

  const submit = async () => {
    if (!isValid) {
      setShowErrors(true);
      requestAnimationFrame(() => {
        document
          .querySelector("[data-field-error]")
          ?.closest("label")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setSubmitError(null);
    try {
      const deliveryAddress =
        fulfillment === "DELIVERY"
          ? {
              line1: line1.trim(),
              line2: line2.trim() || null,
              landmark: landmark.trim() || null,
              mapSearchQuery: mapSearchQuery.trim(),
              pincode,
              city: pincodeResult?.serviceable ? pincodeResult.city : null,
              area: pincodeResult?.serviceable ? pincodeResult.area : null,
              // Order links are local-delivery only, so the place of supply
              // is always the seller's own state.
              state: stateNameFromCode(WEST_BENGAL_CODE),
              stateCode: WEST_BENGAL_CODE,
            }
          : null;

      const billingAddress =
        fulfillment === "DELIVERY" && !billingSameAsDelivery
          ? {
              line1: billLine1.trim(),
              line2: billLine2.trim() || null,
              landmark: billLandmark.trim() || null,
              mapSearchQuery: billMapSearchQuery.trim(),
              pincode: billPincode,
              city: null,
              area: null,
              state: stateNameFromCode(WEST_BENGAL_CODE),
              stateCode: WEST_BENGAL_CODE,
            }
          : null;

      const order = await place.mutateAsync({
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim() || null,
        customerCompanyName: isBusinessOrder ? companyName.trim() : null,
        customerGstin: isBusinessOrder ? gstin : null,
        fulfillment,
        deliveryAddress,
        recipientName:
          fulfillment === "DELIVERY" ? (recipientIsMe ? name : recipientName).trim() : null,
        deliveryPhone:
          fulfillment === "DELIVERY" ? (recipientIsMe ? phone : deliveryPhone).trim() : null,
        billingAddress,
        billingSameAsDelivery: fulfillment === "DELIVERY" ? billingSameAsDelivery : undefined,
        isSurpriseGift: hasOtherRecipient && isSurpriseGift,
        deliveryDate: date,
        deliverySlotKey: slotKey,
        deliverySlotLabel: slot.label,
        customerNotes: notes.trim() || null,
        paymentMode: payChoice === "FULL" ? "FULL" : "ADVANCE",
        advanceAmount:
          payChoice === "ADVANCE"
            ? Number(advanceAmount) || 0
            : payChoice === "COD"
              ? 0
              : undefined,
      });
      if (order.payment) {
        setRedirectingToPayment(true);
        try {
          await payWithCashfree(order.payment);
          return;
        } catch {
          setRedirectingToPayment(false);
        }
      }
      navigate(`/order/${order.id}/success`, { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const submitLabel = place.isPending
    ? "Placing order…"
    : payChoice !== "COD" && payNowAmount > 0
      ? `Pay ₹${payNowAmount.toFixed(2)} securely`
      : "Confirm order";
  const deliveryFeePending = fulfillment === "DELIVERY" && !pincodeResult?.serviceable;
  const payingAdvance = payChoice === "ADVANCE" && Number(advanceAmount) > 0;

  // The sticky bar duplicates the summary button, so it steps aside whenever
  // that button is on screen.
  const summaryButtonRef = useRef<HTMLButtonElement>(null);
  const [summaryButtonVisible, setSummaryButtonVisible] = useState(false);
  useEffect(() => {
    const el = summaryButtonRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setSummaryButtonVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [redirectingToPayment]);

  if (redirectingToPayment) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500/20 border-t-brand-500" />
        <p className="mt-4 font-display text-xl text-ink-900">Taking you to secure payment…</p>
        <p className="mt-1 text-sm text-ink-500">
          Please don't close this window. You'll come back here once the payment is done.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 pt-8 pb-28">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold tracking-wider text-brand-700 uppercase">
          Keyafe Foods
        </p>
        <h1 className="mt-1 font-display text-2xl text-ink-900 md:text-3xl">Confirm your order</h1>
        <p className="mt-1 text-sm text-ink-500">
          Your baker has locked in the design & price. Just fill in your details to confirm.
        </p>
      </div>

      {/* Locked items */}
      <div className="mb-6">
        <p className="mb-2 text-[11px] font-semibold tracking-wider text-brand-700 uppercase">
          {link.items.length > 1 ? `Your order · ${link.items.length} items` : "Your order"}
        </p>
        <div className={cn("grid gap-3", link.items.length > 1 && "sm:grid-cols-2")}>
          {link.items.map((item) => (
            <LockedItemCard key={item.id} item={item} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-500">Includes GST. Delivery fee added below.</p>
      </div>

      <div className="space-y-5">
        <Section title="How and when?">
          <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:gap-x-4">
            <FulfillmentButton
              active={fulfillment === "DELIVERY"}
              onClick={() => setFulfillment("DELIVERY")}
              title="Home delivery"
            />
            <FulfillmentButton
              active={fulfillment === "PICKUP"}
              onClick={() => setFulfillment("PICKUP")}
              title="Store pickup"
            />
            <Field
              label={fulfillment === "DELIVERY" ? "Delivery date" : "Pickup date"}
              required
              error={errors.date}
            >
              <input
                type="date"
                value={date}
                min={todayIso()}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
              />
            </Field>
            <Field label="Time slot" required>
              <select
                value={slotKey}
                onChange={(e) => setSlotKey(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
              >
                {PRODUCT_COPY.timeSlots.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                    {s.surcharge > 0 && ` (+₹${s.surcharge})`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Your details">
          <div
            className={cn(
              "grid gap-5",
              fulfillment === "DELIVERY" &&
                "sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-cream-200",
            )}
          >
            <div
              className={cn(
                "grid grid-cols-2 content-start gap-x-3 gap-y-3",
                fulfillment === "DELIVERY" && "sm:pr-5",
              )}
            >
              {fulfillment === "DELIVERY" && <ColumnLabel className="col-span-2">You</ColumnLabel>}
              <Field label="Name" required error={errors.name}>
                <Input value={name} onChange={setName} placeholder="Aarav Sharma" />
              </Field>
              <Field label="Phone" required error={errors.phone}>
                <Input value={phone} onChange={setPhone} placeholder="9876543210" inputMode="tel" />
              </Field>
              <Field label="Email (optional)" error={errors.email} className="col-span-2">
                <Input
                  value={email}
                  onChange={setEmail}
                  placeholder="For the receipt"
                  inputMode="email"
                />
              </Field>
              <div className="col-span-2">
                <BusinessGstFields
                  enabled={isBusinessOrder}
                  onEnabledChange={setIsBusinessOrder}
                  companyName={companyName}
                  onCompanyNameChange={setCompanyName}
                  gstin={gstin}
                  onGstinChange={setGstin}
                  companyError={errors.companyName}
                  gstinError={errors.gstin}
                />
              </div>
            </div>

            {fulfillment === "DELIVERY" && (
              <div className="grid grid-cols-2 content-start gap-x-3 gap-y-3 border-t border-cream-200 pt-4 sm:border-t-0 sm:pt-0 sm:pl-5">
                <ColumnLabel className="col-span-2">Recipient</ColumnLabel>
                <div className="col-span-2">
                  <CheckRow
                    checked={recipientIsMe}
                    onChange={setRecipientIsMe}
                    title="Same as me"
                    subtitle="Uncheck if it's for someone else"
                  />
                </div>
                {!recipientIsMe && (
                  <>
                    <Field label="Name" required error={errors.recipientName}>
                      <Input
                        value={recipientName}
                        onChange={setRecipientName}
                        placeholder="Who receives it"
                      />
                    </Field>
                    <Field label="Phone" required error={errors.deliveryPhone}>
                      <Input
                        value={deliveryPhone}
                        onChange={setDeliveryPhone}
                        placeholder="9876543210"
                        inputMode="tel"
                      />
                    </Field>
                    <div className="col-span-2">
                      <CheckRow
                        checked={isSurpriseGift}
                        onChange={setIsSurpriseGift}
                        title="Surprise gift"
                        subtitle="We'll confirm with you only, not the recipient"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </Section>

        {fulfillment === "DELIVERY" && (
          <Section title="Delivery address">
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4">
              <Field
                label="Find your address"
                required
                error={errors.mapSearchQuery}
                className="col-span-2"
              >
                <AddressPlacesSearch
                  value={mapSearchQuery}
                  onChange={setMapSearchQuery}
                  onPlaceSelect={(place) => {
                    if (place.line1) setLine1(place.line1);
                    if (place.city) setLine2(place.city);
                    if (place.pincode) setPincode(place.pincode);
                  }}
                />
              </Field>
              <Field label="Address line 1" required error={errors.line1} className="col-span-2">
                <Input value={line1} onChange={setLine1} placeholder="Flat / building / street" />
              </Field>
              <Field label="Area (optional)">
                <Input value={line2} onChange={setLine2} placeholder="Area / locality" />
              </Field>
              <Field label="Landmark (optional)">
                <Input
                  value={landmark}
                  onChange={setLandmark}
                  placeholder="Near the metro station"
                />
              </Field>
              <Field label="Pincode" required error={errors.pincode} className="col-span-2">
                <div className="flex items-center gap-3">
                  <Input
                    value={pincode}
                    onChange={(v) => setPincode(v.replace(/\D/g, "").slice(0, 6))}
                    placeholder="711202"
                    className="w-32"
                    inputMode="numeric"
                  />
                  {PINCODE_RE.test(pincode) &&
                    (pincodeCheck.isPending ? (
                      <span className="text-xs text-ink-500">Checking…</span>
                    ) : pincodeResult ? (
                      pincodeResult.serviceable ? (
                        <span className="text-xs text-emerald-700">
                          {[pincodeResult.city, pincodeResult.area].filter(Boolean).join(" · ")}
                          {lockedDeliveryFee == null
                            ? ` · ₹${pincodeResult.deliveryFee} delivery`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-brand-700">
                          We may deliver here. Please call or whatsapp us to confirm
                        </span>
                      )
                    ) : null)}
                </div>
              </Field>
              <div className="col-span-2">
                <CheckRow
                  checked={billingSameAsDelivery}
                  onChange={setBillingSameAsDelivery}
                  title="Billing address is the same"
                  subtitle="Uncheck if the invoice should go elsewhere"
                />
              </div>
            </div>
            {!billingSameAsDelivery && (
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-cream-200 pt-4 sm:gap-x-4">
                <ColumnLabel className="col-span-2">Billing address</ColumnLabel>
                <Field
                  label="Find billing address"
                  required
                  error={errors.billMapSearchQuery}
                  className="col-span-2"
                >
                  <AddressPlacesSearch
                    value={billMapSearchQuery}
                    onChange={setBillMapSearchQuery}
                    onPlaceSelect={(place) => {
                      if (place.line1) setBillLine1(place.line1);
                      if (place.city) setBillLine2(place.city);
                      if (place.pincode) setBillPincode(place.pincode);
                    }}
                  />
                </Field>
                <Field
                  label="Address line 1"
                  required
                  error={errors.billLine1}
                  className="col-span-2"
                >
                  <Input
                    value={billLine1}
                    onChange={setBillLine1}
                    placeholder="Flat / building / street"
                  />
                </Field>
                <Field label="Area (optional)">
                  <Input value={billLine2} onChange={setBillLine2} placeholder="Area / locality" />
                </Field>
                <Field label="Landmark (optional)">
                  <Input
                    value={billLandmark}
                    onChange={setBillLandmark}
                    placeholder="Near the metro station"
                  />
                </Field>
                <Field label="Pincode" required error={errors.billPincode}>
                  <Input
                    value={billPincode}
                    onChange={(v) => setBillPincode(v.replace(/\D/g, "").slice(0, 6))}
                    placeholder="711202"
                    className="w-32"
                    inputMode="numeric"
                  />
                </Field>
              </div>
            )}
          </Section>
        )}

        <Section title="Anything else?" subtitle="Optional notes for the kitchen or delivery team">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Please call before arriving…"
            className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
        </Section>

        <Section
          title="Payment"
          subtitle={
            onlinePaymentAvailable
              ? "Pay now securely online, or pay when your order arrives."
              : "Pay when your order is delivered or picked up."
          }
        >
          <div className={cn("grid grid-cols-3 gap-2", !onlinePaymentAvailable && "hidden")}>
            <FulfillmentButton
              active={payChoice === "FULL"}
              onClick={() => setPayChoice("FULL")}
              title="Pay in full"
            />
            <FulfillmentButton
              active={payChoice === "ADVANCE"}
              onClick={() => setPayChoice("ADVANCE")}
              title="Pay advance"
            />
            <FulfillmentButton
              active={payChoice === "COD"}
              onClick={() => setPayChoice("COD")}
              title="Pay on delivery"
            />
          </div>

          {payChoice === "ADVANCE" && (
            <Field
              label="Advance amount"
              required
              error={errors.advanceAmount}
              hint={`Rest (₹${Math.max(total - (Number(advanceAmount) || 0), 0).toFixed(0)}) is paid on delivery.`}
              className="mt-3"
            >
              <Input
                value={advanceAmount}
                onChange={(v) => setAdvanceAmount(v.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                inputMode="decimal"
              />
            </Field>
          )}

          {payChoice === "COD" ? (
            <p className="mt-4 rounded-md bg-cream-50 px-3 py-2 text-xs text-ink-500">
              Pay the full amount in cash or UPI when your order is delivered or picked up.
            </p>
          ) : (
            <p className="mt-4 rounded-md bg-cream-50 px-3 py-2 text-xs text-ink-500">
              After confirming, you'll be taken to Cashfree's secure page to pay
              {payNowAmount > 0 ? ` ₹${payNowAmount.toFixed(2)}` : ""} by UPI, card or netbanking.
            </p>
          )}
        </Section>

        <div className="rounded-card border border-cream-200 bg-cream-50 p-5">
          <SummaryRow label="Subtotal" value={subtotal} />
          {discount > 0 && (
            <SummaryRow
              label={
                link.discountType === "PERCENT"
                  ? `Discount (${Number(link.discountValue)}%)`
                  : "Discount"
              }
              value={-discount}
            />
          )}
          {fulfillment === "DELIVERY" && (
            <SummaryRow
              label={link.deliveryPaidToRider ? "Delivery (pay the rider)" : "Delivery"}
              value={pincodeResult?.serviceable ? deliveryFee : null}
              hint={pincodeResult?.serviceable ? undefined : "Enter pincode"}
            />
          )}
          {gstOnTop > 0 && <SummaryRow label="GST" value={gstOnTop} />}
          <hr className="my-3 border-cream-200" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-700">Total</span>
            <span className="text-2xl font-semibold text-ink-900 tabular-nums">
              ₹{total.toFixed(2)}
            </span>
          </div>
          {link.deliveryPaidToRider && fulfillment === "DELIVERY" && deliveryFee > 0 && (
            <p className="mt-1 text-xs text-ink-500">
              Excludes ₹{deliveryFee.toFixed(0)} delivery, which you pay the rider directly.
            </p>
          )}
          {payChoice === "ADVANCE" && Number(advanceAmount) > 0 && (
            <>
              <SummaryRow label="Paying now" value={Number(advanceAmount)} />
              <SummaryRow
                label="Due on delivery"
                value={Math.max(total - Number(advanceAmount), 0)}
              />
            </>
          )}
          {payChoice === "COD" && <SummaryRow label="Due on delivery" value={total} />}

          {submitError && (
            <p className="mt-3 rounded-md bg-brand-100/60 px-3 py-2 text-xs text-brand-700">
              {submitError}
            </p>
          )}

          <button
            ref={summaryButtonRef}
            type="button"
            onClick={submit}
            disabled={place.isPending || !isValid}
            className="mt-4 block w-full rounded-full bg-brand-500 py-3 text-center text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitLabel}
          </button>
          {missingHint && <p className="mt-2 text-center text-xs text-brand-700">{missingHint}</p>}
          <p className="mt-2 text-center text-[11px] text-ink-500">
            By confirming you agree to the price locked above and our{" "}
            <a
              href="/cancellation-policy"
              target="_blank"
              rel="noreferrer"
              className="hover:text-brand-600 underline"
            >
              cancellation &amp; refund policy
            </a>
            .
          </p>
        </div>
      </div>

      <StickyPayBar
        hidden={summaryButtonVisible}
        amountLabel={payingAdvance ? "Paying now" : "Total"}
        amount={payingAdvance ? Number(advanceAmount) : total}
        subLabel={
          payingAdvance
            ? `₹${Math.max(total - Number(advanceAmount), 0).toFixed(0)} on delivery`
            : deliveryFeePending && !link.deliveryPaidToRider
              ? "+ delivery"
              : payChoice === "COD"
                ? "Pay on delivery"
                : undefined
        }
        buttonLabel={submitLabel}
        hint={missingHint}
        disabled={place.isPending || !isValid}
        onSubmit={submit}
      />
    </section>
  );
}

type LockedItem = NonNullable<ReturnType<typeof useOrderLink>["data"]>["items"][number];

function LockedItemCard({ item }: { item: LockedItem }) {
  const itemTotal = Number(item.unitPrice) * item.qty;
  const specs = [item.sizeLabel, item.flavourName, item.qty > 1 ? `Qty ${item.qty}` : null].filter(
    Boolean,
  );
  return (
    <div className="flex gap-3 rounded-card border-2 border-brand-500/30 bg-white p-3 shadow-sm sm:gap-4">
      {item.referenceImageUrl ? (
        <a
          href={item.referenceImageUrl}
          target="_blank"
          rel="noreferrer"
          className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-cream-100 sm:h-24 sm:w-24"
          aria-label={`View ${item.productName} image`}
        >
          <img
            src={item.referenceImageUrl}
            alt={item.productName}
            className="h-full w-full object-cover"
          />
        </a>
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-cream-100 text-[10px] text-ink-500 sm:h-24 sm:w-24">
          No image
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base leading-snug text-ink-900 sm:text-lg">
          {item.productName}
        </h2>
        {specs.length > 0 && <p className="mt-0.5 text-xs text-ink-500">{specs.join(" · ")}</p>}
        {item.description && (
          <p className="mt-1 text-xs whitespace-pre-line text-ink-700">{item.description}</p>
        )}
        <p className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-lg font-semibold text-ink-900 tabular-nums">
            ₹{Number(item.unitPrice).toFixed(0)}
          </span>
          {item.qty > 1 && (
            <span className="text-xs text-ink-500">
              × {item.qty} = ₹{itemTotal.toFixed(0)}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function StickyPayBar({
  hidden,
  amountLabel,
  amount,
  subLabel,
  hint,
  buttonLabel,
  disabled,
  onSubmit,
}: {
  hidden: boolean;
  amountLabel: string;
  amount: number;
  subLabel?: string;
  hint?: string | null;
  buttonLabel: string;
  disabled: boolean;
  onSubmit: () => void;
}) {
  return (
    <div
      aria-hidden={hidden}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-cream-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur transition-transform duration-200",
        hidden && "pointer-events-none translate-y-full",
      )}
    >
      {hint && (
        <p className="mx-auto mb-2 max-w-3xl text-center text-xs text-brand-700 sm:text-left">
          {hint}
        </p>
      )}
      <div className="mx-auto flex max-w-3xl items-center gap-3 sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-ink-500">{amountLabel}</p>
          <p className="text-lg leading-tight font-semibold text-ink-900 tabular-nums">
            ₹{amount.toFixed(2)}
          </p>
          {subLabel && <p className="truncate text-[11px] text-ink-500">{subLabel}</p>}
        </div>
        <button
          type="button"
          tabIndex={hidden ? -1 : undefined}
          onClick={onSubmit}
          disabled={disabled}
          className="shrink-0 rounded-full bg-brand-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-56 sm:px-8"
        >
          {buttonLabel}
        </button>
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
    <section className="rounded-card border border-cream-200 bg-white p-5">
      <h2 className="font-display text-lg text-ink-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      <div className={cn(!subtitle && "mt-3")}>{children}</div>
    </section>
  );
}

function ColumnLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] font-semibold tracking-wider text-ink-500 uppercase", className)}>
      {children}
    </p>
  );
}

function CheckRow({
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
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="border-cream-300 text-brand-600 mt-0.5 h-4 w-4 shrink-0 rounded focus:ring-brand-500/20"
      />
      <span>
        <span className="text-sm font-medium text-ink-900">{title}</span>
        {subtitle && <span className="mt-0.5 block text-xs text-ink-500">{subtitle}</span>}
      </span>
    </label>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-700">
        {label}
        {required && <span className="text-brand-500">*</span>}
      </span>
      {children}
      {(hint || error) && (
        <span
          data-field-error={error ? true : undefined}
          className={cn("mt-1 block text-[11px]", error ? "text-brand-700" : "text-ink-500")}
        >
          {error ?? hint}
        </span>
      )}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  className,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputMode?: "numeric" | "tel" | "email" | "decimal";
}) {
  return (
    <input
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none",
        className,
      )}
    />
  );
}

function FulfillmentButton({
  active,
  onClick,
  title,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-3 text-sm font-medium transition",
        active
          ? "border-brand-500 bg-brand-100/60 text-brand-700"
          : "border-cream-200 bg-white text-ink-700 hover:border-brand-300",
      )}
    >
      {title}
    </button>
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
    <div className="flex items-baseline justify-between py-0.5 text-sm">
      <span className="text-ink-700">{label}</span>
      <span className={cn("tabular-nums", value == null && "text-xs text-ink-500")}>
        {value == null
          ? hint
          : value < 0
            ? `−₹${Math.abs(value).toFixed(2)}`
            : `₹${value.toFixed(2)}`}
      </span>
    </div>
  );
}

function PageSkeleton() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mx-auto h-6 w-40 animate-pulse rounded bg-cream-100" />
    </section>
  );
}

function PageError({
  title,
  message,
  cta,
}: {
  title: string;
  message: string;
  cta?: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink-900">{title}</h1>
      <p className="mt-2 text-sm text-ink-500">{message}</p>
      <div className="mt-6 flex justify-center gap-3">
        {cta}
        <Link
          to="/"
          className="rounded-full border border-ink-700 px-5 py-2 text-sm font-medium text-ink-700 hover:bg-cream-100"
        >
          Back to home
        </Link>
      </div>
    </section>
  );
}
