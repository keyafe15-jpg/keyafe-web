import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PendingOrderAlert {
  id: string;
  orderNumber: string;
  customerName: string;
  total: string | number;
  source: "STOREFRONT" | "OFFLINE_LINK" | "OFFLINE_DIRECT";
  itemCount: number;
  createdAt: string;
  arrivedAt: number; // epoch ms — used for the auto-accept countdown
}

interface AlertsState {
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;

  // Non-persisted — starts empty on every reload.
  pending: PendingOrderAlert[];
  enqueue: (alert: PendingOrderAlert) => void;
  dequeue: (id: string) => void;
  clear: () => void;
}

// The mute preference persists across reloads; the pending queue does not.
export const useAlerts = create<AlertsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      setSoundEnabled: (v) => set({ soundEnabled: v }),

      pending: [],
      enqueue: (alert) =>
        set((s) =>
          s.pending.some((a) => a.id === alert.id)
            ? s
            : { pending: [...s.pending, alert] },
        ),
      dequeue: (id) =>
        set((s) => ({ pending: s.pending.filter((a) => a.id !== id) })),
      clear: () => set({ pending: [] }),
    }),
    {
      name: "keyafe-admin-alerts",
      partialize: (s) => ({ soundEnabled: s.soundEnabled }),
    },
  ),
);
