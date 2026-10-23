import { useState } from "react";
import { Field, inputClass, selectClass } from "@/components/form/Field";
import { useUpdateOrder, type AdminOrder } from "@/hooks/useAdminOrders";
import {
  DISCOUNT_REASONS,
  discountReasonLabel,
  inr,
  type DiscountReason,
} from "@/pages/expenses/books-ui";

export function OrderBooksFields({
  order,
  canUpdate,
}: {
  order: AdminOrder;
  canUpdate: boolean;
}) {
  const update = useUpdateOrder();
  const [cost, setCost] = useState(order.deliveryCost ?? "");
  const [reason, setReason] = useState<DiscountReason | "">(order.discountReason ?? "");
  const [note, setNote] = useState(order.discountNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const fee = Number(order.deliveryFee);
  const costNum = cost === "" ? null : Number(cost);
  const subsidy =
    costNum !== null && Number.isFinite(costNum) ? Math.max(0, costNum - fee) : 0;

  const save = (patch: {
    deliveryCost?: number | null;
    discountReason?: DiscountReason | null;
    discountNote?: string | null;
  }) => {
    setError(null);
    update.mutate(
      { id: order.id, ...patch },
      {
        onError: (err) => setError(err instanceof Error ? err.message : "Could not save"),
      },
    );
  };

  return (
    <div className="mt-3 space-y-2 border-t border-dashed border-slate-200 pt-3">
      <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
        Delivery subsidy & discount reason
      </p>
      <p className="text-[11px] text-slate-500">
        Rider took vs what we charged. Do not also log the gap as a delivery expense.
      </p>
      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
        <Field label="Rider actually took">
          <input
            inputMode="decimal"
            value={cost}
            disabled={!canUpdate}
            onChange={(e) => setCost(e.target.value)}
            onBlur={() => {
              const next = cost.trim() === "" ? null : Number(cost);
              if (next !== null && !Number.isFinite(next)) return;
              const current = order.deliveryCost == null ? null : Number(order.deliveryCost);
              if (next === current) return;
              save({ deliveryCost: next });
            }}
            className={inputClass}
            placeholder="e.g. 200"
          />
        </Field>
        <Field label="Subsidy (auto)">
          <p className="py-2 text-sm tabular-nums text-slate-800">
            {costNum === null ? "—" : subsidy > 0 ? inr(subsidy) : "None"}
          </p>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
          <Field label="Discount reason">
            <select
              value={reason}
              disabled={!canUpdate}
              className={selectClass}
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
          </Field>
          {reason === "OTHER" && (
            <Field label="Reason note" required>
              <input
                value={note}
                disabled={!canUpdate}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => {
                  if (!note.trim()) {
                    setError("Add a note when the reason is other.");
                    return;
                  }
                  save({ discountReason: "OTHER", discountNote: note.trim() });
                }}
                className={inputClass}
              />
            </Field>
          )}
        </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
