import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, Printer } from "lucide-react";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/form/Field";
import { useStaffPermission } from "@/lib/permissions";
import {
  useAdminRecipe,
  useArchiveRecipe,
  useCloneRecipeVersion,
  usePrintRecipes,
  useSetCurrentRecipeVersion,
} from "@/hooks/useAdminRecipes";
import { formatRecipeQty, formatRecipeQtyCell, scaleQty } from "@/pages/recipes/recipe-ui";

const PRESETS = [
  { label: "½", factor: 0.5 },
  { label: "1×", factor: 1 },
  { label: "2×", factor: 2 },
] as const;

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canWrite = useStaffPermission("recipes.write");
  const recipe = useAdminRecipe(id);
  const clone = useCloneRecipeVersion();
  const setCurrent = useSetCurrentRecipeVersion();
  const archive = useArchiveRecipe();
  const print = usePrintRecipes();
  const [versionId, setVersionId] = useState<string | null>(null);
  const [factor, setFactor] = useState(1);
  const [custom, setCustom] = useState("1");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (recipe.data?.currentVersionId) setVersionId(recipe.data.currentVersionId);
  }, [recipe.data?.currentVersionId]);

  if (recipe.isLoading) return <p className="text-sm text-slate-500">Loading recipe…</p>;
  if (recipe.isError || !recipe.data) {
    return (
      <div>
        <Link to="/recipes" className="text-xs text-slate-500 hover:text-brand-500">
          All recipes
        </Link>
        <p className="mt-3 text-sm text-red-700">Recipe not found.</p>
      </div>
    );
  }

  const row = recipe.data;
  const versions = row.versions;
  const viewing = versions.find((v) => v.id === versionId) ?? row.currentVersion;
  if (!viewing) {
    return <p className="text-sm text-slate-500">This recipe has no version yet.</p>;
  }
  const isCurrent = viewing.id === row.currentVersionId;
  const scale = factor > 0 ? factor : 1;

  return (
    <div>
      <Link
        to="/recipes"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-500"
      >
        <ArrowLeft className="h-3 w-3" /> All recipes
      </Link>

      <div className="mt-3 mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{row.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {row.category.name}
            {viewing.yieldQty != null && viewing.yieldUnit
              ? ` · batch ${formatRecipeQty(scaleQty(viewing.yieldQty, scale), viewing.yieldUnit)}`
              : ""}
            {viewing.yieldNote ? ` · ${viewing.yieldNote}` : ""}
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            {isCurrent && (
              <Link
                to={`/recipes/${row.id}/edit`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit
              </Link>
            )}
            {isCurrent && (
              <button
                type="button"
                disabled={clone.isPending}
                onClick={() => {
                  setError(null);
                  clone.mutate(
                    { id: row.id },
                    {
                      onError: (err) =>
                        setError(err instanceof Error ? err.message : "Could not clone"),
                    },
                  );
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {clone.isPending ? "Copying…" : "New version"}
              </button>
            )}
            {!isCurrent && (
              <button
                type="button"
                disabled={setCurrent.isPending}
                onClick={() => {
                  setError(null);
                  setCurrent.mutate(
                    { id: row.id, versionId: viewing.id },
                    {
                      onError: (err) =>
                        setError(err instanceof Error ? err.message : "Could not switch"),
                    },
                  );
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Make current
              </button>
            )}
            <button
              type="button"
              disabled={print.isPending}
              onClick={() => {
                setError(null);
                print.mutate(
                  { versionIds: [viewing.id] },
                  {
                    onError: (err) =>
                      setError(err instanceof Error ? err.message : "Could not print"),
                  },
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              {print.isPending ? "Printing…" : "Print this version"}
            </button>
          </div>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {versions.map((v) => {
          const active = v.id === viewing.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setVersionId(v.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                active
                  ? "bg-brand-50 border-brand-500 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {v.label}
              {v.id === row.currentVersionId ? " · current" : ""}
              {v.printedAt ? " · Printed" : ""}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <p className="mr-1 text-xs font-medium tracking-wide text-slate-500 uppercase">Scale</p>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setFactor(p.factor);
              setCustom(String(p.factor));
            }}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition",
              factor === p.factor
                ? "bg-brand-50 border-brand-500 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {p.label}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          Custom
          <input
            inputMode="decimal"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              const n = Number(e.target.value);
              if (n > 0) setFactor(n);
            }}
            className={cn(inputClass, "h-8 w-16 py-1")}
          />
        </label>
        <p className="text-xs text-slate-400">On screen only — the saved recipe stays 1×.</p>
      </div>

      <div className="space-y-4 rounded-card border border-slate-200 bg-white p-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Ingredients</p>
          {(viewing.sizes?.length ?? 0) >= 2 ? (
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="py-1 pr-3 font-medium">Ingredient</th>
                  {viewing.sizes.map((s) => (
                    <th key={s.id ?? s.label} className="py-1 pr-3 text-right font-medium">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewing.ingredients.map((line) => (
                  <tr key={line.id ?? `${line.name}-${line.qty}`}>
                    <td className="py-1.5 pr-3">
                      {line.componentRecipeId && line.componentRecipe ? (
                        <Link
                          to={`/recipes/${line.componentRecipeId}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {line.componentRecipe.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-900">{line.name}</span>
                      )}
                      {line.componentRecipeId ? (
                        <span className="ml-1.5 text-[10px] tracking-wide text-slate-400 uppercase">
                          Recipe
                        </span>
                      ) : null}
                      {line.note ? <span className="ml-1 text-slate-500">· {line.note}</span> : null}
                      {line.componentRecipeId ? (
                        <NestedRecipeIngredients recipeId={line.componentRecipeId} />
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">
                      {formatRecipeQtyCell(line.qty, line.unit, scale)}
                    </td>
                    {viewing.sizes.slice(1).map((s, i) => (
                      <td
                        key={s.id ?? s.label}
                        className="py-1.5 pr-3 text-right tabular-nums text-slate-700"
                      >
                        {formatRecipeQtyCell(line.extraQtys?.[i], line.unit, scale)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {viewing.ingredients.map((line) => (
                <li key={line.id ?? `${line.name}-${line.qty}`} className="py-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="min-w-0">
                      {line.componentRecipeId && line.componentRecipe ? (
                        <Link
                          to={`/recipes/${line.componentRecipeId}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {line.componentRecipe.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-900">{line.name}</span>
                      )}
                      {line.componentRecipeId ? (
                        <span className="ml-1.5 text-[10px] tracking-wide text-slate-400 uppercase">
                          Recipe
                        </span>
                      ) : null}
                      {line.note ? <span className="ml-1 text-slate-500">· {line.note}</span> : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-700">
                      {formatRecipeQty(scaleQty(line.qty, scale), line.unit)}
                    </span>
                  </div>
                  {line.componentRecipeId ? (
                    <NestedRecipeIngredients recipeId={line.componentRecipeId} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {viewing.usage.length > 0 && (
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Portions</p>
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="py-1 pr-3 font-medium">Size / pack</th>
                  <th className="py-1 pr-3 font-medium">Style</th>
                  <th className="py-1 text-right font-medium">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewing.usage.map((u) => (
                  <tr key={u.id ?? `${u.axis1}-${u.axis2}`}>
                    <td className="py-1.5 pr-3 text-slate-900">{u.axis1}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{u.axis2 ?? "—"}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-700">
                      {formatRecipeQty(scaleQty(u.qty, scale), u.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {viewing.steps.length > 0 && (
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Process</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-800">
              {viewing.steps.map((s) => (
                <li key={s.id ?? s.text}>{s.text}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {canWrite && (
        <button
          type="button"
          disabled={archive.isPending}
          onClick={() => {
            if (!window.confirm(`Archive “${row.name}”? It leaves the kitchen list.`)) return;
            setError(null);
            archive.mutate(row.id, {
              onSuccess: () => navigate("/recipes"),
              onError: (err) => setError(err instanceof Error ? err.message : "Could not archive"),
            });
          }}
          className="mt-4 text-xs text-slate-400 hover:text-red-700"
        >
          Archive recipe
        </button>
      )}
    </div>
  );
}

function NestedRecipeIngredients({ recipeId }: { recipeId: string }) {
  const [open, setOpen] = useState(false);
  const nested = useAdminRecipe(open ? recipeId : undefined);
  const nestedVersion = nested.data?.currentVersion;
  const ingredients = nestedVersion?.ingredients ?? [];
  const nestedSizes = nestedVersion?.sizes ?? [];

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-500 hover:text-brand-700"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open ? "Hide ingredients" : "Show ingredients"}
      </button>
      {open && (
        <div className="mt-1 ml-4">
          {nested.isLoading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : nested.isError ? (
            <p className="text-xs text-red-700">Could not load that recipe.</p>
          ) : ingredients.length === 0 ? (
            <p className="text-xs text-slate-400">No ingredients saved.</p>
          ) : (
            nestedSizes.length >= 2 ? (
              <table className="w-full text-left text-xs text-slate-600">
                <thead>
                  <tr className="text-[10px] tracking-wide text-slate-400 uppercase">
                    <th className="py-0.5 pr-2 font-medium">Ingredient</th>
                    {nestedSizes.map((s) => (
                      <th key={s.id ?? s.label} className="py-0.5 text-right font-medium">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing) => (
                    <tr key={ing.id ?? `${ing.name}-${ing.qty}`}>
                      <td className="py-0.5 pr-2">{ing.componentRecipe?.name ?? ing.name}</td>
                      <td className="py-0.5 text-right tabular-nums">
                        {formatRecipeQtyCell(ing.qty, ing.unit)}
                      </td>
                      {nestedSizes.slice(1).map((s, i) => (
                        <td key={s.id ?? s.label} className="py-0.5 text-right tabular-nums">
                          {formatRecipeQtyCell(ing.extraQtys?.[i], ing.unit)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
            <ul className="space-y-0.5 text-xs text-slate-600">
              {ingredients.map((ing) => (
                <li
                  key={ing.id ?? `${ing.name}-${ing.qty}`}
                  className="flex justify-between gap-3"
                >
                  <span className="min-w-0">
                    {ing.componentRecipe?.name ?? ing.name}
                    {ing.componentRecipeId ? (
                      <span className="ml-1 tracking-wide text-slate-400 uppercase">Recipe</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatRecipeQty(ing.qty, ing.unit)}
                  </span>
                </li>
              ))}
            </ul>
            )
          )}
        </div>
      )}
    </div>
  );
}
