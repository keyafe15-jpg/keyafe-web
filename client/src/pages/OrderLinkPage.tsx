import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useOrderLink, usePlaceOrderLink } from "@/hooks/useOrderLink";
import {
  usePincodeCheck,
  type PincodeCheckResult,
} from "@/hooks/usePincodeCheck";
import { PRODUCT_COPY } from "@/content/product";
import { uploadImage } from "@/lib/uploads";
import { usePaymentInfo } from "@/hooks/usePaymentInfo";
import { buildUpiUri } from "@/lib/upi";
import { UpiQrCode } from "@/components/UpiQrCode";
import { cn } from "@/lib/cn";

type Fulfillment = "DELIVERY" | "PICKUP";
type PayChoice = "FULL" | "ADVANCE" | "COD";

const PHONE_RE = /^[0-9+\-\s]{7,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_RE = /^\d{6}$/;

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
        message={
          error instanceof Error ? error.message : "This link isn't valid."
        }
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
              to={`/order/${link.linkedOrder.orderNumber}/success`}
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

function LinkForm({
  link,
}: {
  link: NonNullable<ReturnType<typeof useOrderLink>["data"]>;
}) {
  const navigate = useNavigate();
  const place = usePlaceOrderLink({ token: link.token });
  const pincodeCheck = usePincodeCheck();
  const { data: paymentInfo } = usePaymentInfo();

  const [fulfillment, setFulfillment] = useState<Fulfillment>("DELIVERY");
  const [name, setName] = useState(link.customerName ?? "");
  const [phone, setPhone] = useState(link.customerPhone ?? "");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [pincode, setPincode] = useState("");
  const [pincodeResult, setPincodeResult] = useState<PincodeCheckResult | null>(
    null,
  );
  const [date, setDate] = useState<string>(
    link.suggestedDate ? link.suggestedDate.slice(0, 10) : "",
  );
  const [slotKey, setSlotKey] = useState<string>(
    link.suggestedSlotKey ?? PRODUCT_COPY.timeSlots[0].key,
  );
  const [notes, setNotes] = useState("");
  const [payChoice, setPayChoice] = useState<PayChoice>("FULL");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(
    null,
  );
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const slot =
    PRODUCT_COPY.timeSlots.find((s) => s.key === slotKey) ??
    PRODUCT_COPY.timeSlots[0];

  const subtotal = link.items.reduce(
    (sum, it) => sum + Number(it.unitPrice) * it.qty,
    0,
  );
  const deliveryFee =
    fulfillment === "DELIVERY" && pincodeResult?.serviceable
      ? pincodeResult.deliveryFee
      : 0;
  const total = subtotal + deliveryFee;

  const payNowAmount =
    payChoice === "FULL"
      ? total
      : payChoice === "ADVANCE"
        ? Number(advanceAmount) || 0
        : 0;
  const upiUri =
    paymentInfo?.upiId && payNowAmount > 0
      ? buildUpiUri({
          payeeVpa: paymentInfo.upiId,
          payeeName: paymentInfo.payeeName,
          amount: payNowAmount,
          note: `Order ${link.items.map((i) => i.productName).join(", ")}`.slice(
            0,
            50,
          ),
          refId: link.token,
        })
      : null;

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

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Enter your name";
    if (!PHONE_RE.test(phone.trim())) e.phone = "Enter a valid phone";
    if (email.trim() && !EMAIL_RE.test(email.trim()))
      e.email = "Enter a valid email";
    if (!date) e.date = "Pick a delivery date";
    if (fulfillment === "DELIVERY") {
      if (line1.trim().length < 3) e.line1 = "Street address is required";
      if (!PINCODE_RE.test(pincode)) e.pincode = "6-digit pincode";
      else if (pincodeResult && !pincodeResult.serviceable)
        e.pincode =
          "We may still deliver here, please call or WhatsApp us to confirm";
      if (mapSearchQuery.trim().length < 3)
        e.mapSearchQuery = "Tell us what to search on Uber / Rapido";
    }
    if (payChoice !== "COD" && !screenshotFile)
      e.screenshot = "Upload a screenshot of your payment";
    if (
      payChoice === "ADVANCE" &&
      (!advanceAmount.trim() ||
        Number(advanceAmount) <= 0 ||
        Number(advanceAmount) > total)
    )
      e.advanceAmount = `Enter an advance between ₹1 and ₹${total.toFixed(0)}`;
    return e;
  }, [
    name,
    phone,
    email,
    date,
    fulfillment,
    line1,
    pincode,
    pincodeResult,
    mapSearchQuery,
    screenshotFile,
    payChoice,
    advanceAmount,
    total,
  ]);
  const isValid = Object.keys(errors).length === 0;

  const submit = async () => {
    if (!isValid) return;
    if (payChoice !== "COD" && !screenshotFile) return;
    setSubmitError(null);
    try {
      let publicUrl: string | null = null;
      if (screenshotFile) {
        setScreenshotUploading(true);
        const res = await uploadImage(screenshotFile, "payment-screenshot");
        publicUrl = res.publicUrl;
        setScreenshotUploading(false);
      }

      const order = await place.mutateAsync({
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim() || null,
        fulfillment,
        deliveryAddress:
          fulfillment === "DELIVERY"
            ? {
                line1: line1.trim(),
                line2: line2.trim() || null,
                landmark: landmark.trim() || null,
                mapSearchQuery: mapSearchQuery.trim(),
                pincode,
                city: pincodeResult?.serviceable ? pincodeResult.city : null,
                area: pincodeResult?.serviceable ? pincodeResult.area : null,
                state: "West Bengal",
                stateCode: "19",
              }
            : null,
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
        paymentScreenshotUrl: publicUrl,
      });
      navigate(`/order/${order.orderNumber}/success`, { replace: true });
    } catch (err) {
      setScreenshotUploading(false);
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    }
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
          Keyafe Bakery
        </p>
        <h1 className="mt-1 font-display text-2xl text-ink-900 md:text-3xl">
          Confirm your order
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Your baker has locked in the design & price. Just fill in your details
          to confirm.
        </p>
      </div>

      {/* Locked items */}
      <div className="mb-6 space-y-3">
        {link.items.map((item) => {
          const itemTotal = Number(item.unitPrice) * item.qty;
          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-card border-2 border-brand-500/30 bg-white shadow-sm"
            >
              <div className="grid gap-0 sm:grid-cols-[160px_1fr]">
                <div className="aspect-square w-full bg-cream-100 sm:aspect-auto">
                  {item.referenceImageUrl ? (
                    <img
                      src={item.referenceImageUrl}
                      alt={item.productName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full min-h-32 w-full items-center justify-center text-xs text-ink-400">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-700">
                    Your order
                  </p>
                  <h2 className="mt-1 font-display text-xl text-ink-900">
                    {item.productName}
                  </h2>
                  <dl className="mt-2 space-y-0.5 text-sm text-ink-700">
                    {item.sizeLabel && (
                      <div className="flex gap-1.5">
                        <dt className="text-ink-500">Size:</dt>
                        <dd>{item.sizeLabel}</dd>
                      </div>
                    )}
                    {item.flavourName && (
                      <div className="flex gap-1.5">
                        <dt className="text-ink-500">Flavour:</dt>
                        <dd>{item.flavourName}</dd>
                      </div>
                    )}
                    {item.qty > 1 && (
                      <div className="flex gap-1.5">
                        <dt className="text-ink-500">Qty:</dt>
                        <dd>{item.qty}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-ink-900">
                      ₹{Number(item.unitPrice).toFixed(0)}
                    </span>
                    {item.qty > 1 && (
                      <span className="text-sm text-ink-500">
                        × {item.qty} = ₹{itemTotal.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <p className="text-[11px] text-ink-500">
          Includes GST. Delivery fee added below.
        </p>
      </div>

      <div className="space-y-5">
        <Section title="Contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={errors.name}>
              <Input
                value={name}
                onChange={setName}
                placeholder="Aarav Sharma"
              />
            </Field>
            <Field label="Phone" required error={errors.phone}>
              <Input
                value={phone}
                onChange={setPhone}
                placeholder="9876543210"
              />
            </Field>
            <Field
              label="Email"
              hint="Optional — for the receipt"
              error={errors.email}
              className="sm:col-span-2"
            >
              <Input
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
              />
            </Field>
          </div>
        </Section>

        <Section title="How should we get it to you?">
          <div className="grid grid-cols-2 gap-2">
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
          </div>
        </Section>

        {fulfillment === "DELIVERY" && (
          <Section title="Delivery address">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Pincode"
                required
                error={errors.pincode}
                className="sm:col-span-2"
              >
                <div className="flex items-center gap-3">
                  <Input
                    value={pincode}
                    onChange={(v) =>
                      setPincode(v.replace(/\D/g, "").slice(0, 6))
                    }
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
                          {[pincodeResult.city, pincodeResult.area]
                            .filter(Boolean)
                            .join(" · ")}{" "}
                          · ₹{pincodeResult.deliveryFee} delivery
                        </span>
                      ) : (
                        <span className="text-xs text-brand-700">
                          We may deliver here. Please call or whatsapp us to
                          confirm
                        </span>
                      )
                    ) : null)}
                </div>
              </Field>
              <Field
                label="Address line 1"
                required
                error={errors.line1}
                className="sm:col-span-2"
              >
                <Input
                  value={line1}
                  onChange={setLine1}
                  placeholder="Flat / building / street"
                />
              </Field>
              <Field label="Address line 2" className="sm:col-span-2">
                <Input
                  value={line2}
                  onChange={setLine2}
                  placeholder="Area / locality (optional)"
                />
              </Field>
              <Field
                label="Landmark"
                hint="Helps our delivery partner find you"
              >
                <Input
                  value={landmark}
                  onChange={setLandmark}
                  placeholder="Near the metro station"
                />
              </Field>
              <Field
                label="Uber / Rapido search"
                required
                error={errors.mapSearchQuery}
                hint="What we'd type in Uber or Rapido to find you."
                className="sm:col-span-2"
              >
                <Input
                  value={mapSearchQuery}
                  onChange={setMapSearchQuery}
                  placeholder='e.g. "Ganguly Bagan Metro Station"'
                />
              </Field>
            </div>
          </Section>
        )}

        <Section title="When?">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" required error={errors.date}>
              <input
                type="date"
                value={date}
                min={todayIso()}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </Field>
            <Field label="Time slot" required>
              <select
                value={slotKey}
                onChange={(e) => setSlotKey(e.target.value)}
                className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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

        <Section
          title="Anything else?"
          subtitle="Optional notes for the kitchen or delivery team"
        >
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Please call before arriving…"
            className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </Section>

        <Section
          title="Payment"
          subtitle="Pay now via UPI, or pay when your order arrives."
        >
          <div className="grid grid-cols-3 gap-2">
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
              Pay the full amount in cash or UPI when your order is delivered or
              picked up.
            </p>
          ) : (
            <>
              {upiUri ? (
                <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-cream-200 bg-cream-50 p-4 text-center">
                  <UpiQrCode uri={upiUri} />
                  <p className="text-sm font-medium text-ink-900">
                    Pay ₹{payNowAmount.toFixed(2)} to{" "}
                    <span className="text-brand-700">{paymentInfo?.upiId}</span>
                  </p>
                  <a
                    href={upiUri}
                    className="w-full rounded-full bg-brand-500 py-2.5 text-center text-sm font-medium text-white transition hover:bg-brand-700"
                  >
                    Pay with UPI app
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      paymentInfo?.upiId &&
                      navigator.clipboard.writeText(paymentInfo.upiId)
                    }
                    className="text-xs text-ink-500 hover:text-brand-700 hover:underline"
                  >
                    Copy UPI ID
                  </button>
                </div>
              ) : (
                <p className="mt-4 rounded-md bg-cream-50 px-3 py-2 text-xs text-ink-500">
                  Please transfer ₹{payNowAmount.toFixed(2)} via UPI/bank
                  transfer as instructed, then upload the screenshot below.
                </p>
              )}

              <Field
                label="Payment screenshot"
                required
                error={errors.screenshot}
                className="mt-3"
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setScreenshotFile(e.target.files?.[0] ?? null)
                  }
                  className="block w-full text-xs text-ink-700 file:mr-3 file:rounded-md file:border-0 file:bg-cream-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink-700"
                />
                {screenshotPreview && (
                  <img
                    src={screenshotPreview}
                    alt="Payment screenshot preview"
                    className="mt-2 h-32 w-32 rounded-md border border-cream-200 object-cover"
                  />
                )}
              </Field>
            </>
          )}
        </Section>

        <div className="rounded-card border border-cream-200 bg-cream-50 p-5">
          <SummaryRow label="Subtotal" value={subtotal} />
          {fulfillment === "DELIVERY" && (
            <SummaryRow
              label="Delivery"
              value={pincodeResult?.serviceable ? deliveryFee : null}
              hint={pincodeResult?.serviceable ? undefined : "Enter pincode"}
            />
          )}
          <hr className="my-3 border-cream-200" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-700">Total</span>
            <span className="text-2xl font-semibold tabular-nums text-ink-900">
              ₹{total.toFixed(2)}
            </span>
          </div>
          {payChoice === "ADVANCE" && Number(advanceAmount) > 0 && (
            <>
              <SummaryRow label="Paying now" value={Number(advanceAmount)} />
              <SummaryRow
                label="Due on delivery"
                value={Math.max(total - Number(advanceAmount), 0)}
              />
            </>
          )}
          {payChoice === "COD" && (
            <SummaryRow label="Due on delivery" value={total} />
          )}

          {submitError && (
            <p className="mt-3 rounded-md bg-brand-100/60 px-3 py-2 text-xs text-brand-700">
              {submitError}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!isValid || place.isPending || screenshotUploading}
            className="mt-4 block w-full rounded-full bg-brand-500 py-3 text-center text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {screenshotUploading
              ? "Uploading screenshot…"
              : place.isPending
                ? "Placing order…"
                : "Confirm order"}
          </button>
          <p className="mt-2 text-center text-[11px] text-ink-500">
            By confirming you agree to the price locked above.
          </p>
        </div>
      </div>
    </section>
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
    <label className={cn("block", className)}>
      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-700">
        {label}
        {required && <span className="text-brand-500">*</span>}
      </span>
      {children}
      {(hint || error) && (
        <span
          className={cn(
            "mt-1 block text-[11px]",
            error ? "text-brand-700" : "text-ink-500",
          )}
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
        "w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20",
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
      <span
        className={cn("tabular-nums", value == null && "text-xs text-ink-500")}
      >
        {value == null ? hint : `₹${value.toFixed(2)}`}
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
