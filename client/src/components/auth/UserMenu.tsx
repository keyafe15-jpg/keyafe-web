import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/cn";
import { AUTH_COPY } from "@/content/auth";

export function UserMenu() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-2 rounded-full border border-cream-200 bg-white px-3 py-1.5 text-sm text-ink-700 transition hover:border-brand-300 hover:text-brand-500"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:inline">
          {user.name.split(" ")[0]}
        </span>
      </button>

      <div
        className={cn(
          "absolute right-0 top-full z-30 mt-2 w-56 origin-top-right rounded-xl border border-cream-200 bg-white p-2 shadow-lg transition",
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0",
        )}
      >
        <div className="border-b border-cream-100 px-3 py-2">
          <p className="text-sm font-medium text-ink-900">{user.name}</p>
          <p className="truncate text-xs text-ink-500">{user.phone}</p>
        </div>
        <Link
          to="/my-orders"
          onClick={() => setOpen(false)}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-700 transition hover:bg-cream-100"
        >
          {AUTH_COPY.menu.myOrders}
        </Link>
        <Link
          to="/saved-addresses"
          onClick={() => setOpen(false)}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-700 transition hover:bg-cream-100"
        >
          {AUTH_COPY.menu.savedAddresses}
        </Link>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            void logout();
            setOpen(false);
          }}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-brand-500 transition hover:bg-cream-100"
        >
          {AUTH_COPY.menu.logout}
        </button>
      </div>
    </div>
  );
}
