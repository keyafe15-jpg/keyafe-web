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
import { ShoppingCart } from "lucide-react";

export function Header() {
  const count = useCart((s) => s.itemCount());
  const user = useAuth((s) => s.user);

  return (
    <header className="sticky top-0 z-40 border-b border-cream-200 bg-cream-50/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Link to="/" className="block shrink-0">
          <img
            src={BRAND.logoSrc}
            alt={BRAND.logoAlt}
            className="h-12 w-auto md:h-14"
          />
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
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu />
          ) : (
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
          )}

          <Link
            to="/cart"
            className="relative rounded-full bg-ink-700 px-2 py-2 text-sm font-medium text-white transition hover:bg-ink-900"
          >
            <ShoppingCart />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
