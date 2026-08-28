import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  LogOut,
  User,
} from "lucide-react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useAdminAuth } from "@/store/adminAuth";
import { useAlerts } from "@/store/alerts";
import { disablePush, enablePush, getPushState } from "@/lib/push";
import { cn } from "@/lib/cn";

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const user = useAdminAuth((s) => s.user);
  const logout = useAdminAuth((s) => s.logout);
  const navigate = useNavigate();
  const soundEnabled = useAlerts((s) => s.soundEnabled);
  const setSoundEnabled = useAlerts((s) => s.setSoundEnabled);

  const initial = (user?.name ?? "?").charAt(0).toUpperCase();

  const [pushState, setPushState] = useState(() => getPushState());
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    setPushState(getPushState());
  }, []);

  const togglePush = async () => {
    if (!pushState.supported || pushBusy) return;
    setPushBusy(true);
    try {
      const next = pushState.subscribed
        ? await disablePush()
        : await enablePush();
      setPushState(next);
    } finally {
      setPushBusy(false);
    }
  };

  const toggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (
      next &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
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

      <div className="relative hidden max-w-sm flex-1 md:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Search orders, products, customers…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

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
            {pushState.subscribed ? (
              <Bell className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
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
            soundEnabled
              ? "Order alarm on — click to mute"
              : "Order alarm muted — click to enable"
          }
        >
          {soundEnabled ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </button>

        <Dropdown.Root>
          <Dropdown.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-sm text-slate-700 transition hover:border-brand-300"
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
                <p className="text-sm font-medium text-slate-900">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
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
