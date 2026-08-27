import { Link } from "react-router-dom";
import { BRAND } from "@/content/brand";
import { FOOTER_COPY } from "@/content/footer";
import { UTILITY_LINKS } from "@/content/nav";
import { useCategories } from "@/hooks/useCategories";

export function Footer() {
  const { data: categories = [] } = useCategories();

  return (
    <footer className="mt-24 border-t border-cream-200 bg-cream-100 py-10">
      <div className="mx-auto max-w-6xl px-4 text-sm text-ink-700">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-2 text-lg text-brand-500">{BRAND.name}</h3>
            <p className="text-ink-500">{FOOTER_COPY.brandBlurb}</p>
          </div>
          <div>
            <h4 className="mb-2 font-semibold">
              {FOOTER_COPY.sections.shop.heading}
            </h4>
            <ul className="space-y-1 text-ink-500">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/category/${c.slug}`}
                    className="transition hover:text-brand-500"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
              {UTILITY_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="transition hover:text-brand-500">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 font-semibold">
              {FOOTER_COPY.sections.contact.heading}
            </h4>
            <p className="text-ink-500">
              <a
                href={`mailto:${FOOTER_COPY.sections.contact.email}`}
                className="transition hover:text-brand-500"
              >
                {FOOTER_COPY.sections.contact.email}
              </a>
            </p>
          </div>
        </div>
        <p className="mt-8 text-xs text-ink-500">
          {FOOTER_COPY.copyright(new Date().getFullYear())}
        </p>
      </div>
    </footer>
  );
}
