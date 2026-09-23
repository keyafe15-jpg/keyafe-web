import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, Volume2, VolumeX, Bell, BellOff, LogOut, User } from "lucide-react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useAdminAuth } from "@/store/adminAuth";
import { useAlerts } from "@/store/alerts";
import { useListSearch } from "@/store/listSearch";
import { DebouncedSearchInput } from "@/components/form/DebouncedSearchInput";
import { disablePush, enablePush, getPushState } from "@/lib/push";
import { cn } from "@/lib/cn";

/** Routes where TopBar search filters the current list. */
function searchConfigForPath(pathname: string): { placeholder: string } | null {
  if (pathname === "/products") {
    return { placeholder: "Search products by name, slug, or category…" };
  }
  if (pathname === "/customers") {
    return { placeholder: "Search customers by name, phone, or email…" };
  }
  if (pathname === "/orders") {
    return { placeholder: "Search order #, customer, phone, or product…" };
  }
  if (pathname === "/users") {
    return { placeholder: "Search staff by name or phone…" };
  }
  if (pathname === "/delivery") {
    return { placeholder: "Search pincode, city, or area…" };
  }
  return null;
}

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const user = useAdminAuth((s) => s.user);
  const logout = useAdminAuth((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const clearSearch = useListSearch((s) => s.clear);
  const setQuery = useListSearch((s) => s.setQuery);
  const searchConfig = searchConfigForPath(pathname);
  const soundEnabled = useAlerts((s) => s.soundEnabled);
  const setSoundEnabled = useAlerts((s) => s.setSoundEnabled);

  const initial = (user?.name ?? "?").charAt(0).toUpperCase();

  const [pushState, setPushState] = useState(() => getPushState());
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    setPushState(getPushState());
  }, []);

  // Reset shared query when leaving a searchable list (or switching lists).
  useEffect(() => {
    clearSearch();
  }, [pathname, clearSearch]);

  const togglePush = async () => {
    if (!pushState.supported || pushBusy) return;
    setPushBusy(true);
    try {
      const next = pushState.subscribed ? await disablePush() : await enablePush();
      setPushState(next);
    } finally {
      setPushBusy(false);
    }
  };

  const toggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
      // Grant browser permission the first time the user enables alerts, so
      // desktop OS notifications work even when the tab isn't focused.
      try {
        await Notification.requestPermission();
      } catch {
        // Ignore — some environments (embedded) throw here.
      }
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {searchConfig && (
        <DebouncedSearchInput
          key={pathname}
          className="min-w-0 max-w-md flex-1"
          placeholder={searchConfig.placeholder}
          onDebouncedChange={setQuery}
        />
      )}

      <div className="ml-auto flex items-center gap-2">
        {pushState.supported && (
          <button
            type="button"
            onClick={togglePush}
            disabled={pushBusy}
            className={cn(
              "rounded-md p-2 transition disabled:opacity-50",
              pushState.subscribed
                ? "text-brand-500 hover:bg-brand-100/60"
                : "text-slate-400 hover:bg-slate-100",
            )}
            aria-label={
              pushState.subscribed
                ? "Disable push notifications"
                : "Enable push notifications on this device"
            }
            title={
              pushState.subscribed
                ? "Push on this device — click to disable"
                : "Enable push on this device (works when the app is closed)"
            }
          >
            {pushState.subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </button>
        )}

        <button
          type="button"
          onClick={toggleSound}
          className={cn(
            "rounded-md p-2 transition",
            soundEnabled
              ? "text-slate-600 hover:bg-slate-100"
              : "text-slate-400 hover:bg-slate-100",
          )}
          aria-label={soundEnabled ? "Mute order alarm" : "Enable order alarm"}
          title={
            soundEnabled ? "Order alarm on — click to mute" : "Order alarm muted — click to enable"
          }
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>

        <Dropdown.Root>
          <Dropdown.Trigger asChild>
            <button
              type="button"
              className="hover:border-brand-300 flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pr-3 pl-1 text-sm text-slate-700 transition"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                {initial}
              </span>
              <span className="hidden max-w-[8rem] truncate sm:inline">
                {user?.name ?? "Sign in"}
              </span>
            </button>
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content
              align="end"
              sideOffset={6}
              className="z-40 min-w-[180px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
            >
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                <p className="truncate text-xs text-slate-500">{user?.phone}</p>
              </div>
              <Dropdown.Item asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <User className="h-4 w-4" /> Profile
                </button>
              </Dropdown.Item>
              <Dropdown.Item asChild>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate("/login", { replace: true });
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-brand-600 hover:bg-slate-100"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </div>
    </header>
  );
}
