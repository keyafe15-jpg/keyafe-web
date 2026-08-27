import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine } from "@/types/domain";

interface CartState {
  lines: CartLine[];
  addLine: (line: Omit<CartLine, "id">) => string;
  updateQty: (id: string, qty: number) => void;
  removeLine: (id: string) => void;
  clear: () => void;
  subtotal: () => number;
  itemCount: () => number;
}

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      addLine: (line) => {
        const id = genId();
        set((s) => ({ lines: [...s.lines, { ...line, id }] }));
        return id;
      },
      updateQty: (id, qty) =>
        set((s) => ({
          lines: s.lines.map((l) =>
            l.id === id ? { ...l, qty: Math.max(1, qty) } : l,
          ),
        })),
      removeLine: (id) =>
        set((s) => ({ lines: s.lines.filter((l) => l.id !== id) })),
      clear: () => set({ lines: [] }),
      subtotal: () =>
        get().lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
      itemCount: () => get().lines.reduce((sum, l) => sum + l.qty, 0),
    }),
    { name: "keyafe-cart", version: 2 },
  ),
);
