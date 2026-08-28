import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import { useAlerts, type PendingOrderAlert } from "@/store/alerts";
import { useUpdateOrder } from "@/hooks/useAdminOrders";
import { cn } from "@/lib/cn";

const AUTO_ACCEPT_MS = 30_000;

const sourceLabels: Record<PendingOrderAlert["source"], string> = {
  STOREFRONT: "Storefront",
  OFFLINE_LINK: "Link",
  OFFLINE_DIRECT: "Offline",
};

// Renders while there are unacknowledged new orders. Loops the alarm audio,
// counts down to auto-accept, and marks the order CONFIRMED on accept.
export function NewOrderAlertModal() {
  const pending = useAlerts((s) => s.pending);
  const dequeue = useAlerts((s) => s.dequeue);
  const soundEnabled = useAlerts((s) => s.soundEnabled);
  const navigate = useNavigate();
  const update = useUpdateOrder();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [accepting, setAccepting] = useState<string | null>(null);

  // Init audio once, in loop mode.
  useEffect(() => {
    if (!audioRef.current) {
      const a = new Audio("/alarm.m4a");
      a.loop = true;
      a.preload = "auto";
      audioRef.current = a;
    }
  }, []);

  // Tick every 250ms while the queue is non-empty so the countdown updates.
  useEffect(() => {
    if (pending.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [pending.length]);

  const head = pending[0];

  // Start / stop the looped audio based on queue + mute state.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (head && soundEnabled) {
      a.currentTime = 0;
      a.play().catch(() => {
        // Autoplay blocked until a user gesture — silent fallback.
      });
    } else {
      a.pause();
      a.currentTime = 0;
    }
  }, [head, soundEnabled]);

  const accept = async (alert: PendingOrderAlert, auto: boolean) => {
    if (accepting === alert.id) return;
    setAccepting(alert.id);
    try {
      await update.mutateAsync({ id: alert.id, status: "CONFIRMED" });
    } catch {
      // Even if the API call fails, remove from queue so the alarm stops;
      // admin can retry via the orders list.
    } finally {
      dequeue(alert.id);
      setAccepting(null);
      if (!auto) navigate(`/orders/${alert.orderNumber}`);
    }
  };

  // Fire the auto-accept when the head's countdown hits zero.
  useEffect(() => {
    if (!head) return;
    const elapsed = now - head.arrivedAt;
    if (elapsed >= AUTO_ACCEPT_MS) {
      void accept(head, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head?.id, now >= (head?.arrivedAt ?? 0) + AUTO_ACCEPT_MS]);

  if (!head) return null;

  const elapsed = now - head.arrivedAt;
  const remainingMs = Math.max(0, AUTO_ACCEPT_MS - elapsed);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const pct = Math.min(100, (elapsed / AUTO_ACCEPT_MS) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-card border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 rounded-t-card bg-brand-500 px-5 py-3 text-white">
          <Bell className="h-5 w-5 animate-pulse" />
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide opacity-80">
              New order
            </p>
            <p className="font-mono text-sm font-semibold">
              {head.orderNumber}
            </p>
          </div>
          {pending.length > 1 && (
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold">
              +{pending.length - 1} more
            </span>
          )}
        </div>

        <div className="space-y-3 p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Customer
            </p>
            <p className="text-lg font-medium text-slate-900">
              {head.customerName}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Items
              </p>
              <p className="font-medium text-slate-900">
                {head.itemCount} item{head.itemCount === 1 ? "" : "s"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Total
              </p>
              <p className="font-medium text-slate-900">
                ₹{Number(head.total).toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Source
              </p>
              <p className="font-medium text-slate-900">
                {sourceLabels[head.source]}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Auto-confirm in {remainingSec}s</span>
              <span>Accept to stop the alarm</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-full transition-[width]",
                  remainingSec <= 5 ? "bg-red-500" : "bg-brand-500",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => accept(head, false)}
            disabled={accepting === head.id}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <Check className="h-5 w-5" />
            {accepting === head.id ? "Accepting…" : "Accept & confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
