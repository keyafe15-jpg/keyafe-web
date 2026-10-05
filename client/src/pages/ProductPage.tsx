import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { flavourColour } from "@/lib/flavourColour";
import { PRODUCT_COPY } from "@/content/product";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductReviews } from "@/components/product/ProductReviews";
import { PincodeChecker } from "@/components/product/PincodeChecker";
import { SameDayDeliveryPicker } from "@/components/product/SameDayDeliveryPicker";
import { SegmentedChoice } from "@/components/product/SegmentedChoice";
import { ProductTagBadge } from "@/components/product/ProductTagBadge";
import { Price, applyFactor } from "@keyafe/shared";
import type { PincodeCheckResult } from "@/hooks/usePincodeCheck";
import {
  useProduct,
  type ProductDetail,
  type ProductFlavour,
  type ProductSize,
  type ProductAddon,
} from "@/hooks/useProducts";
import { useMasterFlavours } from "@/hooks/useFlavours";
import { useCart } from "@/store/cart";
import { trackAddToCart, trackViewItem } from "@/lib/analytics";
import {
  CAKE_BASE_GRAMS,
  cakeVolumeDiscount,
  computeCakeUnitPrice,
  gramsToPounds,
} from "@/lib/cakePrice";

type Fulfillment = "delivery" | "pickup";

export function ProductPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError, error } = useProduct(slug);

  useEffect(() => {
    if (product) trackViewItem(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  if (isLoading) return <PdpSkeleton />;
  if (isError || !product)
    return <PdpError message={error instanceof Error ? error.message : "Product not found"} />;

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
      ? (product.sizes.find((s) => s.grams === CAKE_BASE_GRAMS) ?? product.sizes[0])
      : null;

  // Attached flavours are priced into the cake: one is a fixed recipe, several
  // are the customer's choices at no extra cost. None attached = customer picks
  // from the master list, and the picked flavour's delta is applied.
  const hasSpecificFlavours = product.flavors.length > 0;
  const fixedFlavour = product.flavors.length === 1;
  const { data: masterFlavoursData } = useMasterFlavours();
  const pickerFlavours = useMemo<ProductFlavour[]>(() => {
    if (hasSpecificFlavours) return fixedFlavour ? [] : orderByGroup(product.flavors);
    const master = (masterFlavoursData ?? []).map((f) => ({
      id: f.id,
      slug: f.slug,
      name: f.name,
      group: f.group,
      groupOrder: f.groupOrder,
      additionalAmount: f.additionalAmount,
      isEggless: f.isEggless,
      isSugarFree: f.isSugarFree,
      isHealthy: f.isHealthy,
    }));
    return orderByGroup(master);
  }, [hasSpecificFlavours, fixedFlavour, product.flavors, masterFlavoursData]);

  const [sizeId, setSizeId] = useState<string | null>(defaultSize?.id ?? null);
  // Free-form pound entry when the product opts in via `allowCustomSize`.
  // When set (>0), overrides the picked master size for pricing.
  const [customPounds, setCustomPounds] = useState<string>("");
  const [flavourId, setFlavourId] = useState<string | null>(null);
  useEffect(() => {
    if (!flavourId && pickerFlavours.length > 0) {
      setFlavourId(pickerFlavours[0].id);
    }
  }, [flavourId, pickerFlavours]);

  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  const [pincodeResult, setPincodeResult] = useState<PincodeCheckResult | null>(null);
  const [date, setDate] = useState("");
  const [slotKey, setSlotKey] = useState<string>(PRODUCT_COPY.timeSlots[0].key);
  const [slotLabel, setSlotLabel] = useState<string>(PRODUCT_COPY.timeSlots[0].label);
  const [slotSurcharge, setSlotSurcharge] = useState<number>(PRODUCT_COPY.timeSlots[0].surcharge);
  const [message, setMessage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [qty, setQty] = useState(1);
  const [addonIds, setAddonIds] = useState<Set<string>>(new Set());
  const addons = product.addons ?? [];
  const pickedAddons = addons.filter((a) => addonIds.has(a.id));
  const addonsDelta = pickedAddons.reduce((s, a) => s + Number(a.priceDelta), 0);

  const size = useMemo(
    () => product.sizes.find((s) => s.id === sizeId) ?? null,
    [product.sizes, sizeId],
  );
  const parsedCustomPounds = Number(customPounds);
  const customGrams =
    customPounds.trim() !== "" && Number.isFinite(parsedCustomPounds) && parsedCustomPounds > 0
      ? Math.round(parsedCustomPounds * CAKE_BASE_GRAMS)
      : null;
  const customOutOfRange =
    customGrams != null &&
    ((product.minGrams != null && customGrams < product.minGrams) ||
      (product.maxGrams != null && customGrams > product.maxGrams));

  const effectiveGrams = customGrams && !customOutOfRange ? customGrams : size ? size.grams : null;
  // Only master-list picks drive the price delta — attached flavours are priced-in.
  const pickedFlavour = useMemo(
    () => pickerFlavours.find((f) => f.id === flavourId) ?? null,
    [pickerFlavours, flavourId],
  );

  const flavourDelta =
    pickedFlavour && !hasSpecificFlavours ? Number(pickedFlavour.additionalAmount) : 0;
  const factor = product.priceFactor;
  const cakePrice = effectiveGrams
    ? computeCakeUnitPrice(basePrice, effectiveGrams, flavourDelta)
    : basePrice + flavourDelta;
  const volumeOff = effectiveGrams ? cakeVolumeDiscount(effectiveGrams) : 0;
  const extras = addonsDelta + slotSurcharge;
  const unitPrice = applyFactor(cakePrice, factor) + extras;
  const originalUnitPrice = factor ? cakePrice + extras : null;

  const deliveryFee =
    fulfillment === "delivery" && pincodeResult?.serviceable ? pincodeResult.deliveryFee : 0;
  const total = unitPrice * qty + deliveryFee;
  const originalTotal = originalUnitPrice != null ? originalUnitPrice * qty + deliveryFee : null;
  const customPrice =
    customGrams && !customOutOfRange
      ? computeCakeUnitPrice(basePrice, customGrams, flavourDelta)
      : null;

  const canOrder =
    product.isAvailable &&
    !customOutOfRange &&
    (product.canBeDeliveredPanIndia || fulfillment === "pickup" || fulfillment === "delivery") &&
    (product.canBeDeliveredPanIndia || (date !== "" && slotKey !== ""));

  const handleAddToCart = () => {
    const chosenFlavour = pickedFlavour ?? product.flavors[0] ?? null;
    const effectiveSizeLabel =
      customGrams && !customOutOfRange
        ? `${(customGrams / CAKE_BASE_GRAMS).toFixed(2)} lb (custom)`
        : size?.label;
    const effectiveSizeGrams = customGrams && !customOutOfRange ? customGrams : size?.grams;
    const addonNotes = composeAddonNotes(pickedAddons);
    const extraNotes = instructions.trim();
    const composed =
      addonNotes && extraNotes
        ? `${addonNotes}\n${extraNotes}`
        : addonNotes || extraNotes || undefined;

    const line = {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      categorySlug: product.categories[0]?.slug ?? "",
      sizeGrams: effectiveSizeGrams,
      sizeLabel: effectiveSizeLabel,
      flavourId: chosenFlavour?.id,
      flavourName: chosenFlavour?.name,
      messageOnCake: message.trim() || undefined,
      instructions: composed,
      fulfillment,
      date: product.canBeDeliveredPanIndia ? undefined : date,
      slotKey: product.canBeDeliveredPanIndia ? undefined : slotKey,
      slotLabel: product.canBeDeliveredPanIndia ? undefined : slotLabel,
      isPanIndia: product.canBeDeliveredPanIndia,
      unitPrice,
      originalUnitPrice: originalUnitPrice ?? undefined,
      gstRate: Number(product.gstRate),
      priceIsGstInclusive: product.priceIsGstInclusive,
      qty,
    };
    addLine(line);
    trackAddToCart(line);
    navigate("/cart");
  };

  const anyPickerHasDelta =
    !hasSpecificFlavours && pickerFlavours.some((f) => Number(f.additionalAmount) > 0);
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
        {product.categories.map((c, i) => (
          <span key={c.id}>
            {i === 0 ? <span className="mx-2">›</span> : <span className="mx-1">·</span>}
            <Link to={`/category/${c.slug}`} className="hover:text-brand-500">
              {c.name}
            </Link>
          </span>
        ))}
        <span className="mx-2">›</span>
        <span className="text-ink-700">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        <div className="lg:sticky lg:top-24">
          <ProductGallery images={galleryImages} alt={product.name} />
        </div>

        <div className="min-w-0 space-y-6">
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
            {product.isHealthyTreat && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
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
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96c1.4-.98 2.3-.19 2.05 1.28C20.28 12 16 22 11 22" />
                  <path d="M2 21c0-3 1.85-5.36 5.08-6" />
                </svg>
                Healthy treat
              </span>
            )}
            {!product.isAvailable && (
              <span className="rounded-full bg-cream-200 px-3 py-1 text-xs font-medium text-ink-700">
                Out of stock
              </span>
            )}
            {product.tags.map((t) => (
              <ProductTagBadge key={t.id} tag={t} size="md" />
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <VegBadge isVeg={productIsEggless} />
              <h1 className="font-display text-3xl text-ink-900 md:text-4xl">{product.name}</h1>
            </div>
            {product.shortDescription && (
              <p className="text-sm text-ink-500">{product.shortDescription}</p>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Price
                amount={unitPrice}
                original={originalUnitPrice}
                showBadge
                className="text-3xl text-ink-900"
              />
              {!factor && effectiveGrams && effectiveGrams !== CAKE_BASE_GRAMS && (
                <span className="text-xs text-ink-500">
                  base ₹{basePrice.toFixed(0)}
                  {flavourDelta > 0 && ` + ₹${flavourDelta.toFixed(0)}`} ×{" "}
                  {gramsToPounds(effectiveGrams).toFixed(2)}
                  {volumeOff > 0 && ` − ₹${volumeOff.toFixed(0)}`}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-500">
              {product.priceIsGstInclusive
                ? PRODUCT_COPY.labels.priceIncludesGst
                : `+ ${Number(product.gstRate)}% GST added at checkout`}
            </p>
          </div>

          {product.sellByPound && product.sizes.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-ink-500 uppercase">
                {PRODUCT_COPY.labels.size}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => {
                  const price = computeCakeUnitPrice(basePrice, s.grams, flavourDelta);
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
                        <span className="block text-xs text-ink-500">{s.servesText}</span>
                      )}
                      <span className="mt-1 block text-xs text-ink-700">
                        <Price amount={applyFactor(price, factor)} original={price} />
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
                      min={product.minGrams ? product.minGrams / CAKE_BASE_GRAMS : 0.1}
                      max={product.maxGrams ? product.maxGrams / CAKE_BASE_GRAMS : undefined}
                      step={0.1}
                      value={customPounds}
                      onChange={(e) => {
                        setCustomPounds(e.target.value);
                        if (e.target.value.trim() !== "") setSizeId(null);
                      }}
                      placeholder="e.g. 4"
                      className="w-24 rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                    />
                    <span className="text-sm text-ink-700">pounds</span>
                    {customGrams && customPrice != null && (
                      <span className="text-xs text-ink-500">
                        · {customGrams} g ·{" "}
                        <Price amount={applyFactor(customPrice, factor)} original={customPrice} />
                      </span>
                    )}
                  </div>
                  {customOutOfRange && (
                    <p className="mt-1 text-xs text-brand-700">
                      Please pick between{" "}
                      {product.minGrams ? (product.minGrams / CAKE_BASE_GRAMS).toFixed(1) : "0.1"}{" "}
                      and{" "}
                      {product.maxGrams ? (product.maxGrams / CAKE_BASE_GRAMS).toFixed(1) : "any"}{" "}
                      pounds.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {fixedFlavour ? (
            <div>
              <label className="mb-1 block text-xs font-medium tracking-wide text-ink-500 uppercase">
                {PRODUCT_COPY.labels.flavour}
              </label>
              <FlavourReadonlyList flavours={product.flavors} />
            </div>
          ) : pickerFlavours.length > 0 ? (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="shrink-0 text-xs font-medium tracking-wide text-ink-500 uppercase">
                  {PRODUCT_COPY.labels.chooseFlavour}
                </p>
                {pickedFlavour && (
                  <p
                    aria-live="polite"
                    className="inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-500"
                  >
                    <span className="hidden shrink-0 sm:inline">
                      {PRODUCT_COPY.labels.yourFlavour}:
                    </span>
                    <FlavourDot name={pickedFlavour.name} />
                    <span className="truncate font-semibold text-brand-700">
                      {pickedFlavour.name}
                    </span>
                  </p>
                )}
              </div>
              <p className="mt-0.5 mb-2 text-xs text-ink-500">
                {PRODUCT_COPY.labels.flavourHint(anyPickerHasDelta)}
              </p>
              <FlavourPicker
                flavours={pickerFlavours}
                value={flavourId}
                onChange={setFlavourId}
                deltaFor={(f) =>
                  anyPickerHasDelta ? applyFactor(Number(f.additionalAmount), factor) : 0
                }
                perPound={effectiveGrams != null}
              />
            </div>
          ) : null}

          {product.supportsMessageOnCake && (
            <div>
              <label className="mb-1 block text-xs font-medium tracking-wide text-ink-500 uppercase">
                {PRODUCT_COPY.labels.messageOnCake}
              </label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, product.messageMaxLength))}
                maxLength={product.messageMaxLength}
                placeholder="e.g., Happy Birthday Aarav!"
                className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
              />
              <p className="mt-1 text-xs text-ink-500">
                {PRODUCT_COPY.labels.messageHint(product.messageMaxLength)}
                {message && ` · ${message.length}/${product.messageMaxLength}`}
              </p>
            </div>
          )}

          {addons.length > 0 && (
            <AddonsPicker
              addons={addons}
              selected={addonIds}
              onToggle={(id) => {
                const next = new Set(addonIds);
                next.has(id) ? next.delete(id) : next.add(id);
                setAddonIds(next);
              }}
            />
          )}

          <hr className="border-cream-200" />

          {!product.canBeDeliveredPanIndia && (
            <div className="space-y-3">
              <SegmentedChoice
                ariaLabel={PRODUCT_COPY.labels.deliveryOrPickup}
                value={fulfillment}
                onChange={setFulfillment}
                options={[
                  { value: "delivery", label: PRODUCT_COPY.labels.delivery },
                  { value: "pickup", label: PRODUCT_COPY.labels.pickup },
                ]}
              />

              {fulfillment === "delivery" && <PincodeChecker onResult={setPincodeResult} />}

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
            </div>
          )}

          {product.canBeDeliveredPanIndia && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Ships nationwide via courier. No delivery slot needed — just add to cart and check
              out.
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium tracking-wide text-ink-500 uppercase">
              {PRODUCT_COPY.labels.specialInstructions}
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={PRODUCT_COPY.labels.specialInstructionsHint}
              className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </div>

          <div className="rounded-card border border-cream-200 bg-cream-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                {PRODUCT_COPY.labels.quantity}
              </span>
              <QtyControl value={qty} onChange={setQty} />
            </div>
            <div className="mb-3 flex items-center justify-between border-t border-cream-200 pt-3">
              <span className="text-sm text-ink-700">{PRODUCT_COPY.labels.total}</span>
              <Price amount={total} original={originalTotal} className="text-xl text-ink-900" />
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canOrder}
              className="w-full rounded-full bg-brand-500 py-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {product.isAvailable ? PRODUCT_COPY.labels.addToCart : "Out of stock"}
            </button>
            {product.isAvailable && !canOrder && (
              <p className="mt-2 text-center text-xs text-ink-500">
                {product.canBeDeliveredPanIndia ? "" : "Pick a delivery date and slot to continue."}
              </p>
            )}
          </div>
        </div>
      </div>

      {product.description && (
        <section className="mt-14">
          <h2 className="mb-3 font-display text-2xl text-ink-900">About this bake</h2>
          <p className="max-w-3xl leading-relaxed whitespace-pre-line text-ink-700">
            {product.description}
          </p>
          {product.allergens.length > 0 && (
            <p className="mt-4 text-xs text-ink-500">
              <strong className="tracking-wide uppercase">Contains:</strong>{" "}
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

      <ProductReviews slug={product.slug} />
    </section>
  );
}

/** Ungrouped lists this short just wrap; anything longer swipes. */
const FLAVOURS_WRAP_MAX = 8;
/** Swipe rows split into evenly filled lines of at most this many chips, scrolling together. */
const FLAVOURS_PER_LINE_MAX = 8;

interface FlavourSection {
  title: string | null;
  flavours: ProductFlavour[];
}

/** Sections in admin group order (flavour order kept inside each); ungrouped flavours go last. */
function groupFlavours(flavours: ProductFlavour[]): FlavourSection[] {
  const byGroup = new Map<string, { order: number; flavours: ProductFlavour[] }>();
  const ungrouped: ProductFlavour[] = [];
  for (const f of flavours) {
    const group = f.group?.trim();
    if (!group) {
      ungrouped.push(f);
      continue;
    }
    const entry = byGroup.get(group);
    if (entry) entry.flavours.push(f);
    else byGroup.set(group, { order: f.groupOrder ?? Number.MAX_SAFE_INTEGER, flavours: [f] });
  }
  const sections: FlavourSection[] = [...byGroup]
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([title, entry]) => ({ title, flavours: entry.flavours }));
  if (sections.length === 0) return [{ title: null, flavours: ungrouped }];
  if (ungrouped.length > 0) {
    sections.push({ title: PRODUCT_COPY.labels.moreFlavoursGroup, flavours: ungrouped });
  }
  return sections;
}

/** Display order, so the default pick is the first chip the customer sees. */
function orderByGroup(flavours: ProductFlavour[]): ProductFlavour[] {
  return groupFlavours(flavours).flatMap((s) => s.flavours);
}

/** One swipeable row per flavour group; short ungrouped lists simply wrap. */
function FlavourPicker({
  flavours,
  value,
  onChange,
  deltaFor,
  perPound,
}: {
  flavours: ProductFlavour[];
  value: string | null;
  onChange: (id: string) => void;
  deltaFor: (flavour: ProductFlavour) => number;
  perPound: boolean;
}) {
  const sections = useMemo(() => groupFlavours(flavours), [flavours]);

  const chip = (f: ProductFlavour) => (
    <FlavourChip
      key={f.id}
      flavour={f}
      active={f.id === value}
      delta={deltaFor(f)}
      perPound={perPound}
      onClick={() => onChange(f.id)}
    />
  );

  if (sections.length === 1 && sections[0].flavours.length <= FLAVOURS_WRAP_MAX) {
    return <div className="flex flex-wrap gap-2">{sections[0].flavours.map(chip)}</div>;
  }

  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <FlavourRow
          key={s.title ?? ""}
          title={s.title ?? PRODUCT_COPY.labels.allFlavours}
          flavours={s.flavours}
          chip={chip}
        />
      ))}
    </div>
  );
}

const EDGE_FADE: Record<string, string | undefined> = {
  none: undefined,
  end: "linear-gradient(to right, #000 calc(100% - 40px), transparent)",
  start: "linear-gradient(to right, transparent, #000 28px)",
  both: "linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 40px), transparent)",
};

const SWIPE_PEEK_KEY = "keyafe-flavour-swipe-peek";

/** True for the first caller per browser session, so only one row ever peeks. */
function claimSwipePeek() {
  try {
    if (sessionStorage.getItem(SWIPE_PEEK_KEY)) return false;
    sessionStorage.setItem(SWIPE_PEEK_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** Horizontally swipeable chips; edges fade while there is more to scroll. */
function FlavourRow({
  title,
  flavours,
  chip,
}: {
  title: string;
  flavours: ProductFlavour[];
  chip: (f: ProductFlavour) => ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const lineCount = Math.ceil(flavours.length / FLAVOURS_PER_LINE_MAX);
  const lines = Array.from({ length: lineCount }, (_, i) =>
    flavours.slice(
      Math.ceil((i * flavours.length) / lineCount),
      Math.ceil(((i + 1) * flavours.length) / lineCount),
    ),
  );

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () =>
      setEdges({
        start: el.scrollLeft > 4,
        end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [flavours]);

  // Bring a pre-picked chip into view by scrolling the track only, so the page never jumps.
  useEffect(() => {
    const el = trackRef.current;
    const picked = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el || !picked) return;
    const left = picked.offsetLeft;
    const right = left + picked.offsetWidth;
    if (left < el.scrollLeft || right > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = left - (el.clientWidth - picked.offsetWidth) / 2;
    }
  }, []);

  const [peeking, setPeeking] = useState(false);
  useEffect(() => {
    const el = trackRef.current;
    const touchWithMotion = window.matchMedia(
      "(hover: none) and (prefers-reduced-motion: no-preference)",
    ).matches;
    if (!el || !touchWithMotion) return;
    let dwell: number | undefined;
    // Only peek once the row has settled well inside the screen, not while it is
    // flashing past the bottom edge during load or a fast scroll.
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(dwell);
        if (!entry.isIntersecting) return;
        dwell = window.setTimeout(() => {
          if (el.scrollLeft > 4 || el.scrollWidth <= el.clientWidth + 4) return;
          observer.disconnect();
          if (claimSwipePeek()) setPeeking(true);
        }, 500);
      },
      { threshold: 1, rootMargin: "0px 0px -25% 0px" },
    );
    observer.observe(el);
    return () => {
      window.clearTimeout(dwell);
      observer.disconnect();
    };
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    el?.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };
  const fade =
    EDGE_FADE[
      edges.start && edges.end ? "both" : edges.end ? "end" : edges.start ? "start" : "none"
    ];

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
          {title}
          <span className="font-normal text-ink-500/70"> · {flavours.length}</span>
        </p>
        {edges.end && !edges.start && (
          <span
            aria-hidden
            className="flex items-center gap-0.5 text-[11px] font-medium text-brand-700 sm:hidden"
          >
            {PRODUCT_COPY.labels.swipeHint}
            <ChevronsRight className="swipe-hint-arrow h-3.5 w-3.5" />
          </span>
        )}
        {(edges.start || edges.end) && (
          <div className="hidden items-center gap-1 sm:flex">
            <RowArrow dir={-1} disabled={!edges.start} title={title} onClick={() => scrollBy(-1)} />
            <RowArrow dir={1} disabled={!edges.end} title={title} onClick={() => scrollBy(1)} />
          </div>
        )}
      </div>
      <div
        ref={trackRef}
        role="group"
        aria-label={title}
        style={{ maskImage: fade, WebkitMaskImage: fade }}
        className="relative -mx-4 snap-x snap-proximity scroll-px-4 [scrollbar-width:none] overflow-x-auto px-4 py-0.5 [-ms-overflow-style:none] sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        <div
          className={cn("flex w-max flex-col gap-2", peeking && "swipe-peek")}
          onAnimationEnd={() => setPeeking(false)}
        >
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              {line.map(chip)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RowArrow({
  dir,
  disabled,
  title,
  onClick,
}: {
  dir: 1 | -1;
  disabled: boolean;
  title: string;
  onClick: () => void;
}) {
  const Icon = dir === 1 ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${dir === 1 ? "More" : "Previous"} ${title} flavours`}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-cream-200 bg-white text-ink-700 transition hover:border-ink-500/40 disabled:opacity-35"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function FlavourDot({ name, ringed = false }: { name: string; ringed?: boolean }) {
  const colour = flavourColour(name);
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{
        backgroundColor: colour.fill,
        boxShadow: ringed
          ? "0 0 0 1.5px #fff"
          : colour.outlined
            ? "inset 0 0 0 1px rgba(44, 53, 64, 0.22)"
            : undefined,
      }}
    />
  );
}

function FlavourChip({
  flavour,
  active,
  delta,
  perPound,
  onClick,
}: {
  flavour: ProductFlavour;
  active: boolean;
  delta: number;
  perPound: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition",
        active
          ? "border-brand-500 bg-brand-500 font-medium text-white shadow-sm"
          : "border-cream-200 bg-white text-ink-700 hover:border-ink-500/40 hover:bg-cream-50",
      )}
    >
      {active && <Check className="-mr-0.5 -ml-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={3} />}
      <FlavourDot name={flavour.name} ringed={active} />
      {flavour.name}
      {delta > 0 && (
        <span className={cn("text-xs", active ? "text-white/85" : "text-ink-500")}>
          +₹{delta.toFixed(0)}
          {perPound ? "/lb" : ""}
        </span>
      )}
      {flavour.isEggless && !/eggless/i.test(flavour.name) && (
        <span className={cn("text-xs", active ? "text-white/85" : "text-green-700")}>
          · Eggless
        </span>
      )}
      {flavour.isSugarFree && !/sugar[\s-]?free/i.test(flavour.name) && (
        <span className={cn("text-xs", active ? "text-white/85" : "text-brand-700")}>
          · Sugar-free
        </span>
      )}
    </button>
  );
}

function FlavourReadonlyList({ flavours }: { flavours: ProductFlavour[] }) {
  const label = flavours.length === 1 ? "This cake is baked in" : "This cake features";
  return (
    <div className="rounded-lg border border-cream-200 bg-cream-50/50 px-3 py-2">
      <p className="mb-1 text-xs text-ink-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {flavours.map((f) => (
          <span
            key={f.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-sm font-medium text-ink-700 ring-1 ring-cream-200"
          >
            <FlavourDot name={f.name} />
            {f.name}
            {f.isEggless && <span className="text-[10px] text-green-700">Eggless</span>}
            {f.isSugarFree && <span className="text-[10px] text-brand-700">Sugar-free</span>}
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
      <span className={cn("h-2 w-2 rounded-full", isVeg ? "bg-green-600" : "bg-red-600")} />
    </span>
  );
}

function QtyControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
      <div className="grid items-start gap-8 lg:grid-cols-2">
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
      <h1 className="mb-3 font-display text-3xl text-ink-900">Product not found</h1>
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

  const defaultSize = sizeGroup?.options.find((o) => o.isDefault) ?? sizeGroup?.options[0] ?? null;
  const defaultCrust =
    crustGroup?.options.find((o) => o.isDefault) ?? crustGroup?.options[0] ?? null;

  const [sizeId, setSizeId] = useState<string | null>(defaultSize?.id ?? null);
  const [crustId, setCrustId] = useState<string | null>(defaultCrust?.id ?? null);
  const [toppingIds, setToppingIds] = useState<Set<string>>(new Set());
  const [addonIds, setAddonIds] = useState<Set<string>>(new Set());
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  const [pincodeResult, setPincodeResult] = useState<PincodeCheckResult | null>(null);
  const [date, setDate] = useState("");
  const [slotKey, setSlotKey] = useState<string>(PRODUCT_COPY.timeSlots[0].key);
  const [slotLabel, setSlotLabel] = useState<string>(PRODUCT_COPY.timeSlots[0].label);
  const [slotSurcharge, setSlotSurcharge] = useState<number>(PRODUCT_COPY.timeSlots[0].surcharge);
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
  const addons = product.addons ?? [];
  const pickedAddons = addons.filter((a) => addonIds.has(a.id));

  const basePrice = Number(product.basePrice);
  const sizePrice = pickedSize ? Number(pickedSize.price) : basePrice;
  const crustDelta = pickedCrust ? Number(pickedCrust.price) : 0;
  const toppingsDelta = pickedToppings.reduce((s, t) => s + Number(t.priceDelta), 0);
  const addonsDelta = pickedAddons.reduce((s, a) => s + Number(a.priceDelta), 0);
  const factor = product.priceFactor;
  const extras = toppingsDelta + addonsDelta + slotSurcharge;
  // Size and crust are discounted separately so the total matches the chips.
  const unitPrice = applyFactor(sizePrice, factor) + applyFactor(crustDelta, factor) + extras;
  const originalUnitPrice = factor ? sizePrice + crustDelta + extras : null;

  const deliveryFee =
    fulfillment === "delivery" && pincodeResult?.serviceable ? pincodeResult.deliveryFee : 0;
  const total = unitPrice * qty + deliveryFee;
  const originalTotal = originalUnitPrice != null ? originalUnitPrice * qty + deliveryFee : null;

  const canOrder =
    product.isAvailable &&
    (!sizeGroup || pickedSize != null) &&
    (product.canBeDeliveredPanIndia || fulfillment === "pickup" || fulfillment === "delivery") &&
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
    const addonNotes = composeAddonNotes(pickedAddons);
    if (addonNotes) parts.push(addonNotes);
    const composed = parts.join(" · ");
    if (instructions.trim() && composed) return `${composed}\n${instructions.trim()}`;
    if (instructions.trim()) return instructions.trim();
    return composed || null;
  };

  const handleAddToCart = () => {
    const line = {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      categorySlug: product.categories[0]?.slug ?? "",
      sizeGrams: pickedSize?.weightGrams ?? undefined,
      sizeLabel: pickedSize?.label,
      instructions: composedInstructions() ?? undefined,
      fulfillment,
      date: product.canBeDeliveredPanIndia ? undefined : date,
      slotKey: product.canBeDeliveredPanIndia ? undefined : slotKey,
      slotLabel: product.canBeDeliveredPanIndia ? undefined : slotLabel,
      isPanIndia: product.canBeDeliveredPanIndia,
      unitPrice,
      originalUnitPrice: originalUnitPrice ?? undefined,
      gstRate: Number(product.gstRate),
      priceIsGstInclusive: product.priceIsGstInclusive,
      qty,
    };
    addLine(line);
    trackAddToCart(line);
    navigate("/cart");
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 pb-16">
      <nav className="mb-4 text-xs text-ink-500">
        <Link to="/" className="hover:text-brand-500">
          Home
        </Link>
        {product.categories.map((c, i) => (
          <span key={c.id}>
            {i === 0 ? <span className="mx-2">›</span> : <span className="mx-1">·</span>}
            <Link to={`/category/${c.slug}`} className="hover:text-brand-500">
              {c.name}
            </Link>
          </span>
        ))}
        <span className="mx-2">›</span>
        <span className="text-ink-700">{product.name}</span>
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <div className="lg:sticky lg:top-24">
          <ProductGallery images={galleryImages} alt={product.name} />
        </div>

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
            {product.isHealthyTreat && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                Healthy treat
              </span>
            )}
            {!product.isAvailable && (
              <span className="rounded-full bg-cream-200 px-3 py-1 text-xs font-medium text-ink-700">
                Out of stock
              </span>
            )}
            {product.tags.map((t) => (
              <ProductTagBadge key={t.id} tag={t} size="md" />
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <VegBadge isVeg={product.isEggless} />
              <h1 className="font-display text-3xl text-ink-900 md:text-4xl">{product.name}</h1>
            </div>
            {product.shortDescription && (
              <p className="text-sm text-ink-500">{product.shortDescription}</p>
            )}
          </div>

          <div>
            <Price
              amount={unitPrice}
              original={originalUnitPrice}
              showBadge
              className="text-3xl text-ink-900"
            />
            <p className="mt-1 text-xs text-ink-500">
              {product.priceIsGstInclusive
                ? PRODUCT_COPY.labels.priceIncludesGst
                : `+ ${Number(product.gstRate)}% GST added at checkout`}
            </p>
          </div>

          {sizeGroup && sizeGroup.options.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-ink-500 uppercase">
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
                        <Price
                          amount={applyFactor(Number(o.price), factor)}
                          original={Number(o.price)}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {crustGroup && crustGroup.options.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-ink-500 uppercase">
                {crustGroup.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {crustGroup.options.map((o) => {
                  const active = o.id === crustId;
                  const delta = applyFactor(Number(o.price), factor);
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

          {addons.length > 0 && (
            <AddonsPicker
              addons={addons}
              selected={addonIds}
              onToggle={(id) => {
                const next = new Set(addonIds);
                next.has(id) ? next.delete(id) : next.add(id);
                setAddonIds(next);
              }}
            />
          )}

          <hr className="border-cream-200" />

          {!product.canBeDeliveredPanIndia && (
            <div className="space-y-3">
              <SegmentedChoice
                ariaLabel={PRODUCT_COPY.labels.deliveryOrPickup}
                value={fulfillment}
                onChange={setFulfillment}
                options={[
                  { value: "delivery", label: PRODUCT_COPY.labels.delivery },
                  { value: "pickup", label: PRODUCT_COPY.labels.pickup },
                ]}
              />

              {fulfillment === "delivery" && <PincodeChecker onResult={setPincodeResult} />}

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
            </div>
          )}

          {product.canBeDeliveredPanIndia && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Ships nationwide via courier. No delivery slot needed — just add to cart and check
              out.
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium tracking-wide text-ink-500 uppercase">
              {PRODUCT_COPY.labels.specialInstructions}
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={PRODUCT_COPY.labels.specialInstructionsHint}
              className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </div>

          <div className="rounded-card border border-cream-200 bg-cream-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                {PRODUCT_COPY.labels.quantity}
              </span>
              <QtyControl value={qty} onChange={setQty} />
            </div>
            <div className="mb-3 flex items-center justify-between border-t border-cream-200 pt-3">
              <span className="text-sm text-ink-700">{PRODUCT_COPY.labels.total}</span>
              <Price amount={total} original={originalTotal} className="text-xl text-ink-900" />
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canOrder}
              className="w-full rounded-full bg-brand-500 py-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {product.isAvailable ? PRODUCT_COPY.labels.addToCart : "Out of stock"}
            </button>
            {product.isAvailable && !canOrder && (
              <p className="mt-2 text-center text-xs text-ink-500">
                {sizeGroup && !pickedSize
                  ? "Pick a size to continue."
                  : product.canBeDeliveredPanIndia
                    ? ""
                    : "Pick a delivery date and slot to continue."}
              </p>
            )}
          </div>
        </div>
      </div>

      {product.description && (
        <section className="mt-14">
          <h2 className="mb-3 font-display text-2xl text-ink-900">About this dish</h2>
          <p className="max-w-3xl leading-relaxed whitespace-pre-line text-ink-700">
            {product.description}
          </p>
          {product.allergens.length > 0 && (
            <p className="mt-4 text-xs text-ink-500">
              <strong className="tracking-wide uppercase">Contains:</strong>{" "}
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

      <ProductReviews slug={product.slug} />
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
      <p className="mb-2 text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</p>
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
              {delta > 0 && <span className="text-ink-500">+₹{delta.toFixed(0)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function composeAddonNotes(addons: ProductAddon[]): string | null {
  if (addons.length === 0) return null;
  const groups = new Map<string, string[]>();
  for (const addon of addons) {
    const group = addon.group?.trim() || "Add-ons";
    const names = groups.get(group) ?? [];
    names.push(addon.name);
    groups.set(group, names);
  }
  return [...groups.entries()].map(([group, names]) => `${group}: ${names.join(", ")}`).join(" · ");
}

function AddonsPicker({
  addons,
  selected,
  onToggle,
}: {
  addons: ProductAddon[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, ProductAddon[]>();
    for (const addon of addons) {
      const key = addon.group?.trim() || "Add-ons";
      const list = map.get(key) ?? [];
      list.push(addon);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [addons]);

  const [open, setOpen] = useState(false);
  // A lone group opens with the box; with several, the customer picks which to browse.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() =>
    groups.length === 1 ? new Set([groups[0]![0]]) : new Set(),
  );
  const toggleGroup = (group: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (!next.delete(group)) next.add(group);
      return next;
    });

  const picked = addons.filter((a) => selected.has(a.id));
  const pickedTotal = picked.reduce((s, a) => s + Number(a.priceDelta), 0);
  const summary =
    picked.length === 0
      ? `${addons.length} optional extra${addons.length === 1 ? "" : "s"}`
      : `${picked.length} added${pickedTotal > 0 ? ` · +₹${pickedTotal.toFixed(0)}` : ""}`;

  return (
    <div className="rounded-xl border border-cream-200 bg-cream-100/70">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink-900">Add-ons</span>
          <span
            className={cn(
              "mt-0.5 block truncate text-xs",
              picked.length > 0 ? "font-medium text-brand-700" : "text-ink-500",
            )}
          >
            {summary}
          </span>
        </span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-ink-500 transition-transform", open && "rotate-180")}
        />
      </button>

      <Collapse open={open}>
        <div className="divide-y divide-cream-200 border-t border-cream-200">
          {groups.map(([group, items]) => {
            const groupOpen = openGroups.has(group);
            const groupPicked = items.filter((a) => selected.has(a.id)).length;
            return (
              <div key={group}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  aria-expanded={groupOpen}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
                >
                  <span className="min-w-0 flex-1 truncate text-xs font-medium tracking-wide text-ink-700 uppercase">
                    {group}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[11px]",
                      groupPicked > 0 ? "font-medium text-brand-700" : "text-ink-500",
                    )}
                  >
                    {groupPicked > 0 ? `${groupPicked} added` : items.length}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-ink-500 transition-transform",
                      groupOpen && "rotate-180",
                    )}
                  />
                </button>
                <Collapse open={groupOpen}>
                  <div className="flex flex-wrap gap-2 px-4 pb-3">
                    {items.map((addon) => {
                      const on = selected.has(addon.id);
                      const delta = Number(addon.priceDelta);
                      return (
                        <button
                          key={addon.id}
                          type="button"
                          onClick={() => onToggle(addon.id)}
                          aria-pressed={on}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border py-1.5 pr-3 text-left text-xs font-medium transition",
                            addon.imageUrl ? "pl-1.5" : "pl-3",
                            on
                              ? "border-brand-500 bg-brand-100 text-brand-700"
                              : "border-cream-200 bg-white text-ink-700 hover:border-brand-300",
                          )}
                        >
                          {addon.imageUrl && (
                            <img
                              src={addon.imageUrl}
                              alt=""
                              className="h-8 w-8 rounded-md object-cover"
                            />
                          )}
                          <span>
                            <span className="block">{addon.name}</span>
                            <span className="mt-0.5 block text-[11px] font-normal text-ink-500">
                              {delta === 0 ? "no extra" : `+₹${delta.toFixed(0)}`}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Collapse>
              </div>
            );
          })}
        </div>
      </Collapse>
    </div>
  );
}

function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows] duration-200",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
