import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/cn";
import { PRODUCT_COPY } from "@/content/product";
import { ProductGallery } from "@/components/product/ProductGallery";
import { PincodeChecker } from "@/components/product/PincodeChecker";
import { SameDayDeliveryPicker } from "@/components/product/SameDayDeliveryPicker";
import type { PincodeCheckResult } from "@/hooks/usePincodeCheck";
import {
  useProduct,
  type ProductDetail,
  type ProductFlavour,
  type ProductSize,
} from "@/hooks/useProducts";
import { useMasterFlavours } from "@/hooks/useFlavours";
import { useCart } from "@/store/cart";

type Fulfillment = "delivery" | "pickup";

// 500g = "1 pound" = 1x basePrice; this is our pricing reference unit.
const BASE_PRICE_GRAMS = 500;

export function ProductPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError, error } = useProduct(slug);

  if (isLoading) return <PdpSkeleton />;
  if (isError || !product)
    return (
      <PdpError
        message={error instanceof Error ? error.message : "Product not found"}
      />
    );

  if (product.template === "PIZZA" || product.template === "OTHER") {
    return <ConfiguredPdp product={product} />;
  }
  return <PdpContent product={product} />;
}

function PdpContent({ product }: { product: ProductDetail }) {
  const navigate = useNavigate();
  const addLine = useCart((s) => s.addLine);
  const basePrice = Number(product.basePrice);
  const defaultSize: ProductSize | null =
    product.sellByPound && product.sizes.length > 0
      ? (product.sizes.find((s) => s.grams === BASE_PRICE_GRAMS) ??
        product.sizes[0])
      : null;

  // Attached flavours = fixed recipe (read-only). None attached = customer
  // picks from the master list, and the picked flavour's delta is applied.
  const hasSpecificFlavours = product.flavors.length > 0;
  const { data: masterFlavoursData = [] } = useMasterFlavours();
  const pickerFlavours: ProductFlavour[] = hasSpecificFlavours
    ? []
    : masterFlavoursData.map((f) => ({
        id: f.id,
        slug: f.slug,
        name: f.name,
        additionalAmount: f.additionalAmount,
        isEggless: f.isEggless,
        isSugarFree: f.isSugarFree,
        isHealthy: f.isHealthy,
      }));

  const [sizeId, setSizeId] = useState<string | null>(defaultSize?.id ?? null);
  // Free-form pound entry when the product opts in via `allowCustomSize`.
  // When set (>0), overrides the picked master size for pricing.
  const [customPounds, setCustomPounds] = useState<string>("");
  const [flavourId, setFlavourId] = useState<string | null>(null);
  useEffect(() => {
    if (!hasSpecificFlavours && !flavourId && pickerFlavours.length > 0) {
      setFlavourId(pickerFlavours[0].id);
    }
  }, [hasSpecificFlavours, flavourId, pickerFlavours]);

  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  const [pincodeResult, setPincodeResult] = useState<PincodeCheckResult | null>(
    null,
  );
  const [date, setDate] = useState("");
  const [slotKey, setSlotKey] = useState<string>(PRODUCT_COPY.timeSlots[0].key);
  const [slotLabel, setSlotLabel] = useState<string>(
    PRODUCT_COPY.timeSlots[0].label,
  );
  const [slotSurcharge, setSlotSurcharge] = useState<number>(
    PRODUCT_COPY.timeSlots[0].surcharge,
  );
  const [message, setMessage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [qty, setQty] = useState(1);

  const size = useMemo(
    () => product.sizes.find((s) => s.id === sizeId) ?? null,
    [product.sizes, sizeId],
  );
  const parsedCustomPounds = Number(customPounds);
  const customGrams =
    customPounds.trim() !== "" &&
    Number.isFinite(parsedCustomPounds) &&
    parsedCustomPounds > 0
      ? Math.round(parsedCustomPounds * BASE_PRICE_GRAMS)
      : null;
  const customOutOfRange =
    customGrams != null &&
    ((product.minGrams != null && customGrams < product.minGrams) ||
      (product.maxGrams != null && customGrams > product.maxGrams));

  const effectiveGrams =
    customGrams && !customOutOfRange ? customGrams : size ? size.grams : null;
  // Only picker selections drive the price delta — attached "fixed recipe"
  // flavours are considered priced-in.
  const pickedFlavour = useMemo(
    () => pickerFlavours.find((f) => f.id === flavourId) ?? null,
    [pickerFlavours, flavourId],
  );

  const flavourDelta = pickedFlavour
    ? Number(pickedFlavour.additionalAmount)
    : 0;
  const multiplier = effectiveGrams ? effectiveGrams / BASE_PRICE_GRAMS : 1;
  const unitPrice = (basePrice + flavourDelta) * multiplier + slotSurcharge;

  const deliveryFee =
    fulfillment === "delivery" && pincodeResult?.serviceable
      ? pincodeResult.deliveryFee
      : 0;
  const total = unitPrice * qty + deliveryFee;

  const canOrder =
    product.isAvailable &&
    !customOutOfRange &&
    (product.canBeDeliveredPanIndia ||
      fulfillment === "pickup" ||
      pincodeResult?.serviceable === true) &&
    (product.canBeDeliveredPanIndia || (date !== "" && slotKey !== ""));

  const handleAddToCart = () => {
    const chosenFlavour = pickedFlavour ?? product.flavors[0] ?? null;
    const effectiveSizeLabel =
      customGrams && !customOutOfRange
        ? `${(customGrams / BASE_PRICE_GRAMS).toFixed(2)} lb (custom)`
        : size?.label;
    const effectiveSizeGrams =
      customGrams && !customOutOfRange ? customGrams : size?.grams;

    addLine({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      categorySlug: product.category.slug,
      sizeGrams: effectiveSizeGrams,
      sizeLabel: effectiveSizeLabel,
      flavourId: chosenFlavour?.id,
      flavourName: chosenFlavour?.name,
      messageOnCake: message.trim() || undefined,
      instructions: instructions.trim() || undefined,
      fulfillment,
      date: product.canBeDeliveredPanIndia ? undefined : date,
      slotKey: product.canBeDeliveredPanIndia ? undefined : slotKey,
      slotLabel: product.canBeDeliveredPanIndia ? undefined : slotLabel,
      isPanIndia: product.canBeDeliveredPanIndia,
      unitPrice: unitPrice,
      qty,
    });
    navigate("/cart");
  };

  const anyPickerHasDelta = pickerFlavours.some(
    (f) => Number(f.additionalAmount) > 0,
  );
  const productIsEggless = product.isEggless;
  const galleryImages =
    product.images.length > 0
      ? product.images
      : [
          "data:image/svg+xml;utf8," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#f5ecd6"/><text x="300" y="310" font-family="Georgia" font-size="24" fill="#2c3540" text-anchor="middle">No image</text></svg>',
            ),
        ];

  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 pb-16">
      <nav className="mb-4 text-xs text-ink-500">
        <Link to="/" className="hover:text-brand-500">
          Home
        </Link>
        {product.category.parent && (
          <>
            <span className="mx-2">›</span>
            <Link
              to={`/category/${product.category.parent.slug}`}
              className="hover:text-brand-500"
            >
              {product.category.parent.name}
            </Link>
          </>
        )}
        <span className="mx-2">›</span>
        <Link
          to={`/category/${product.category.slug}`}
          className="hover:text-brand-500"
        >
          {product.category.name}
        </Link>
        <span className="mx-2">›</span>
        <span className="text-ink-700">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={galleryImages} alt={product.name} />

        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {product.supportsSameDayDelivery && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
                <svg
                  width={12}
                  height={12}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
                </svg>
                Same day delivery
              </span>
            )}
            {product.canBeDeliveredPanIndia && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                <svg
                  width={12}
                  height={12}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10 17h4V5H2v12h3" />
                  <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" />
                  <circle cx="7.5" cy="17.5" r="2.5" />
                  <circle cx="17.5" cy="17.5" r="2.5" />
                </svg>
                Ships Pan-India
              </span>
            )}
            {!product.isAvailable && (
              <span className="rounded-full bg-cream-200 px-3 py-1 text-xs font-medium text-ink-700">
                Sold out
              </span>
            )}
            {product.tags.map((t) => (
              <span
                key={t.id}
                className="rounded-full bg-cream-100 px-3 py-1 text-xs font-medium text-ink-700"
                style={
                  t.colorHex
                    ? { backgroundColor: `${t.colorHex}22`, color: t.colorHex }
                    : undefined
                }
              >
                {t.name}
              </span>
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <VegBadge isVeg={productIsEggless} />
              <h1 className="font-display text-3xl text-ink-900 md:text-4xl">
                {product.name}
              </h1>
            </div>
            {product.shortDescription && (
              <p className="text-sm text-ink-500">{product.shortDescription}</p>
            )}
          </div>

          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold text-ink-900">
                ₹{unitPrice.toFixed(0)}
              </span>
              {effectiveGrams && effectiveGrams !== BASE_PRICE_GRAMS && (
                <span className="text-xs text-ink-500">
                  base ₹{basePrice.toFixed(0)}
                  {flavourDelta > 0 && ` + ₹${flavourDelta.toFixed(0)}`} ×{" "}
                  {multiplier.toFixed(2)}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-500">
              {product.priceIsGstInclusive
                ? PRODUCT_COPY.labels.priceIncludesGst
                : "Exclusive of GST"}
            </p>
          </div>

          {product.sellByPound && product.sizes.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                {PRODUCT_COPY.labels.size}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => {
                  const mult = s.grams / BASE_PRICE_GRAMS;
                  const price = (basePrice + flavourDelta) * mult;
                  const active = s.id === sizeId && !customGrams;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSizeId(s.id);
                        setCustomPounds("");
                      }}
                      className={cn(
                        "min-w-[8rem] rounded-lg border px-3 py-2 text-left text-sm transition",
                        active
                          ? "border-brand-500 bg-brand-100 text-brand-700"
                          : "border-cream-200 bg-white text-ink-700 hover:border-brand-300",
                      )}
                    >
                      <span className="block font-medium">{s.label}</span>
                      {s.servesText && (
                        <span className="block text-xs text-ink-500">
                          {s.servesText}
                        </span>
                      )}
                      <span className="mt-1 block text-xs text-ink-700">
                        ₹{price.toFixed(0)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {product.allowCustomSize && (
                <div className="mt-3 rounded-lg border border-cream-200 bg-cream-50/40 p-3">
                  <label className="block text-xs font-medium text-ink-700">
                    Want more pounds?
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="number"
                      min={
                        product.minGrams
                          ? product.minGrams / BASE_PRICE_GRAMS
                          : 0.1
                      }
                      max={
                        product.maxGrams
                          ? product.maxGrams / BASE_PRICE_GRAMS
                          : undefined
                      }
                      step={0.1}
                      value={customPounds}
                      onChange={(e) => {
                        setCustomPounds(e.target.value);
                        if (e.target.value.trim() !== "") setSizeId(null);
                      }}
                      placeholder="e.g. 4"
                      className="w-24 rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                    <span className="text-sm text-ink-700">pounds</span>
                    {customGrams && !customOutOfRange && (
                      <span className="text-xs text-ink-500">
                        · {customGrams} g · ₹
                        {(
                          (basePrice + flavourDelta) *
                          (customGrams / BASE_PRICE_GRAMS)
                        ).toFixed(0)}
                      </span>
                    )}
                  </div>
                  {customOutOfRange && (
                    <p className="mt-1 text-xs text-brand-700">
                      Please pick between{" "}
                      {product.minGrams
                        ? (product.minGrams / BASE_PRICE_GRAMS).toFixed(1)
                        : "0.1"}{" "}
                      and{" "}
                      {product.maxGrams
                        ? (product.maxGrams / BASE_PRICE_GRAMS).toFixed(1)
                        : "any"}{" "}
                      pounds.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {hasSpecificFlavours ? (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
                {PRODUCT_COPY.labels.flavour}
              </label>
              <FlavourReadonlyList flavours={product.flavors} />
            </div>
          ) : pickerFlavours.length > 0 ? (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
                {PRODUCT_COPY.labels.flavour}
              </label>
              {pickerFlavours.length <= 8 && !anyPickerHasDelta ? (
                <div className="flex flex-wrap gap-2">
                  {pickerFlavours.map((f) => (
                    <FlavourChip
                      key={f.id}
                      flavour={f}
                      active={f.id === flavourId}
                      onClick={() => setFlavourId(f.id)}
                    />
                  ))}
                </div>
              ) : (
                <select
                  value={flavourId ?? ""}
                  onChange={(e) => setFlavourId(e.target.value)}
                  className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  {pickerFlavours.map((f) => {
                    const delta = Number(f.additionalAmount);
                    return (
                      <option key={f.id} value={f.id}>
                        {f.name}
                        {delta > 0 && ` (+₹${delta.toFixed(0)}/500g)`}
                        {f.isEggless && " · Eggless"}
                        {f.isSugarFree && " · Sugar-free"}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          ) : null}

          {product.supportsMessageOnCake && (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
                {PRODUCT_COPY.labels.messageOnCake}
              </label>
              <input
                type="text"
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value.slice(0, product.messageMaxLength))
                }
                maxLength={product.messageMaxLength}
                placeholder="e.g., Happy Birthday Aarav!"
                className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <p className="mt-1 text-xs text-ink-500">
                {PRODUCT_COPY.labels.messageHint(product.messageMaxLength)}
                {message && ` · ${message.length}/${product.messageMaxLength}`}
              </p>
            </div>
          )}

          <hr className="border-cream-200" />

          {!product.canBeDeliveredPanIndia && (
            <>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                  {PRODUCT_COPY.labels.deliveryOrPickup}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <FulfillmentButton
                    active={fulfillment === "delivery"}
                    onClick={() => setFulfillment("delivery")}
                    label={PRODUCT_COPY.labels.delivery}
                  />
                  <FulfillmentButton
                    active={fulfillment === "pickup"}
                    onClick={() => setFulfillment("pickup")}
                    label={PRODUCT_COPY.labels.pickup}
                  />
                </div>
              </div>

              {fulfillment === "delivery" && (
                <PincodeChecker onResult={setPincodeResult} />
              )}

              <SameDayDeliveryPicker
                supportsSameDayDelivery={product.supportsSameDayDelivery}
                leadTimeHours={product.leadTimeHours}
                fulfillment={fulfillment}
                pincodeResult={pincodeResult}
                value={{ date, slotKey, slotLabel, surcharge: slotSurcharge }}
                onChange={(v) => {
                  setDate(v.date);
                  setSlotKey(v.slotKey);
                  setSlotLabel(v.slotLabel);
                  setSlotSurcharge(v.surcharge);
                }}
              />
            </>
          )}

          {product.canBeDeliveredPanIndia && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Ships nationwide via courier. No delivery slot needed — just add
              to cart and check out.
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
              {PRODUCT_COPY.labels.specialInstructions}
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={PRODUCT_COPY.labels.specialInstructionsHint}
              className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="rounded-card border border-cream-200 bg-cream-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                {PRODUCT_COPY.labels.quantity}
              </span>
              <QtyControl value={qty} onChange={setQty} />
            </div>
            <div className="mb-3 flex items-center justify-between border-t border-cream-200 pt-3">
              <span className="text-sm text-ink-700">
                {PRODUCT_COPY.labels.total}
              </span>
              <span className="text-xl font-semibold text-ink-900">
                ₹{total.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canOrder}
              className="w-full rounded-full bg-brand-500 py-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {product.isAvailable ? PRODUCT_COPY.labels.addToCart : "Sold out"}
            </button>
            {product.isAvailable && !canOrder && (
              <p className="mt-2 text-center text-xs text-ink-500">
                {product.canBeDeliveredPanIndia
                  ? ""
                  : fulfillment === "delivery" && !pincodeResult?.serviceable
                    ? "Check delivery pincode to continue."
                    : "Pick a delivery date and slot to continue."}
              </p>
            )}
          </div>
        </div>
      </div>

      {product.description && (
        <section className="mt-14">
          <h2 className="mb-3 font-display text-2xl text-ink-900">
            About this bake
          </h2>
          <p className="max-w-3xl whitespace-pre-line leading-relaxed text-ink-700">
            {product.description}
          </p>
          {product.allergens.length > 0 && (
            <p className="mt-4 text-xs text-ink-500">
              <strong className="uppercase tracking-wide">Contains:</strong>{" "}
              {product.allergens.join(", ")}
            </p>
          )}
          {product.leadTimeHours > 0 && !product.canBeDeliveredPanIndia && (
            <p className="mt-2 text-xs text-ink-500">
              Lead time: {product.leadTimeHours} hour
              {product.leadTimeHours === 1 ? "" : "s"}
            </p>
          )}
        </section>
      )}
    </section>
  );
}

function FlavourChip({
  flavour,
  active,
  onClick,
}: {
  flavour: ProductFlavour;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition",
        active
          ? "border-brand-500 bg-brand-100 text-brand-700"
          : "border-cream-200 bg-white text-ink-700 hover:border-brand-300",
      )}
    >
      {flavour.name}
      {flavour.isEggless && (
        <span className="ml-1 text-xs text-green-700">· Eggless</span>
      )}
    </button>
  );
}

function FlavourReadonlyList({ flavours }: { flavours: ProductFlavour[] }) {
  const label =
    flavours.length === 1 ? "This cake is baked in" : "This cake features";
  return (
    <div className="rounded-lg border border-cream-200 bg-cream-50/50 px-3 py-2">
      <p className="mb-1 text-xs text-ink-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {flavours.map((f) => (
          <span
            key={f.id}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-sm font-medium text-ink-700 ring-1 ring-cream-200"
          >
            {f.name}
            {f.isEggless && (
              <span className="text-[10px] text-green-700">Eggless</span>
            )}
            {f.isSugarFree && (
              <span className="text-[10px] text-brand-700">Sugar-free</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function VegBadge({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center border-2",
        isVeg ? "border-green-600" : "border-red-600",
      )}
      title={isVeg ? "Vegetarian" : "Contains egg"}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          isVeg ? "bg-green-600" : "bg-red-600",
        )}
      />
    </span>
  );
}

function FulfillmentButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm font-medium transition",
        active
          ? "border-brand-500 bg-brand-100 text-brand-700"
          : "border-cream-200 bg-white text-ink-700 hover:border-brand-300",
      )}
    >
      {label}
    </button>
  );
}

function QtyControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-cream-200 bg-white">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="px-3 py-1 text-lg text-ink-700 hover:text-brand-500"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="w-8 text-center text-sm">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="px-3 py-1 text-lg text-ink-700 hover:text-brand-500"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

function PdpSkeleton() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 pb-16">
      <div className="mb-4 h-3 w-40 animate-pulse rounded bg-cream-100" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-card bg-cream-100" />
        <div className="space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded bg-cream-100" />
          <div className="h-4 w-full animate-pulse rounded bg-cream-100" />
          <div className="h-10 w-32 animate-pulse rounded bg-cream-100" />
          <div className="h-24 w-full animate-pulse rounded bg-cream-100" />
        </div>
      </div>
    </section>
  );
}

function PdpError({ message }: { message: string }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="mb-3 font-display text-3xl text-ink-900">
        Product not found
      </h1>
      <p className="mb-6 text-ink-500">{message}</p>
      <Link
        to="/"
        className="inline-flex items-center rounded-full bg-brand-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        Back to home
      </Link>
    </section>
  );
}

// -------- Configured PDP (Pizza / Other) --------

function ConfiguredPdp({ product }: { product: ProductDetail }) {
  const navigate = useNavigate();
  const addLine = useCart((s) => s.addLine);

  const sizeGroup = product.optionGroups.find((g) => g.key === "size");
  const crustGroup = product.optionGroups.find((g) => g.key === "crust");
  const toppings = product.toppings.filter((t) => t.kind === "TOPPING");
  const condiments = product.toppings.filter((t) => t.kind === "CONDIMENT");

  const defaultSize =
    sizeGroup?.options.find((o) => o.isDefault) ??
    sizeGroup?.options[0] ??
    null;
  const defaultCrust =
    crustGroup?.options.find((o) => o.isDefault) ??
    crustGroup?.options[0] ??
    null;

  const [sizeId, setSizeId] = useState<string | null>(defaultSize?.id ?? null);
  const [crustId, setCrustId] = useState<string | null>(
    defaultCrust?.id ?? null,
  );
  const [toppingIds, setToppingIds] = useState<Set<string>>(new Set());
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  const [pincodeResult, setPincodeResult] = useState<PincodeCheckResult | null>(
    null,
  );
  const [date, setDate] = useState("");
  const [slotKey, setSlotKey] = useState<string>(PRODUCT_COPY.timeSlots[0].key);
  const [slotLabel, setSlotLabel] = useState<string>(
    PRODUCT_COPY.timeSlots[0].label,
  );
  const [slotSurcharge, setSlotSurcharge] = useState<number>(
    PRODUCT_COPY.timeSlots[0].surcharge,
  );
  const [instructions, setInstructions] = useState("");
  const [qty, setQty] = useState(1);

  const pickedSize = useMemo(
    () => sizeGroup?.options.find((o) => o.id === sizeId) ?? null,
    [sizeGroup, sizeId],
  );
  const pickedCrust = useMemo(
    () => crustGroup?.options.find((o) => o.id === crustId) ?? null,
    [crustGroup, crustId],
  );
  const pickedToppings = product.toppings.filter((t) => toppingIds.has(t.id));

  const basePrice = Number(product.basePrice);
  const sizePrice = pickedSize ? Number(pickedSize.price) : basePrice;
  const crustDelta = pickedCrust ? Number(pickedCrust.price) : 0;
  const toppingsDelta = pickedToppings.reduce(
    (s, t) => s + Number(t.priceDelta),
    0,
  );
  const unitPrice = sizePrice + crustDelta + toppingsDelta + slotSurcharge;

  const deliveryFee =
    fulfillment === "delivery" && pincodeResult?.serviceable
      ? pincodeResult.deliveryFee
      : 0;
  const total = unitPrice * qty + deliveryFee;

  const canOrder =
    product.isAvailable &&
    (!sizeGroup || pickedSize != null) &&
    (product.canBeDeliveredPanIndia ||
      fulfillment === "pickup" ||
      pincodeResult?.serviceable === true) &&
    (product.canBeDeliveredPanIndia || (date !== "" && slotKey !== ""));

  const galleryImages =
    product.images.length > 0
      ? product.images
      : [
          "data:image/svg+xml;utf8," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#f5ecd6"/><text x="300" y="310" font-family="Georgia" font-size="24" fill="#2c3540" text-anchor="middle">No image</text></svg>',
            ),
        ];

  const toggleTopping = (id: string) => {
    const next = new Set(toppingIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setToppingIds(next);
  };

  // Compose a human-readable summary of pizza selections to store on the order.
  const composedInstructions = (): string | null => {
    const parts: string[] = [];
    if (pickedCrust) parts.push(`Crust: ${pickedCrust.label}`);
    if (pickedToppings.some((t) => t.kind === "TOPPING")) {
      parts.push(
        `Toppings: ${pickedToppings
          .filter((t) => t.kind === "TOPPING")
          .map((t) => t.name)
          .join(", ")}`,
      );
    }
    if (pickedToppings.some((t) => t.kind === "CONDIMENT")) {
      parts.push(
        `Condiments: ${pickedToppings
          .filter((t) => t.kind === "CONDIMENT")
          .map((t) => t.name)
          .join(", ")}`,
      );
    }
    const composed = parts.join(" · ");
    if (instructions.trim() && composed)
      return `${composed}\n${instructions.trim()}`;
    if (instructions.trim()) return instructions.trim();
    return composed || null;
  };

  const handleAddToCart = () => {
    addLine({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      categorySlug: product.category.slug,
      sizeGrams: pickedSize?.weightGrams ?? undefined,
      sizeLabel: pickedSize?.label,
      instructions: composedInstructions() ?? undefined,
      fulfillment,
      date: product.canBeDeliveredPanIndia ? undefined : date,
      slotKey: product.canBeDeliveredPanIndia ? undefined : slotKey,
      slotLabel: product.canBeDeliveredPanIndia ? undefined : slotLabel,
      isPanIndia: product.canBeDeliveredPanIndia,
      unitPrice,
      qty,
    });
    navigate("/cart");
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 pb-16">
      <nav className="mb-4 text-xs text-ink-500">
        <Link to="/" className="hover:text-brand-500">
          Home
        </Link>
        {product.category.parent && (
          <>
            <span className="mx-2">›</span>
            <Link
              to={`/category/${product.category.parent.slug}`}
              className="hover:text-brand-500"
            >
              {product.category.parent.name}
            </Link>
          </>
        )}
        <span className="mx-2">›</span>
        <Link
          to={`/category/${product.category.slug}`}
          className="hover:text-brand-500"
        >
          {product.category.name}
        </Link>
        <span className="mx-2">›</span>
        <span className="text-ink-700">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={galleryImages} alt={product.name} />

        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {product.supportsSameDayDelivery && (
              <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
                Same day delivery
              </span>
            )}
            {product.canBeDeliveredPanIndia && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                Ships Pan-India
              </span>
            )}
            {!product.isAvailable && (
              <span className="rounded-full bg-cream-200 px-3 py-1 text-xs font-medium text-ink-700">
                Sold out
              </span>
            )}
            {product.tags.map((t) => (
              <span
                key={t.id}
                className="rounded-full bg-cream-100 px-3 py-1 text-xs font-medium text-ink-700"
                style={
                  t.colorHex
                    ? { backgroundColor: `${t.colorHex}22`, color: t.colorHex }
                    : undefined
                }
              >
                {t.name}
              </span>
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <VegBadge isVeg={product.isEggless} />
              <h1 className="font-display text-3xl text-ink-900 md:text-4xl">
                {product.name}
              </h1>
            </div>
            {product.shortDescription && (
              <p className="text-sm text-ink-500">{product.shortDescription}</p>
            )}
          </div>

          <div>
            <span className="text-3xl font-semibold text-ink-900">
              ₹{unitPrice.toFixed(0)}
            </span>
            <p className="mt-1 text-xs text-ink-500">
              {product.priceIsGstInclusive
                ? PRODUCT_COPY.labels.priceIncludesGst
                : "Exclusive of GST"}
            </p>
          </div>

          {sizeGroup && sizeGroup.options.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                {sizeGroup.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {sizeGroup.options.map((o) => {
                  const active = o.id === sizeId;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSizeId(o.id)}
                      className={cn(
                        "min-w-[8rem] rounded-lg border px-3 py-2 text-left text-sm transition",
                        active
                          ? "border-brand-500 bg-brand-100 text-brand-700"
                          : "border-cream-200 bg-white text-ink-700 hover:border-brand-300",
                      )}
                    >
                      <span className="block font-medium">{o.label}</span>
                      <span className="mt-1 block text-xs text-ink-700">
                        ₹{Number(o.price).toFixed(0)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {crustGroup && crustGroup.options.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                {crustGroup.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {crustGroup.options.map((o) => {
                  const active = o.id === crustId;
                  const delta = Number(o.price);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setCrustId(o.id)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm transition",
                        active
                          ? "border-brand-500 bg-brand-100 text-brand-700"
                          : "border-cream-200 bg-white text-ink-700 hover:border-brand-300",
                      )}
                    >
                      <span className="block font-medium">{o.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-500">
                        {delta === 0 ? "no extra" : `+₹${delta.toFixed(0)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {toppings.length > 0 && (
            <ToppingsPicker
              label="Toppings"
              items={toppings}
              selected={toppingIds}
              onToggle={toggleTopping}
            />
          )}

          {condiments.length > 0 && (
            <ToppingsPicker
              label="Condiments / Extras"
              items={condiments}
              selected={toppingIds}
              onToggle={toggleTopping}
            />
          )}

          <hr className="border-cream-200" />

          {!product.canBeDeliveredPanIndia && (
            <>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                  {PRODUCT_COPY.labels.deliveryOrPickup}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <FulfillmentButton
                    active={fulfillment === "delivery"}
                    onClick={() => setFulfillment("delivery")}
                    label={PRODUCT_COPY.labels.delivery}
                  />
                  <FulfillmentButton
                    active={fulfillment === "pickup"}
                    onClick={() => setFulfillment("pickup")}
                    label={PRODUCT_COPY.labels.pickup}
                  />
                </div>
              </div>

              {fulfillment === "delivery" && (
                <PincodeChecker onResult={setPincodeResult} />
              )}

              <SameDayDeliveryPicker
                supportsSameDayDelivery={product.supportsSameDayDelivery}
                leadTimeHours={product.leadTimeHours}
                fulfillment={fulfillment}
                pincodeResult={pincodeResult}
                value={{ date, slotKey, slotLabel, surcharge: slotSurcharge }}
                onChange={(v) => {
                  setDate(v.date);
                  setSlotKey(v.slotKey);
                  setSlotLabel(v.slotLabel);
                  setSlotSurcharge(v.surcharge);
                }}
              />
            </>
          )}

          {product.canBeDeliveredPanIndia && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Ships nationwide via courier. No delivery slot needed — just add
              to cart and check out.
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
              {PRODUCT_COPY.labels.specialInstructions}
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={PRODUCT_COPY.labels.specialInstructionsHint}
              className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="rounded-card border border-cream-200 bg-cream-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                {PRODUCT_COPY.labels.quantity}
              </span>
              <QtyControl value={qty} onChange={setQty} />
            </div>
            <div className="mb-3 flex items-center justify-between border-t border-cream-200 pt-3">
              <span className="text-sm text-ink-700">
                {PRODUCT_COPY.labels.total}
              </span>
              <span className="text-xl font-semibold text-ink-900">
                ₹{total.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canOrder}
              className="w-full rounded-full bg-brand-500 py-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {product.isAvailable ? PRODUCT_COPY.labels.addToCart : "Sold out"}
            </button>
            {product.isAvailable && !canOrder && (
              <p className="mt-2 text-center text-xs text-ink-500">
                {sizeGroup && !pickedSize
                  ? "Pick a size to continue."
                  : product.canBeDeliveredPanIndia
                    ? ""
                    : fulfillment === "delivery" && !pincodeResult?.serviceable
                      ? "Check delivery pincode to continue."
                      : "Pick a delivery date and slot to continue."}
              </p>
            )}
          </div>
        </div>
      </div>

      {product.description && (
        <section className="mt-14">
          <h2 className="mb-3 font-display text-2xl text-ink-900">
            About this dish
          </h2>
          <p className="max-w-3xl whitespace-pre-line leading-relaxed text-ink-700">
            {product.description}
          </p>
          {product.allergens.length > 0 && (
            <p className="mt-4 text-xs text-ink-500">
              <strong className="uppercase tracking-wide">Contains:</strong>{" "}
              {product.allergens.join(", ")}
            </p>
          )}
          {product.leadTimeHours > 0 && (
            <p className="mt-2 text-xs text-ink-500">
              Lead time: {product.leadTimeHours} hour
              {product.leadTimeHours === 1 ? "" : "s"}
            </p>
          )}
        </section>
      )}
    </section>
  );
}

function ToppingsPicker({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: ProductDetail["toppings"];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((t) => {
          const on = selected.has(t.id);
          const delta = Number(t.priceDelta);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onToggle(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                on
                  ? "border-brand-500 bg-brand-100 text-brand-700"
                  : "border-cream-200 bg-white text-ink-700 hover:border-brand-300",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  t.isVeg ? "bg-emerald-500" : "bg-red-500",
                )}
              />
              {t.name}
              {delta > 0 && (
                <span className="text-ink-500">+₹{delta.toFixed(0)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
