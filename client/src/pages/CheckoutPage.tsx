import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { useCart } from "@/store/cart";
import { useSavedAddresses } from "@/store/addresses";
import { useCreateOrder } from "@/hooks/useOrders";
import {
  usePincodeCheck,
  type PincodeCheckResult,
} from "@/hooks/usePincodeCheck";
import { PRODUCT_COPY } from "@/content/product";
import { cn } from "@/lib/cn";

type Fulfillment = "DELIVERY" | "PICKUP";

const PHONE_RE = /^[0-9+\-\s]{7,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_RE = /^\d{6}$/;

export function CheckoutPage() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const lines = useCart((s) => s.lines);
  const subtotal = useCart((s) => s.subtotal());
  const clear = useCart((s) => s.clear);
  const createOrder = useCreateOrder();
  const pincodeCheck = usePincodeCheck();
  const savedAddresses = useSavedAddresses((s) => s.addresses);
  const addSavedAddress = useSavedAddresses((s) => s.addAddress);
  const fetchSavedAddresses = useSavedAddresses((s) => s.fetchAddresses);

  // Seed defaults from the first cart line so smooth-return-from-PDP flow works.
  const seed = lines[0];
  const [fulfillment, setFulfillment] = useState<Fulfillment>(
    seed?.fulfillment === "pickup" ? "PICKUP" : "DELIVERY",
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [pincode, setPincode] = useState("");
  const [pincodeResult, setPincodeResult] = useState<PincodeCheckResult | null>(
    null,
  );
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<
    string | null
  >(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName((current) => current || user.name);
      setPhone((current) => current || user.phone);
      setEmail((current) => current || user.email || "");
      void fetchSavedAddresses();
    }
  }, [fetchSavedAddresses, user]);

  useEffect(() => {
    if (!user || savedAddresses.length === 0) {
      setSelectedSavedAddressId(null);
      setShowNewAddressForm(false);
      return;
    }

    const defaultAddress =
      savedAddresses.find((address) => address.isDefault) ?? savedAddresses[0];
    if (!selectedSavedAddressId && !showNewAddressForm) {
      setSelectedSavedAddressId(defaultAddress.id);
    }
  }, [savedAddresses, selectedSavedAddressId, showNewAddressForm, user]);

  const applySavedAddress = (address: (typeof savedAddresses)[number]) => {
    setSelectedSavedAddressId(address.id);
    setShowNewAddressForm(false);
    setLine1(address.line1);
    setLine2(address.line2 ?? "");
    setLandmark(address.landmark ?? "");
    setPincode(address.pincode);
    setMapSearchQuery(`${address.line1}, ${address.city}, ${address.pincode}`);
  };

  // Every line already carries its own delivery date + slot (set on the PDP).
  // Pan-India (courier-shipped) lines intentionally skip that — no local slot.
  const hasOnlyPanIndiaItems =
    lines.length > 0 && lines.every((l) => l.isPanIndia);
  const scheduledLines = lines.filter((l) => !l.isPanIndia);
  const missingSchedule = scheduledLines.some((l) => !l.date || !l.slotKey);
  // Recompute against a live tick so the "past slot" state flips right as it expires.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const expiredLines = useMemo(
    () =>
      scheduledLines.filter(
        (l) => l.date && l.slotKey && isSlotInPast(l.date, l.slotKey, now),
      ),
    [scheduledLines, now],
  );
  const hasExpired = expiredLines.length > 0;

  const deliveryFee = hasOnlyPanIndiaItems
    ? 0
    : fulfillment === "DELIVERY" && pincodeResult?.serviceable
      ? pincodeResult.deliveryFee
      : 0;
  const total = subtotal + deliveryFee;

  // Auto-lookup pincode as soon as it's 6 digits.
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
    if (missingSchedule)
      e.schedule =
        "Each item needs a delivery date. Set it on the product page.";
    if (hasExpired)
      e.schedule =
        expiredLines.length === lines.length
          ? "Your chosen delivery time is in the past. Please pick a new date/slot on the product pages."
          : `${expiredLines.length} of your items have a delivery time that has passed. Update them on the product pages.`;
    if (fulfillment === "DELIVERY") {
      if (line1.trim().length < 3) e.line1 = "Street address is required";
      if (!PINCODE_RE.test(pincode)) e.pincode = "6-digit pincode";
      else if (
        !hasOnlyPanIndiaItems &&
        pincodeResult &&
        !pincodeResult.serviceable
      )
        e.pincode = "We don't deliver to this pincode yet";
      if (mapSearchQuery.trim().length < 3)
        e.mapSearchQuery = "Tell us what to search on Uber / Rapido";
    }
    return e;
  }, [
    name,
    phone,
    email,
    missingSchedule,
    hasExpired,
    expiredLines.length,
    lines.length,
    fulfillment,
    line1,
    pincode,
    pincodeResult,
    mapSearchQuery,
    hasOnlyPanIndiaItems,
  ]);
  const isValid = Object.keys(errors).length === 0 && lines.length > 0;

  if (lines.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="mb-3 font-display text-3xl text-ink-900">
          Your cart is empty
        </h1>
        <p className="mb-6 text-ink-500">
          Add something delicious before checking out.
        </p>
        <Link
          to="/"
          className="inline-block rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white hover:bg-brand-700"
        >
          Browse the menu
        </Link>
      </section>
    );
  }

  const saveNewAddress = async () => {
    if (!user) return;
    if (!line1.trim() || !pincode.trim() || !mapSearchQuery.trim()) {
      setSubmitError("Please complete the address details before saving.");
      return;
    }

    const created = await addSavedAddress({
      label: "Home",
      recipientName: name.trim() || user.name,
      phone: phone.trim() || user.phone,
      line1: line1.trim(),
      line2: line2.trim() || undefined,
      landmark: landmark.trim() || undefined,
      mapSearchQuery: mapSearchQuery.trim(),
      city: pincodeResult?.serviceable ? pincodeResult.city : "Kolkata",
      state: "West Bengal",
      stateCode: "19",
      pincode: pincode.trim(),
      isDefault: savedAddresses.length === 0,
    });

    if (!created) {
      return;
    }

    setSelectedSavedAddressId(created.id);
    setShowNewAddressForm(false);
    setSubmitError(null);
    applySavedAddress(created);
  };

  const submit = async () => {
    if (!isValid) return;
    setSubmitError(null);
    try {
      const order = await createOrder.mutateAsync({
        userId: user?.id,
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
                mapSearchQuery: mapSearchQuery.trim() || null,
                pincode,
                city: pincodeResult?.serviceable ? pincodeResult.city : null,
                area: pincodeResult?.serviceable ? pincodeResult.area : null,
                state: "West Bengal",
                stateCode: "19",
              }
            : null,
        customerNotes: notes.trim() || null,
        paymentMethod: "cod",
        items: lines.map((l) => ({
          productId: l.productId,
          sizeGrams: l.sizeGrams ?? null,
          sizeLabel: l.sizeLabel ?? null,
          flavourId: l.flavourId ?? null,
          flavourName: l.flavourName ?? null,
          messageOnCake: l.messageOnCake ?? null,
          instructions: l.instructions ?? null,
          deliveryDate: l.isPanIndia ? null : (l.date ?? null),
          deliverySlotKey: l.isPanIndia ? null : (l.slotKey ?? null),
          deliverySlotLabel: l.isPanIndia
            ? null
            : (l.slotLabel ?? PRODUCT_COPY.timeSlots[0].label),
          unitPrice: l.unitPrice,
          qty: l.qty,
        })),
      });
      clear();
      navigate(`/order/${order.orderNumber}/success`, { replace: true });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <Link to="/cart" className="text-xs text-ink-500 hover:text-brand-500">
          ← Back to cart
        </Link>
        <h1 className="mt-2 font-display text-3xl text-ink-900">Checkout</h1>
        <p className="mt-1 text-sm text-ink-500">
          Continue as a guest — no account needed. We'll text you order updates.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <FormCard title="1 · Fulfillment">
            <div className="grid grid-cols-2 gap-3">
              <ChoiceButton
                active={fulfillment === "DELIVERY"}
                onClick={() => setFulfillment("DELIVERY")}
                title="Home delivery"
                subtitle="We bring it to your door"
              />
              <ChoiceButton
                active={fulfillment === "PICKUP"}
                onClick={() => setFulfillment("PICKUP")}
                title="Store pickup"
                subtitle="Collect from our bakery"
              />
            </div>
          </FormCard>

          <FormCard title="2 · Contact details">
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
                  placeholder="9330048665"
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
          </FormCard>

          {fulfillment === "DELIVERY" && (
            <FormCard title="3 · Delivery address">
              {user && savedAddresses.length > 0 && !showNewAddressForm && (
                <div className="mb-5 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                    Saved addresses
                  </p>
                  <div className="space-y-2">
                    {savedAddresses.map((address) => (
                      <button
                        key={address.id}
                        type="button"
                        onClick={() => applySavedAddress(address)}
                        className={cn(
                          "flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition",
                          selectedSavedAddressId === address.id
                            ? "border-brand-500 bg-brand-100/60"
                            : "border-cream-200 bg-white hover:border-brand-300",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-ink-900">
                              {address.label}
                            </span>
                            {address.isDefault && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-ink-700">
                            {address.recipientName} · {address.phone}
                          </p>
                          <p className="text-xs text-ink-500">
                            {address.line1}
                            {address.line2 ? `, ${address.line2}` : ""} ·{" "}
                            {address.city} - {address.pincode}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewAddressForm(true);
                      setSelectedSavedAddressId(null);
                    }}
                    className="text-sm font-medium text-brand-500 hover:text-brand-600"
                  >
                    + Add a new address
                  </button>
                </div>
              )}

              {(!user || savedAddresses.length === 0) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {user && savedAddresses.length > 0 && (
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewAddressForm(false);
                          const defaultAddress =
                            savedAddresses.find(
                              (address) => address.isDefault,
                            ) ?? savedAddresses[0];
                          if (defaultAddress) applySavedAddress(defaultAddress);
                        }}
                        className="text-sm font-medium text-brand-500 hover:text-brand-600"
                      >
                        ← Use a saved address
                      </button>
                    </div>
                  )}

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
                      <PincodeStatus
                        value={pincode}
                        result={pincodeResult}
                        isChecking={pincodeCheck.isPending}
                      />
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
                    hint="What we'd type in Uber or Rapido to find your location — an apartment name, shop, or well-known place nearby."
                    className="sm:col-span-2"
                  >
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
                        <svg
                          width={16}
                          height={16}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="11" cy="11" r="7" />
                          <path d="M20 20l-3-3" />
                        </svg>
                      </span>
                      <Input
                        value={mapSearchQuery}
                        onChange={setMapSearchQuery}
                        placeholder='e.g. "Ganguly Bagan Metro Station" or "Aditya Apartments, Salkia"'
                        className="pl-9"
                      />
                    </div>
                  </Field>

                  {user && (
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void saveNewAddress()}
                        className="rounded-full border border-brand-500 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-100"
                      >
                        Save address & continue
                      </button>
                    </div>
                  )}
                </div>
              )}

              <Dialog.Root
                open={showNewAddressForm}
                onOpenChange={(open) => {
                  setShowNewAddressForm(open);
                  if (!open) setSubmitError(null);
                }}
              >
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm" />
                  <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cream-200 bg-white p-5 shadow-2xl focus:outline-none">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Dialog.Title className="font-display text-2xl text-ink-900">
                          Add a new address
                        </Dialog.Title>
                        <Dialog.Description className="mt-1 text-sm text-ink-500">
                          Save this address for faster checkout next time.
                        </Dialog.Description>
                      </div>
                      <Dialog.Close
                        className="rounded-full p-1 text-ink-500 transition hover:bg-cream-100 hover:text-ink-900"
                        aria-label="Close address modal"
                      >
                        <svg
                          width={20}
                          height={20}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </Dialog.Close>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                          <PincodeStatus
                            value={pincode}
                            result={pincodeResult}
                            isChecking={pincodeCheck.isPending}
                          />
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
                        hint="What we'd type in Uber or Rapido to find your location — an apartment name, shop, or well-known place nearby."
                        className="sm:col-span-2"
                      >
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
                            <svg
                              width={16}
                              height={16}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <circle cx="11" cy="11" r="7" />
                              <path d="M20 20l-3-3" />
                            </svg>
                          </span>
                          <Input
                            value={mapSearchQuery}
                            onChange={setMapSearchQuery}
                            placeholder='e.g. "Ganguly Bagan Metro Station" or "Aditya Apartments, Salkia"'
                            className="pl-9"
                          />
                        </div>
                      </Field>
                    </div>

                    {submitError && (
                      <p className="mt-4 rounded-md bg-brand-100/60 px-3 py-2 text-xs text-brand-700">
                        {submitError}
                      </p>
                    )}

                    <div className="mt-5 flex items-center justify-end gap-3">
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          className="rounded-full border border-cream-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-600"
                        >
                          Cancel
                        </button>
                      </Dialog.Close>
                      <button
                        type="button"
                        onClick={() => void saveNewAddress()}
                        className="rounded-full border border-brand-500 bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                      >
                        Save address
                      </button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </FormCard>
          )}

          <FormCard
            title="Anything else?"
            subtitle="Optional notes for the kitchen or delivery team"
          >
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Please call before arriving. Cake to be a surprise…"
              className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </FormCard>

          <FormCard
            title="Payment"
            subtitle="Pay on delivery for now. Online payment (UPI / cards) coming soon."
          >
            <div className="rounded-lg border border-cream-200 bg-cream-50 px-4 py-3 text-sm text-ink-700">
              <span className="font-medium">Cash on delivery / pickup</span>
              <p className="mt-0.5 text-xs text-ink-500">
                Pay the delivery partner or at the bakery when you receive the
                order.
              </p>
            </div>
          </FormCard>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-cream-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-display text-lg text-ink-900">
              Order summary
            </h2>

            {missingSchedule && (
              <div className="mb-4 rounded-lg border border-brand-500/30 bg-brand-100/40 px-3 py-2 text-xs text-brand-700">
                Some items don't have a delivery date. Go back to those product
                pages to pick one.
              </div>
            )}

            {hasExpired && (
              <div className="mb-4 rounded-lg border border-brand-500/40 bg-brand-100/60 px-3 py-2 text-xs text-brand-700">
                <p className="font-semibold">Delivery time is in the past</p>
                <p className="mt-0.5">
                  {expiredLines.length === lines.length
                    ? "Please pick a fresh date/slot on the product page."
                    : `${expiredLines.length} item(s) below need a fresh date/slot.`}
                </p>
              </div>
            )}

            <ul className="mb-4 space-y-3">
              {lines.map((l) => {
                const expired =
                  l.date && l.slotKey
                    ? isSlotInPast(l.date, l.slotKey, now)
                    : false;
                return (
                  <li key={l.id} className="flex items-start gap-3 text-sm">
                    {l.image ? (
                      <img
                        src={l.image}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded-md bg-cream-100" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-900">
                        {l.name}
                      </p>
                      <p className="truncate text-xs text-ink-500">
                        {[l.sizeLabel, l.flavourName]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="text-xs text-ink-500">Qty {l.qty}</p>
                      {l.date && (
                        <p
                          className={cn(
                            "mt-1 text-[11px] font-medium",
                            expired
                              ? "text-brand-700 line-through decoration-brand-500/50"
                              : "text-brand-700",
                          )}
                        >
                          {formatDate(l.date)}
                          {l.slotLabel && ` · ${l.slotLabel}`}
                          {expired && (
                            <>
                              {" "}
                              <span className="not-italic no-underline">
                                — expired,{" "}
                                <Link
                                  to={`/product/${l.slug}`}
                                  className="underline"
                                >
                                  update
                                </Link>
                              </span>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-ink-900">
                      ₹{(l.unitPrice * l.qty).toFixed(0)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <hr className="my-3 border-cream-200" />
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

            {submitError && (
              <p className="mt-3 rounded-md bg-brand-100/60 px-3 py-2 text-xs text-brand-700">
                {submitError}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!isValid || createOrder.isPending}
              className="mt-5 block w-full rounded-full bg-brand-500 py-3 text-center text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createOrder.isPending ? "Placing order…" : "Place order"}
            </button>
            <p className="mt-2 text-center text-[11px] text-ink-500">
              By placing this order you agree to our terms.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function FormCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-cream-200 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg text-ink-900">{title}</h2>
      {subtitle && (
        <p className="mb-4 mt-0.5 text-xs text-ink-500">{subtitle}</p>
      )}
      <div className={cn(!subtitle && "mt-3")}>{children}</div>
    </section>
  );
}

function ChoiceButton({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-lg border px-4 py-3 text-left transition",
        active
          ? "border-brand-500 bg-brand-100/60 text-brand-700"
          : "border-cream-200 bg-white text-ink-700 hover:border-brand-300",
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-ink-500">{subtitle}</span>
    </button>
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
  inputMode?: "numeric" | "tel" | "email";
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

function PincodeStatus({
  value,
  result,
  isChecking,
}: {
  value: string;
  result: PincodeCheckResult | null;
  isChecking: boolean;
}) {
  if (!PINCODE_RE.test(value)) return null;
  if (isChecking)
    return <span className="text-xs text-ink-500">Checking…</span>;
  if (!result) return null;
  if (!result.serviceable)
    return <span className="text-xs text-brand-700">Not serviceable</span>;
  const label = [result.city, result.area].filter(Boolean).join(" · ");
  return (
    <span className="text-xs text-emerald-700">
      {label} · ₹{result.deliveryFee} delivery
    </span>
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

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Returns true if the slot's end time on that date is in the past.
// Uses the local timezone since slot labels (9 AM – 12 PM etc.) are local.
function isSlotInPast(dateIso: string, slotKey: string, now: Date) {
  const slot = PRODUCT_COPY.timeSlots.find((s) => s.key === slotKey);
  if (!slot) return false;
  const [y, m, d] = dateIso.split("-").map(Number);
  if (!y || !m || !d) return false;
  const slotEnd = new Date(y, m - 1, d, slot.endHour, slot.endMinute, 0);
  return slotEnd.getTime() <= now.getTime();
}
