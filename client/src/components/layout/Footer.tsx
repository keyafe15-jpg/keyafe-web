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
  Sparkles,
} from "lucide-react";

const SOCIAL_LINKS = [
  { href: BRAND.socials.instagram, label: "Instagram", Icon: Instagram },
  { href: BRAND.socials.facebook, label: "Facebook", Icon: Facebook },
  { href: BRAND.socials.whatsapp, label: "WhatsApp", Icon: MessageCircle },
] as const;

const FOOTER_PROMISES = ["Small-batch", "Freshly baked", "Delivered warm"];

export function Footer() {
  const { data: categories = [] } = useCategories();
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-cream-200 bg-[#fff8e8] text-ink-700">
      <div
        className="absolute left-[-7rem] top-[-7rem] h-64 w-64 rounded-full bg-brand-300/25 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-8rem] right-[-6rem] h-72 w-72 rounded-full bg-amber-300/35 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:py-12">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.25fr] lg:items-stretch">
          <div className="overflow-hidden rounded-3xl border border-white/80 bg-ink-900 text-white shadow-[0_20px_46px_rgba(26,33,42,0.14)]">
            <div className="relative flex min-h-full flex-col justify-between gap-8 p-5 sm:p-6">
              <div
                className="absolute right-[-4rem] top-[-4rem] h-40 w-40 rounded-full border border-white/15"
                aria-hidden="true"
              />
              <div
                className="absolute bottom-[-4.5rem] left-[-2rem] h-36 w-36 rounded-full bg-brand-500/25 blur-2xl"
                aria-hidden="true"
              />
              <div className="relative">
                <Link to="/" className="inline-flex items-center gap-3">
                  <img
                    src={BRAND.logoSrc}
                    alt={BRAND.logoAlt}
                    className="h-14 w-14 rounded-full border border-white/30 bg-white object-cover shadow-lg"
                  />
                  <span className="brand-wordmark text-3xl text-brand-300">
                    {BRAND.name}
                  </span>
                </Link>
                <p className="mt-5 max-w-sm text-base leading-7 text-cream-100/85">
                  {FOOTER_COPY.brandBlurb}
                </p>
              </div>

              <div className="relative grid gap-2 sm:grid-cols-3">
                {FOOTER_PROMISES.map((promise) => (
                  <span
                    key={promise}
                    className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cream-100"
                  >
                    {promise}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-cream-200/80 bg-white/75 p-5 shadow-[0_16px_40px_rgba(176,121,56,0.1)] backdrop-blur sm:p-6">
            <div className="grid gap-6 md:grid-cols-[1fr_0.9fr]">
              <div>
                <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-brand-500">
                  <Sparkles className="h-4 w-4" />
                  {FOOTER_COPY.sections.shop.heading}
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      to={`/category/${category.slug}`}
                      className="group inline-flex items-center gap-1 rounded-full border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-medium text-ink-700 transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-white hover:text-brand-500 hover:shadow-sm"
                    >
                      {category.name}
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                    </Link>
                  ))}
                  {UTILITY_LINKS.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="group inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(227,28,121,0.22)] transition hover:-translate-y-0.5 hover:bg-brand-700"
                    >
                      {link.label}
                      <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-ink-500">
                  {FOOTER_COPY.sections.contact.heading}
                </div>
                <div className="space-y-3">
                  <a
                    href={`mailto:${FOOTER_COPY.sections.contact.email}`}
                    className="flex items-center gap-3 rounded-2xl border border-cream-200 bg-cream-50/70 p-3 transition hover:border-brand-300 hover:bg-white hover:text-brand-500"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-500">
                      <Mail className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium">
                      {FOOTER_COPY.sections.contact.email}
                    </span>
                  </a>
                  <a
                    href={`tel:${BRAND.supportPhone.replace(/\s/g, "")}`}
                    className="flex items-center gap-3 rounded-2xl border border-cream-200 bg-cream-50/70 p-3 transition hover:border-brand-300 hover:bg-white hover:text-brand-500"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <Phone className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium">
                      {BRAND.supportPhone}
                    </span>
                  </a>
                </div>

                <div className="mt-5 flex gap-2">
                  {SOCIAL_LINKS.map(({ href, label, Icon }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={label}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-cream-200 bg-white text-ink-700 transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-500 hover:text-white hover:shadow-sm"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-cream-200/80 pt-5 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{FOOTER_COPY.copyright(year)}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1 font-semibold text-ink-700 transition hover:text-brand-500"
          >
            Back to bakery
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
