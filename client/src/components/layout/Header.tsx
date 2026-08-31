import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useCart } from "@/store/cart";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/cn";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { UserMenu } from "@/components/auth/UserMenu";
import { CategoriesMenu } from "@/components/categories/CategoriesMenu";
import { BRAND } from "@/content/brand";
import { SAMEDAY_NAV, HEALTHY_NAV, PANINDIA_NAV } from "@/content/nav";
import { AUTH_COPY } from "@/content/auth";
import { useCategories } from "@/hooks/useCategories";
import { Menu, ShoppingCart, X } from "lucide-react";

type Accent = "brand" | "emerald" | "amber";

const ACCENT_STYLES: Record<
  Accent,
  { badge: string; hover: string; active: string }
> = {
  brand: {
    badge: "bg-brand-100 text-brand-600",
    hover: "hover:bg-brand-50 hover:text-brand-700",
    active: "bg-brand-500 text-white shadow-[0_6px_14px_rgba(227,28,121,0.3)]",
  },
  emerald: {
    badge: "bg-emerald-100 text-emerald-600",
    hover: "hover:bg-emerald-50 hover:text-emerald-700",
    active: "bg-emerald-600 text-white shadow-[0_6px_14px_rgba(5,150,105,0.3)]",
  },
  amber: {
    badge: "bg-amber-100 text-amber-600",
    hover: "hover:bg-amber-50 hover:text-amber-700",
    active: "bg-amber-500 text-white shadow-[0_6px_14px_rgba(217,119,6,0.3)]",
  },
};

function FeaturePill({
  to,
  label,
  icon,
  accent,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  accent: Accent;
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-1 pr-3 text-sm font-medium text-ink-700 transition-all duration-200",
          !isActive && styles.hover,
          isActive && styles.active,
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
              isActive ? "bg-white/25 text-white" : styles.badge,
            )}
          >
            {icon}
          </span>
          {label}
        </>
      )}
    </NavLink>
  );
}

export function Header() {
  const count = useCart((s) => s.itemCount());
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { data: categories = [] } = useCategories();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(
    null,
  );

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setExpandedCategoryId(null);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-cream-200 bg-cream-50/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <img
              src={BRAND.logoSrc}
              alt={BRAND.logoAlt}
              className="h-11 w-11 rounded-full border border-[#e7d6b4] bg-white object-cover shadow-sm md:h-12 md:w-12"
            />
            <span className="brand-wordmark">{BRAND.name}</span>
          </Link>

          {/* Middle — Categories dropdown + highlighted tabs. Hidden on small and tablet screens. */}
          <nav className="ml-auto hidden items-center gap-0.5 rounded-full border border-cream-200 bg-white/70 p-1 shadow-sm backdrop-blur-md lg:flex">
            <CategoriesMenu />
            <span
              className="mx-1 h-5 w-px shrink-0 bg-cream-200"
              aria-hidden="true"
            />
            <FeaturePill
              to={SAMEDAY_NAV.to}
              label={SAMEDAY_NAV.label}
              accent="brand"
              icon={
                <svg
                  width={13}
                  height={13}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
                </svg>
              }
            />
            <FeaturePill
              to={HEALTHY_NAV.to}
              label={HEALTHY_NAV.label}
              accent="emerald"
              icon={
                <svg
                  width={13}
                  height={13}
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
              }
            />
            <FeaturePill
              to={PANINDIA_NAV.to}
              label={PANINDIA_NAV.label}
              accent="amber"
              icon={
                <svg
                  width={13}
                  height={13}
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
              }
            />
            <span
              className="mx-1 h-5 w-px shrink-0 bg-cream-200"
              aria-hidden="true"
            />
            <NavLink
              to="/about"
              className={({ isActive }) =>
                cn(
                  "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-ink-900 hover:text-white",
                  isActive && "bg-ink-900 text-white",
                )
              }
            >
              About
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <div className="hidden sm:block">
                <UserMenu />
              </div>
            ) : (
              <div className="hidden sm:block">
                <AuthDialog
                  trigger={
                    <button
                      type="button"
                      className="rounded-full border border-ink-700 px-4 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-cream-100"
                    >
                      {AUTH_COPY.headerButton}
                    </button>
                  }
                />
              </div>
            )}

            <Link
              to="/cart"
              className="relative rounded-full bg-ink-700 p-2.5 text-sm font-medium text-white transition hover:bg-ink-900"
            >
              <ShoppingCart className="h-4 w-4" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>

            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e7d6b4] bg-white text-ink-800 shadow-sm lg:hidden"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px] lg:hidden"
          onClick={closeMobileMenu}
        >
          <div
            className="drawer-panel ml-auto flex h-full w-[86%] max-w-sm flex-col overflow-y-auto bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-cream-100 bg-white/95 px-5 py-3.5 backdrop-blur">
              <Link
                to="/"
                onClick={closeMobileMenu}
                className="flex items-center gap-2"
              >
                <img
                  src={BRAND.logoSrc}
                  alt={BRAND.logoAlt}
                  className="h-9 w-9 rounded-full border border-[#e7d6b4] bg-white object-cover shadow-sm"
                />
                <span className="brand-wordmark text-lg">{BRAND.name}</span>
              </Link>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-cream-100 text-ink-700 transition hover:bg-cream-200"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-6 px-5 py-5">
              {user ? (
                <div className="rounded-2xl bg-gradient-to-r from-cream-50 to-cream-100 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {user.name}
                      </p>
                      <p className="truncate text-xs text-ink-500">
                        {user.phone}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link
                      to="/my-orders"
                      onClick={closeMobileMenu}
                      className="rounded-xl bg-white px-3 py-2 text-center text-xs font-medium text-ink-700 shadow-sm transition hover:text-brand-500"
                    >
                      {AUTH_COPY.menu.myOrders}
                    </Link>
                    <Link
                      to="/saved-addresses"
                      onClick={closeMobileMenu}
                      className="rounded-xl bg-white px-3 py-2 text-center text-xs font-medium text-ink-700 shadow-sm transition hover:text-brand-500"
                    >
                      {AUTH_COPY.menu.savedAddresses}
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void logout();
                      closeMobileMenu();
                    }}
                    className="mt-2 w-full rounded-xl px-3 py-2 text-center text-xs font-medium text-ink-500 transition hover:bg-white hover:text-brand-500"
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <AuthDialog
                  trigger={
                    <button
                      type="button"
                      onClick={closeMobileMenu}
                      className="w-full rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(227,28,121,0.25)] transition hover:bg-brand-700"
                    >
                      {AUTH_COPY.headerButton}
                    </button>
                  }
                />
              )}

              <div>
                <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">
                  Quick links
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <NavLink
                    to={SAMEDAY_NAV.to}
                    onClick={closeMobileMenu}
                    className={({ isActive }) =>
                      cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl border border-brand-200 bg-gradient-to-b from-[#fff1f6] to-[#ffe6ef] px-2 py-3 text-center transition active:scale-95",
                        isActive && "ring-2 ring-brand-300",
                      )
                    }
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-base shadow-sm">
                      ⚡
                    </span>
                    <span className="text-xs font-semibold leading-tight text-brand-700">
                      {SAMEDAY_NAV.label}
                    </span>
                  </NavLink>
                  <NavLink
                    to={HEALTHY_NAV.to}
                    onClick={closeMobileMenu}
                    className={({ isActive }) =>
                      cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl border border-emerald-200 bg-gradient-to-b from-[#f2fff7] to-[#eafcf1] px-2 py-3 text-center transition active:scale-95",
                        isActive && "ring-2 ring-emerald-300",
                      )
                    }
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-base shadow-sm">
                      🌿
                    </span>
                    <span className="text-xs font-semibold leading-tight text-emerald-700">
                      {HEALTHY_NAV.label}
                    </span>
                  </NavLink>
                  <NavLink
                    to={PANINDIA_NAV.to}
                    onClick={closeMobileMenu}
                    className={({ isActive }) =>
                      cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl border border-amber-200 bg-gradient-to-b from-[#fff8ee] to-[#fff1dc] px-2 py-3 text-center transition active:scale-95",
                        isActive && "ring-2 ring-amber-300",
                      )
                    }
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-base shadow-sm">
                      🚚
                    </span>
                    <span className="text-xs font-semibold leading-tight text-amber-700">
                      {PANINDIA_NAV.label}
                    </span>
                  </NavLink>
                  <NavLink
                    to="/about"
                    onClick={closeMobileMenu}
                    className={({ isActive }) =>
                      cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-3 text-center transition active:scale-95",
                        isActive && "ring-2 ring-slate-300",
                      )
                    }
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-base shadow-sm">
                      ✦
                    </span>
                    <span className="text-xs font-semibold leading-tight text-slate-700">
                      About
                    </span>
                  </NavLink>
                </div>
              </div>

              <div>
                <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">
                  Categories
                </p>
                <div className="divide-y divide-cream-100 overflow-hidden rounded-2xl border border-cream-100">
                  {categories.length === 0 && (
                    <p className="p-3 text-sm text-ink-500">
                      No categories yet.
                    </p>
                  )}
                  {categories.map((category) => {
                    const hasChildren = category.children.length > 0;
                    const isExpanded = expandedCategoryId === category.id;

                    return (
                      <div key={category.id} className="bg-white">
                        <div className="flex items-center justify-between gap-3 pl-4 pr-2">
                          <Link
                            to={`/category/${category.slug}`}
                            onClick={closeMobileMenu}
                            className="flex-1 py-3 text-sm font-medium text-ink-800 transition hover:text-brand-500"
                          >
                            {category.name}
                          </Link>
                          {hasChildren && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCategoryId((current) =>
                                  current === category.id ? null : category.id,
                                )
                              }
                              aria-label={
                                isExpanded
                                  ? `Collapse ${category.name}`
                                  : `Expand ${category.name}`
                              }
                              aria-expanded={isExpanded}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-500 transition hover:bg-cream-100"
                            >
                              <span
                                className={cn(
                                  "inline-block text-sm transition-transform duration-200",
                                  isExpanded && "rotate-90",
                                )}
                              >
                                ›
                              </span>
                            </button>
                          )}
                        </div>

                        {hasChildren && isExpanded && (
                          <div className="space-y-0.5 bg-cream-50/60 py-1.5 pl-7 pr-3">
                            {category.children.map((child) => (
                              <Link
                                key={child.id}
                                to={`/category/${child.slug}`}
                                onClick={closeMobileMenu}
                                className="block rounded-lg px-2 py-1.5 text-sm text-ink-600 transition hover:bg-white hover:text-brand-500"
                              >
                                {child.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
