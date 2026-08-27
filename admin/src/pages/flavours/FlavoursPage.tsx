import { useState } from "react";
import {
  useAdminFlavours,
  useUpdateFlavour,
  type AdminFlavour,
} from "@/hooks/useFlavours";
import { cn } from "@/lib/cn";

export function FlavoursPage() {
  const { data: flavours = [], isLoading } = useAdminFlavours();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Flavours</h1>
        <p className="mt-1 text-sm text-slate-500">
          Master flavour list. The{" "}
          <span className="font-medium">Additional amount</span> is added on top
          of the product base price (per pound) whenever a customer picks this
          flavour.
        </p>
      </div>

      <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        )}
        {!isLoading && flavours.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            No flavours yet.
          </div>
        )}
        {!isLoading && flavours.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Flavour</th>
                <th className="px-4 py-2 font-medium">Tags</th>
                <th className="w-40 px-4 py-2 text-right font-medium">
                  Additional (₹)
                </th>
                <th className="w-24 px-4 py-2 text-center font-medium">
                  Active
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flavours.map((f) => (
                <FlavourRow key={f.id} flavour={f} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FlavourRow({ flavour }: { flavour: AdminFlavour }) {
  const update = useUpdateFlavour();
  const [amount, setAmount] = useState<string>(
    Number(flavour.additionalAmount).toString(),
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commit = async () => {
    const parsed = Number(amount);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Enter a non-negative number");
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({ id: flavour.id, additionalAmount: parsed });
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{flavour.name}</p>
        <p className="text-xs text-slate-500">/{flavour.slug}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {flavour.isEggless && <Tag label="Eggless" tone="green" />}
          {flavour.isSugarFree && <Tag label="Sugar-free" tone="brand" />}
          {flavour.isHealthy && <Tag label="Healthy" tone="emerald" />}
        </div>
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              +₹
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setDirty(true);
              }}
              onBlur={() => dirty && commit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className={cn(
                "w-28 rounded-md border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-right text-sm tabular-nums text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                error && "border-brand-500",
              )}
            />
          </div>
          {update.isPending && (
            <span className="text-xs text-slate-400">…</span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-brand-700">{error}</p>}
      </td>
      <td className="px-4 py-3 text-center">
        <label className="inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={flavour.isActive}
            onChange={(e) =>
              update.mutate({ id: flavour.id, isActive: e.target.checked })
            }
            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
        </label>
      </td>
    </tr>
  );
}

function Tag({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "brand" | "emerald";
}) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700",
    brand: "bg-brand-100 text-brand-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        tones[tone],
      )}
    >
      {label}
    </span>
  );
}
