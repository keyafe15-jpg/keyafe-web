import { Link } from "react-router-dom";
import { HEALTHY_COPY, HEALTHY_PLACEHOLDER } from "@/content/healthy";

export function HealthyPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 pb-16">
      <div className="mb-8">
        <p className="mb-2 flex items-center gap-2 text-sm uppercase tracking-widest text-brand-500">
          <LeafIcon /> {HEALTHY_COPY.eyebrow}
        </p>
        <h1 className="font-display text-3xl text-ink-900 md:text-4xl">
          {HEALTHY_COPY.title}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-500">{HEALTHY_COPY.sub}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {HEALTHY_PLACEHOLDER.map((p) => (
          <Link
            key={p.slug}
            to={`/product/${p.slug}`}
            className="group block rounded-card border border-cream-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="mb-4 aspect-[4/3] rounded-xl bg-gradient-to-br from-cream-100 to-brand-100" />
            <h3 className="mb-1 text-lg text-ink-900 group-hover:text-brand-500">
              {p.name}
            </h3>
            <p className="text-sm text-ink-500">{p.blurb}</p>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-xs text-ink-500">
        {HEALTHY_COPY.placeholderNote}
      </p>
    </section>
  );
}

function LeafIcon() {
  return (
    <svg
      width={14}
      height={14}
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
  );
}
