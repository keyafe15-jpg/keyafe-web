import { Link } from "react-router-dom";
import { BRAND } from "@/content/brand";
import { FOOTER_COPY } from "@/content/footer";
import { HEALTHY_NAV, PANINDIA_NAV, SAMEDAY_NAV } from "@/content/nav";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/cn";
import {
  ArrowUp,
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

const ORDER_LINKS = [
  SAMEDAY_NAV,
  HEALTHY_NAV,
  PANINDIA_NAV,
  { to: "/about", label: "About us" },
] as const;

export function Footer() {
  const { data: categories = [] } = useCategories();
  const year = new Date().getFullYear();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative mt-16 overflow-hidden bg-ink-900 text-cream-50">
      <div
        className="pointer-events-none absolute -left-20 top-0 h-40 w-40 rounded-full bg-brand-500/25 blur-[70px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-0 h-36 w-36 rounded-full bg-amber-400/10 blur-[80px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="inline-flex shrink-0 items-center gap-2.5">
              <img
                src={BRAND.logoSrc}
                alt={BRAND.logoAlt}
                className="h-9 w-9 rounded-full border border-white/15 bg-white object-cover"
              />
              <span className="brand-wordmark text-xl">{BRAND.name}</span>
            </Link>
            <h2 className="hidden font-display text-lg leading-snug tracking-tight text-white md:block">
              {FOOTER_COPY.headline[0]}{" "}
              <span className="text-brand-300">{FOOTER_COPY.headline[1]}</span>
            </h2>
          </div>

          <Link
            to={FOOTER_COPY.cta.to}
            className="group inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(227,28,121,0.3)] transition hover:-translate-y-0.5 hover:bg-brand-700"
          >
            {FOOTER_COPY.cta.label}
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 transition group-hover:rotate-45">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>

        <h2 className="mt-3 font-display text-xl leading-snug text-white md:hidden">
          {FOOTER_COPY.headline[0]}{" "}
          <span className="text-brand-300">{FOOTER_COPY.headline[1]}</span>
        </h2>

        <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 lg:flex-row lg:items-center lg:justify-between">
          <nav
            aria-label={FOOTER_COPY.sections.shop.heading}
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]"
          >
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/category/${category.slug}`}
                className="text-cream-100/80 transition hover:text-white"
              >
                {category.name}
              </Link>
            ))}
            {ORDER_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-cream-100/80 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`mailto:${FOOTER_COPY.sections.studio.email}`}
              className="inline-flex items-center gap-1.5 text-[13px] text-cream-100/80 transition hover:text-white"
            >
              <Mail className="h-3.5 w-3.5 text-brand-300" />
              <span className="hidden sm:inline">
                {FOOTER_COPY.sections.studio.email}
              </span>
            </a>
            <a
              href={`tel:${BRAND.supportPhone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1.5 text-[13px] text-cream-100/80 transition hover:text-white"
            >
              <Phone className="h-3.5 w-3.5 text-brand-300" />
              <span className="hidden sm:inline">{BRAND.supportPhone}</span>
            </a>
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 transition hover:border-brand-300 hover:bg-brand-500 hover:text-white"
              >
                <Icon className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-cream-100/45">
            {FOOTER_COPY.copyright(year)}
          </p>
          <button
            type="button"
            onClick={scrollToTop}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-cream-100/80 transition",
              "hover:border-brand-300 hover:bg-brand-500 hover:text-white",
            )}
          >
            {FOOTER_COPY.scrollTop}
            <ArrowUp className="h-3 w-3" />
          </button>
        </div>
      </div>
    </footer>
  );
}
