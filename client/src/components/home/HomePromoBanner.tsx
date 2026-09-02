import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePublicCoupons, type PublicCoupon } from "@/hooks/useCoupons";
import { HOME_COPY } from "@/content/home";

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(code).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-mono text-xs font-semibold tracking-wide text-brand-700 shadow-sm ring-1 ring-white/60 transition hover:bg-cream-50"
    >
      {code}
      <span className="text-[9px] font-sans font-semibold uppercase tracking-wider text-ink-500">
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

function PromoCard({ coupon }: { coupon: PublicCoupon }) {
  const remainingLabel =
    coupon.remaining != null
      ? coupon.remaining === 1
        ? "1 left"
        : `${coupon.remaining} left`
      : null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-500 via-brand-600 to-ink-900 px-4 py-2.5 text-white shadow-[0_10px_24px_rgba(227,28,121,0.22)] sm:px-5 sm:py-3">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-white/15 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/75">
              Limited offer
            </span>
            <h2 className="font-display text-base leading-tight sm:text-lg">
              {coupon.headline}
            </h2>
          </div>
          {coupon.copy && (
            <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-white/90">
              {coupon.copy}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <CopyCode code={coupon.code} />
          {remainingLabel && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium">
              {remainingLabel}
            </span>
          )}
          {coupon.waivesDelivery && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium">
              Free delivery
            </span>
          )}
          <Link
            to={HOME_COPY.hero.primaryCta.to}
            className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-700 shadow-sm transition hover:-translate-y-0.5"
          >
            Shop now
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HomePromoBanner() {
  const { data: coupons = [] } = usePublicCoupons();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (coupons.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % coupons.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [coupons.length]);

  const current = coupons[index] ?? coupons[0];
  if (!current) return null;

  return (
    <div className="mx-auto max-w-6xl px-2 pb-1 pt-2 sm:px-4 sm:pt-3">
      <PromoCard coupon={current} />
      {coupons.length > 1 && (
        <div className="mt-1.5 flex justify-center gap-1">
          {coupons.map((c, i) => (
            <button
              key={c.code}
              type="button"
              aria-label={`Show offer ${c.code}`}
              onClick={() => setIndex(i)}
              className={`h-1 rounded-full transition-all ${
                i === index ? "w-5 bg-brand-500" : "w-1 bg-brand-200"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
