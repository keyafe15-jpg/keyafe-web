import { useEffect } from "react";
import { NavLink, matchPath, useLocation } from "react-router-dom";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { ADMIN_NAV, type AdminNavItem } from "@/content/nav";
import { useAdminAuth } from "@/store/adminAuth";
import { useNavGroups } from "@/store/navGroups";
import { staffHasPermission } from "@/lib/permissions";

const isExact = (item: AdminNavItem) => item.to === "/" || Boolean(item.end);

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate?: () => void }) {
  const user = useAdminAuth((s) => s.user);
  const openGroups = useNavGroups((s) => s.open);
  const toggleGroup = useNavGroups((s) => s.toggle);
  const visitGroup = useNavGroups((s) => s.visit);
  const { pathname } = useLocation();

  const groups = ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.requiresPermission || staffHasPermission(user, item.requiresPermission),
    ),
  })).filter((group) => group.items.length > 0);

  const activeGroup = groups.find((group) =>
    group.items.some(
      (item) => !item.external && matchPath({ path: item.to, end: isExact(item) }, pathname),
    ),
  )?.label;

  useEffect(() => {
    if (activeGroup) visitGroup(activeGroup);
  }, [activeGroup, visitGroup]);

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
          <p className="truncate text-sm font-semibold text-slate-900">Keyafe</p>
          <p className="text-[10px] tracking-widest text-slate-500 uppercase">
            {user?.role.slug === "chef" ? "Kitchen" : "Admin"}
          </p>
        </div>
      </div>

      <nav className="h-[calc(100vh-3.5rem)] overflow-y-auto py-3">
        {groups.map((group) => {
          const expanded = openGroups.includes(group.label);
          const hasActive = group.label === activeGroup;
          const listId = `nav-group-${group.label.toLowerCase().replace(/\W+/g, "-")}`;
          return (
            <div key={group.label} className="mb-1 px-3">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                aria-expanded={expanded}
                aria-controls={listId}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-semibold tracking-widest text-slate-400 uppercase transition hover:bg-slate-50 hover:text-slate-600"
              >
                <span className="truncate">{group.label}</span>
                {!expanded && hasActive && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
                    title="The page you're on is in here"
                  />
                )}
                {!expanded && (
                  <span className="ml-auto font-medium tracking-normal normal-case">
                    {group.items.length}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform",
                    expanded ? "ml-auto" : "-rotate-90",
                  )}
                />
              </button>
              <div
                id={listId}
                inert={!expanded}
                className={cn(
                  "grid transition-[grid-template-rows] duration-200",
                  expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <ul className="space-y-0.5 pb-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      if (item.external) {
                        return (
                          <li key={item.to}>
                            <a
                              href={item.to}
                              target="_blank"
                              rel="noreferrer"
                              onClick={onNavigate}
                              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="truncate">{item.label}</span>
                              <ExternalLink
                                className="ml-auto h-3 w-3 shrink-0 text-slate-400"
                                aria-label="Opens in a new tab"
                              />
                            </a>
                          </li>
                        );
                      }
                      return (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            end={isExact(item)}
                            onClick={onNavigate}
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
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
