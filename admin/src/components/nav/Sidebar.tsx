import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";
import { ADMIN_NAV } from "@/content/nav";

export function Sidebar({ open }: { open: boolean }) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 w-60 shrink-0 border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 px-4">
        <img src="/logo.png" alt="Keyafe" className="h-8 w-8 rounded-full" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            Keyafe
          </p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">
            Admin
          </p>
        </div>
      </div>

      <nav className="h-[calc(100vh-3.5rem)] overflow-y-auto py-4">
        {ADMIN_NAV.map((group) => (
          <div key={group.label} className="mb-4 px-3">
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100",
                          isActive &&
                            "bg-brand-100 font-medium text-brand-700 hover:bg-brand-100",
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
