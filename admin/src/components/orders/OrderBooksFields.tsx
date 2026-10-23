import { useState } from "react";
import { cn } from "@/lib/cn";
import { inputClass, selectClass } from "@/components/form/Field";
import { useUpdateOrder, type AdminOrder } from "@/hooks/useAdminOrders";
import {
  DISCOUNT_REASONS,
  discountReasonLabel,
  type DiscountReason,
} from "@/pages/expenses/books-ui";

function useOrderBooksSave(orderId: string) {
  const update = useUpdateOrder();
  const [error, setError] = useState<string | null>(null);
  const save = (patch: {
    deliveryCost?: number | null;
    discountReason?: DiscountReason | null;
    discountNote?: string | null;
  }) => {
    setError(null);
    update.mutate(
      { id: orderId, ...patch },
      {
        onError: (err) => setError(err instanceof Error ? err.message : "Could not save"),
      },
    );
  };
  return { save, error, setError };
}

/** One totals-style row: what we paid the rider. */
export function OrderDeliveryCostRow({
  order,
  canUpdate,
}: {
  order: AdminOrder;
  canUpdate: boolean;
}) {
  const { save, error } = useOrderBooksSave(order.id);
  const [cost, setCost] = useState(
    order.deliveryCost != null && Number(order.deliveryCost) > 0
      ? String(Number(order.deliveryCost))
      : "",
  );
  const extra = order.deliveryPaidToRider;

  return (
    <div className="flex items-center justify-between gap-3 pt-0.5">
      <span className="text-slate-700">{extra ? "Extra we paid" : "We paid the rider"}</span>
      <div className="text-right">
        <input
          inputMode="decimal"
          value={cost}
          disabled={!canUpdate}
          aria-label={extra ? "Extra we paid for delivery" : "What we paid the rider"}
          onChange={(e) => setCost(e.target.value)}
          onBlur={() => {
            const next = cost.trim() === "" ? null : Number(cost);
            if (next !== null && !Number.isFinite(next)) return;
            const current =
              order.deliveryCost == null || Number(order.deliveryCost) === 0
                ? null
                : Number(order.deliveryCost);
            if (next === current || (next === 0 && current === null)) return;
            save({ deliveryCost: next === 0 ? null : next });
          }}
          placeholder="0"
          className={cn(
            inputClass,
            "h-8 w-[6.5rem] px-2 py-1 text-right text-sm tabular-nums",
          )}
        />
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      </div>
    </div>
  );
}

export function OrderDiscountReasonRow({
  order,
  canUpdate,
}: {
  order: AdminOrder;
  canUpdate: boolean;
}) {
  const hasDiscount = Number(order.discount) > 0 || Boolean(order.discountReason);
  const { save, error, setError } = useOrderBooksSave(order.id);
  const [reason, setReason] = useState<DiscountReason | "">(order.discountReason ?? "");
  const [note, setNote] = useState(order.discountNote ?? "");

  if (!hasDiscount) return null;

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">Discount reason</span>
        <select
          value={reason}
          disabled={!canUpdate}
          aria-label="Discount reason"
          className={cn(selectClass, "h-8 w-[12rem] px-2 py-1 text-xs")}
          onChange={(e) => {
            const next = e.target.value as DiscountReason | "";
            setReason(next);
            if (next && next !== "OTHER") {
              save({ discountReason: next, discountNote: note.trim() || null });
            } else if (!next) {
              save({ discountReason: null, discountNote: null });
            }
          }}
        >
          <option value="">Not set</option>
          {DISCOUNT_REASONS.map((r) => (
            <option key={r} value={r}>
              {discountReasonLabel(r)}
            </option>
          ))}
        </select>
      </div>
      {reason === "OTHER" && (
        <input
          value={note}
          disabled={!canUpdate}
          placeholder="Why"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (!note.trim()) {
              setError("Add a note when the reason is other.");
              return;
            }
            save({ discountReason: "OTHER", discountNote: note.trim() });
          }}
          className={cn(inputClass, "mt-1 h-8 px-2 py-1 text-xs")}
        />
      )}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
