import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useCart } from "@/store/cart";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/cn";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { UserMenu } from "@/components/auth/UserMenu";
import { CategoriesMenu } from "@/components/categories/CategoriesMenu";
import { BRAND } from "@/content/brand";
import { SAMEDAY_NAV, HEALTHY_NAV } from "@/content/nav";
import { AUTH_COPY } from "@/content/auth";
import { useCategories } from "@/hooks/useCategories";
import { Menu, ShoppingCart, X } from "lucide-react";

export function Header() {
  const count = useCart((s) => s.itemCount());
  const user = useAuth((s) => s.user);
  const { data: categories = [] } = useCategories();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

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

          {/* Middle — Categories dropdown + highlighted tabs. Hidden on small screens. */}
          <nav className="ml-auto hidden items-center gap-2 md:flex">
            <CategoriesMenu />
            <NavLink
              to={SAMEDAY_NAV.to}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-500 px-3 py-1 text-sm font-medium text-brand-500 transition hover:bg-brand-500 hover:text-white",
                  isActive && "bg-brand-500 text-white",
                )
              }
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
              </svg>
              {SAMEDAY_NAV.label}
            </NavLink>
            <NavLink
              to={HEALTHY_NAV.to}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-600 px-3 py-1 text-sm font-medium text-emerald-700 transition hover:bg-emerald-600 hover:text-white",
                  isActive && "bg-emerald-600 text-white",
                )
              }
            >
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
              {HEALTHY_NAV.label}
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-900 hover:text-white",
                  isActive && "bg-slate-900 text-white",
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e7d6b4] bg-white text-ink-800 shadow-sm md:hidden"
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
          className="fixed inset-0 z-50 bg-black/30 md:hidden"
          onClick={closeMobileMenu}
        >
          <div
            className="ml-auto h-full w-[82%] max-w-sm overflow-y-auto border-l border-cream-200 bg-[#fffaf4] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-500">
                Menu
              </p>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-cream-200 bg-white text-ink-700"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-cream-200 bg-white p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
                  Categories
                </p>
                <div className="space-y-2">
                  {categories.length === 0 && (
                    <p className="text-sm text-ink-500">No categories yet.</p>
                  )}
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="rounded-xl border border-cream-200 bg-[#fffaf5] px-2 py-1.5"
                    >
                      <Link
                        to={`/category/${category.slug}`}
                        onClick={closeMobileMenu}
                        className="flex items-center justify-between gap-3 text-sm font-medium text-ink-800"
                      >
                        <span>{category.name}</span>
                        {category.children.length > 0 && (
                          <span className="text-xs text-ink-500">›</span>
                        )}
                      </Link>

                      {category.children.length > 0 && (
                        <div className="mt-2 space-y-1.5 border-l border-cream-200 pl-3">
                          {category.children.map((child) => (
                            <Link
                              key={child.id}
                              to={`/category/${child.slug}`}
                              onClick={closeMobileMenu}
                              className="block text-sm text-ink-600 hover:text-brand-500"
                            >
                              {child.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <nav className="space-y-2.5 rounded-2xl border border-cream-200 bg-white p-3">
                <NavLink
                  to={SAMEDAY_NAV.to}
                  onClick={closeMobileMenu}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center justify-between rounded-2xl border border-brand-200 bg-gradient-to-r from-[#fff1f6] to-[#ffe6ef] px-3 py-2.5 text-sm font-semibold text-brand-700 shadow-[0_8px_18px_rgba(227,28,121,0.08)]",
                      isActive && "ring-2 ring-brand-200",
                    )
                  }
                >
                  <span>{SAMEDAY_NAV.label}</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-base shadow-sm">
                    ⚡
                  </span>
                </NavLink>
                <NavLink
                  to={HEALTHY_NAV.to}
                  onClick={closeMobileMenu}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center justify-between rounded-2xl border border-emerald-200 bg-gradient-to-r from-[#f2fff7] to-[#eafcf1] px-3 py-2.5 text-sm font-semibold text-emerald-700 shadow-[0_8px_18px_rgba(16,185,129,0.08)]",
                      isActive && "ring-2 ring-emerald-200",
                    )
                  }
                >
                  <span>{HEALTHY_NAV.label}</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-base shadow-sm">
                    🌿
                  </span>
                </NavLink>
                <NavLink
                  to="/about"
                  onClick={closeMobileMenu}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700",
                      isActive && "bg-slate-100 ring-1 ring-slate-200",
                    )
                  }
                >
                  <span>About</span>
                  <span className="text-base text-slate-500">✦</span>
                </NavLink>
              </nav>

              {!user && (
                <div className="rounded-2xl border border-cream-200 bg-white p-3">
                  <AuthDialog
                    trigger={
                      <button
                        type="button"
                        onClick={closeMobileMenu}
                        className="w-full rounded-full bg-brand-500 px-4 py-2.5 text-sm font-medium text-white"
                      >
                        {AUTH_COPY.headerButton}
                      </button>
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
