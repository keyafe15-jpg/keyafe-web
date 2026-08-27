import { useState } from "react";
import { Plus } from "lucide-react";
import {
  useAdminToppings,
  useCreateTopping,
  useUpdateTopping,
  type AdminTopping,
  type ToppingKind,
} from "@/hooks/useToppings";
import { cn } from "@/lib/cn";
import {
  Field,
  inputClass,
  selectClass,
  submitClass,
} from "@/components/form/Field";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function ToppingsPage() {
  const { data: toppings = [], isLoading } = useAdminToppings();
  const [tab, setTab] = useState<ToppingKind>("TOPPING");
  const filtered = toppings.filter((t) => t.kind === tab);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Toppings & condiments
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Master list for pizzas and similar products. Price delta is added to
          the item price when a customer picks the option.
        </p>
      </div>

      <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        <TabButton active={tab === "TOPPING"} onClick={() => setTab("TOPPING")}>
          Toppings ({toppings.filter((t) => t.kind === "TOPPING").length})
        </TabButton>
        <TabButton
          active={tab === "CONDIMENT"}
          onClick={() => setTab("CONDIMENT")}
        >
          Condiments ({toppings.filter((t) => t.kind === "CONDIMENT").length})
        </TabButton>
      </div>

      <NewToppingRow kind={tab} />

      <div className="mt-4 overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            No {tab === "TOPPING" ? "toppings" : "condiments"} yet.
          </div>
        )}
        {!isLoading && filtered.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="w-32 px-4 py-2 text-right font-medium">
                  Price (₹)
                </th>
                <th className="w-24 px-4 py-2 text-center font-medium">Veg</th>
                <th className="w-24 px-4 py-2 text-center font-medium">
                  Active
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <ToppingRow key={t.id} topping={t} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function NewToppingRow({ kind }: { kind: ToppingKind }) {
  const create = useCreateTopping();
  const [name, setName] = useState("");
  const [priceDelta, setPriceDelta] = useState("0");
  const [isVeg, setIsVeg] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0;

  const submit = async () => {
    setError(null);
    try {
      await create.mutateAsync({
        name: name.trim(),
        slug: slugify(name),
        kind,
        priceDelta: Number(priceDelta) || 0,
        isVeg,
      });
      setName("");
      setPriceDelta("0");
      setIsVeg(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  return (
    <div className="rounded-card border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto_auto]">
        <Field label={`New ${kind === "TOPPING" ? "topping" : "condiment"}`}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "TOPPING" ? "Olives" : "Hot honey"}
            className={inputClass}
          />
        </Field>
        <Field label="Price (₹)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={priceDelta}
            onChange={(e) => setPriceDelta(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Type">
          <select
            value={isVeg ? "veg" : "nonveg"}
            onChange={(e) => setIsVeg(e.target.value === "veg")}
            className={selectClass}
          >
            <option value="veg">Veg</option>
            <option value="nonveg">Non-veg</option>
          </select>
        </Field>
        <div className="self-end">
          <button
            type="button"
            disabled={!canSubmit || create.isPending}
            onClick={submit}
            className={cn(submitClass, "inline-flex items-center gap-1")}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function ToppingRow({ topping }: { topping: AdminTopping }) {
  const update = useUpdateTopping();
  const [amount, setAmount] = useState<string>(
    Number(topping.priceDelta).toString(),
  );
  const [dirty, setDirty] = useState(false);

  const commit = async () => {
    const parsed = Number(amount);
    if (Number.isNaN(parsed) || parsed < 0) return;
    await update.mutateAsync({ id: topping.id, priceDelta: parsed });
    setDirty(false);
  };

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{topping.name}</p>
        <p className="text-xs text-slate-500">/{topping.slug}</p>
      </td>
      <td className="px-4 py-2 text-right">
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
          className="w-24 rounded-md border border-slate-200 bg-white py-1.5 px-2 text-right text-sm tabular-nums text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </td>
      <td className="px-4 py-3 text-center">
        <label className="inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={topping.isVeg}
            onChange={(e) =>
              update.mutate({ id: topping.id, isVeg: e.target.checked })
            }
            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
        </label>
      </td>
      <td className="px-4 py-3 text-center">
        <label className="inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={topping.isActive}
            onChange={(e) =>
              update.mutate({ id: topping.id, isActive: e.target.checked })
            }
            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
        </label>
      </td>
    </tr>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition",
        active
          ? "bg-brand-500 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100",
      )}
    >
      {children}
    </button>
  );
}
