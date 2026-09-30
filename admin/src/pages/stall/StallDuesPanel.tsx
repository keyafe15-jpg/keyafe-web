import { useState } from "react";
import { Clock } from "lucide-react";
import { useSettleStallDue, useStallDues, type StallDue } from "@/hooks/useStalls";
import { formatDayShort } from "@/lib/dateRange";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/cn";
import { CollectDue } from "./stall-ui";

function dueSummary(due: StallDue) {
  if (due.kind === "CONSOLIDATED") return due.note ? `Lump sum · ${due.note}` : "Lump sum";
  return due.items.map((i) => `${i.qty}× ${i.name}`).join(", ");
}

/** Unpaid stall dues with "Mark paid"; renders nothing when there are none. */
export function StallDuesPanel({
  stallId,
  showStall,
  className,
}: {
  stallId?: string | null;
  showStall?: boolean;
  className?: string;
}) {
  const { data } = useStallDues(stallId);
  const settle = useSettleStallDue();
  const [error, setError] = useState<string | null>(null);

  if (!data || data.dues.length === 0) return null;

  const collect = (due: StallDue, via: "CASH" | "UPI") => {
    setError(null);
    settle.mutate(
      { saleId: due.id, paidVia: via },
      { onError: (err) => setError(err instanceof Error ? err.message : "Could not mark as paid") },
    );
  };

  return (
    <section
      className={cn("rounded-card border border-amber-200 bg-amber-50/40 px-4 py-3", className)}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <Clock className="h-4 w-4" />
        Unpaid dues
        <span className="ml-auto tabular-nums">
          {formatINR(data.total)}
          <span className="ml-1 font-normal text-amber-800">
            · {data.dues.length} entr{data.dues.length === 1 ? "y" : "ies"}
          </span>
        </span>
      </h2>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <ul className="mt-1 divide-y divide-amber-100">
        {data.dues.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{d.dueFrom ?? "Unnamed"}</p>
              <p className="truncate text-xs text-slate-500">
                {formatDayShort(d.date)}
                {showStall && ` · ${d.stall.name}`} · {dueSummary(d)}
              </p>
            </div>
            <span className="text-sm font-semibold text-amber-800 tabular-nums">
              {formatINR(d.amount)}
            </span>
            <CollectDue
              onCollect={(via) => collect(d, via)}
              busy={settle.isPending && settle.variables?.saleId === d.id}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
