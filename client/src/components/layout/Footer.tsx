import { Link } from "react-router-dom";
import { BRAND } from "@/content/brand";
import { FOOTER_COPY } from "@/content/footer";
import { UTILITY_LINKS } from "@/content/nav";
import { useCategories } from "@/hooks/useCategories";
import {
  ArrowUpRight,
  Facebook,
  Instagram,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";

const SOCIAL_LINKS = [
  { href: BRAND.socials.instagram, label: "Instagram", Icon: Instagram },
  { href: BRAND.socials.facebook, label: "Facebook", Icon: Facebook },
  { href: BRAND.socials.whatsapp, label: "WhatsApp", Icon: MessageCircle },
] as const;

export function Footer() {
  const { data: categories = [] } = useCategories();
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-cream-200 bg-gradient-to-b from-white/70 to-cream-50 text-ink-700">
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute right-0 top-0 h-full w-1/3 bg-[linear-gradient(120deg,transparent,rgba(227,28,121,0.08))]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-3xl border border-cream-200/80 bg-white/80 px-5 py-5 shadow-[0_14px_38px_rgba(176,121,56,0.1)] backdrop-blur sm:px-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-sm">
              <Link to="/" className="inline-flex items-center gap-3">
                <img
                  src={BRAND.logoSrc}
                  alt={BRAND.logoAlt}
                  className="h-11 w-11 rounded-full border border-cream-200 bg-white object-cover shadow-sm"
                />
                <span className="brand-wordmark text-2xl">{BRAND.name}</span>
              </Link>
              <p className="mt-3 text-sm leading-6 text-ink-500">
                {FOOTER_COPY.brandBlurb}
              </p>
            </div>

            <nav
              aria-label={FOOTER_COPY.sections.shop.heading}
              className="flex max-w-xl flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-ink-600 lg:justify-center"
            >
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/category/${category.slug}`}
                  className="transition hover:text-brand-500"
                >
                  {category.name}
                </Link>
              ))}
              {UTILITY_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="inline-flex items-center gap-1 font-semibold text-brand-500 transition hover:text-brand-700"
                >
                  {link.label}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              ))}
            </nav>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <a
                href={`mailto:${FOOTER_COPY.sections.contact.email}`}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-cream-200 bg-cream-50 px-3 text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:bg-white hover:text-brand-500"
              >
                <Mail className="h-4 w-4" />
                <span className="hidden xl:inline">
                  {FOOTER_COPY.sections.contact.email}
                </span>
              </a>
              <a
                href={`tel:${BRAND.supportPhone.replace(/\s/g, "")}`}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-cream-200 bg-cream-50 px-3 text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:bg-white hover:text-brand-500"
              >
                <Phone className="h-4 w-4" />
                <span className="hidden xl:inline">{BRAND.supportPhone}</span>
              </a>
              {SOCIAL_LINKS.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-cream-200 bg-white text-ink-700 transition hover:border-brand-300 hover:bg-brand-500 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 px-1 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{FOOTER_COPY.copyright(year)}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1 font-semibold text-ink-600 transition hover:text-brand-500"
          >
            Back to bakery
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
