import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { Field, inputClass, selectClass } from "@/components/form/Field";
import { useStaffPermission } from "@/lib/permissions";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import { useAdminBuyItems } from "@/hooks/useAdminBooks";
import {
  useAdminRecipe,
  useAdminRecipes,
  useCreateRecipe,
  useUpdateRecipe,
  type RecipeDraft,
  type RecipeWritePayload,
} from "@/hooks/useAdminRecipes";
import {
  RECIPE_UNITS,
  kitchenItemLabel,
  kitchenQtyLabel,
  parseRecipeQty,
  type RecipeUnit,
  unitFromQtyText,
  unitLabel,
} from "@/pages/recipes/recipe-ui";
import { SearchCreate } from "@/pages/expenses/SearchCreate";
import { ScanRecipeBlock } from "@/pages/recipes/ScanRecipeBlock";

type DraftLine = {
  key: string;
  name: string;
  qty: string;
  extraQtys: string[];
  unit: RecipeUnit;
  note: string;
  buyItemId?: string;
  catalogName?: string;
  componentRecipeId?: string;
};

type DraftSize = { key: string; label: string };
type DraftUsage = { key: string; axis1: string; axis2: string; qty: string; unit: RecipeUnit };
type DraftStep = { key: string; text: string };

function emptyLine(extraCount = 0): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    name: "",
    qty: "",
    extraQtys: Array.from({ length: extraCount }, () => ""),
    unit: "G",
    note: "",
  };
}

function qtyText(n: number | null | undefined) {
  return n != null && n > 0 ? kitchenQtyLabel(n) : "";
}
function emptyUsage(): DraftUsage {
  return { key: Math.random().toString(36).slice(2), axis1: "", axis2: "", qty: "", unit: "G" };
}
function emptyStep(): DraftStep {
  return { key: Math.random().toString(36).slice(2), text: "" };
}

export function RecipeFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const existing = useAdminRecipe(isNew ? undefined : id);

  if (!isNew && existing.isLoading) {
    return <p className="text-sm text-slate-500">Loading recipe…</p>;
  }
  if (!isNew && existing.isError) {
    return <p className="text-sm text-red-700">Recipe not found.</p>;
  }

  const cur = existing.data?.currentVersion;
  return (
    <RecipeForm
      key={existing.data?.id ?? "new"}
      recipeId={existing.data?.id}
      initial={{
        name: existing.data?.name ?? "",
        categoryId: existing.data?.categoryId ?? "",
        yieldQty: cur?.yieldQty != null ? kitchenQtyLabel(cur.yieldQty) : "",
        yieldUnit: cur?.yieldUnit ?? "KG",
        yieldNote: cur?.yieldNote ?? "",
        sizes:
          (cur?.sizes?.length ?? 0) >= 2
            ? cur!.sizes.map((s) => ({
                key: s.id ?? Math.random().toString(36).slice(2),
                label: s.label,
              }))
            : [],
        lines: cur?.ingredients.length
          ? cur.ingredients.map((l) => ({
              key: l.id ?? Math.random().toString(36).slice(2),
              name: l.name,
              qty: qtyText(l.qty),
              extraQtys:
                (cur.sizes?.length ?? 0) >= 2
                  ? Array.from({ length: cur.sizes.length - 1 }, (_, i) => qtyText(l.extraQtys?.[i]))
                  : [],
              unit: l.unit,
              note: l.note ?? "",
              buyItemId: l.buyItemId ?? undefined,
              catalogName: l.buyItem?.name,
              componentRecipeId: l.componentRecipeId ?? undefined,
            }))
          : [emptyLine()],
        steps: cur?.steps.length
          ? cur.steps.map((s) => ({
              key: s.id ?? Math.random().toString(36).slice(2),
              text: s.text,
            }))
          : [emptyStep()],
        usage: cur?.usage.length
          ? cur.usage.map((u) => ({
              key: u.id ?? Math.random().toString(36).slice(2),
              axis1: u.axis1,
              axis2: u.axis2 ?? "",
              qty: kitchenQtyLabel(u.qty),
              unit: u.unit,
            }))
          : [],
      }}
    />
  );
}

function RecipeForm({
  recipeId,
  initial,
}: {
  recipeId?: string;
  initial: {
    name: string;
    categoryId: string;
    yieldQty: string;
    yieldUnit: RecipeUnit;
    yieldNote: string;
    sizes: DraftSize[];
    lines: DraftLine[];
    steps: DraftStep[];
    usage: DraftUsage[];
  };
}) {
  const navigate = useNavigate();
  const canWrite = useStaffPermission("recipes.write");
  const create = useCreateRecipe();
  const update = useUpdateRecipe();
  const categories = useAdminCategories();
  const [pickerSearch, setPickerSearch] = useState("");
  const items = useAdminBuyItems({ pageSize: 80 });
  const recipes = useAdminRecipes({
    search: pickerSearch.trim().length >= 2 ? pickerSearch.trim() : null,
    pageSize: 20,
  });
  const [name, setName] = useState(initial.name);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [yieldQty, setYieldQty] = useState(initial.yieldQty);
  const [yieldUnit, setYieldUnit] = useState<RecipeUnit>(initial.yieldUnit);
  const [yieldNote, setYieldNote] = useState(initial.yieldNote);
  const [sizes, setSizes] = useState(initial.sizes);
  const [lines, setLines] = useState(initial.lines);
  const [steps, setSteps] = useState(initial.steps);
  const [usage, setUsage] = useState(initial.usage);
  const [lineQueries, setLineQueries] = useState<Record<string, string>>({});
  const [pickedRecipes, setPickedRecipes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initial.lines
        .filter((l) => l.componentRecipeId)
        .map((l) => [l.componentRecipeId!, l.name]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

  const linkLine = (
    name: string,
  ): Pick<DraftLine, "name" | "buyItemId" | "catalogName" | "componentRecipeId"> => {
    const n = norm(name);
    if (n.length < 2) return { name };
    const recipe = (recipes.data?.items ?? []).find(
      (r) => r.id !== recipeId && (norm(r.name) === n || (n.length >= 4 && norm(r.name).includes(n))),
    );
    if (recipe) return { name: recipe.name, componentRecipeId: recipe.id };
    const item = (items.data?.items ?? []).find((it) => {
      const names = [it.name, it.alias].filter((s): s is string => Boolean(s?.trim()));
      return names.some((nm) => {
        const m = norm(nm);
        return m === n || (n.length >= 4 && (m.includes(n) || n.includes(m)));
      });
    });
    if (item) {
      return { name: kitchenItemLabel(item), buyItemId: item.id, catalogName: item.name };
    }
    return { name };
  };

  const toDraftLines = (rows: RecipeDraft["ingredients"]): DraftLine[] =>
    rows.map((l) => {
      const linked = l.buyItemId || l.componentRecipeId ? null : linkLine(l.name);
      return {
        key: Math.random().toString(36).slice(2),
        name: linked?.name ?? l.name,
        qty: qtyText(l.qty),
        extraQtys: Array.from({ length: Math.max(0, sizes.length - 1) }, () => ""),
        unit: l.unit,
        note: l.note ?? "",
        buyItemId: l.buyItemId ?? linked?.buyItemId,
        catalogName: linked?.catalogName ?? l.buyItem?.name,
        componentRecipeId: l.componentRecipeId ?? linked?.componentRecipeId,
      };
    });

  const rememberNested = (rows: DraftLine[]) => {
    setPickedRecipes((prev) => {
      const extra = Object.fromEntries(
        rows.filter((l) => l.componentRecipeId).map((l) => [l.componentRecipeId!, l.name]),
      );
      return Object.keys(extra).length ? { ...prev, ...extra } : prev;
    });
  };

  const applyDraft = (draft: RecipeDraft) => {
    if (draft.name) setName(draft.name);
    if (draft.categoryId) setCategoryId(draft.categoryId);
    if (draft.yieldQty != null) setYieldQty(String(draft.yieldQty));
    if (draft.yieldUnit) setYieldUnit(draft.yieldUnit);
    if (draft.yieldNote) setYieldNote(draft.yieldNote);
    if (draft.ingredients.length) {
      const next = toDraftLines(draft.ingredients);
      setLines(next);
      setLineQueries(Object.fromEntries(next.map((l) => [l.key, l.name])));
      rememberNested(next);
    }
    if (draft.usage.length) {
      setUsage(
        draft.usage.map((u) => ({
          key: Math.random().toString(36).slice(2),
          axis1: u.axis1,
          axis2: u.axis2 ?? "",
          qty: kitchenQtyLabel(u.qty),
          unit: u.unit,
        })),
      );
    }
    if (draft.steps.length) {
      setSteps(draft.steps.map((text) => ({ key: Math.random().toString(36).slice(2), text })));
    }
    setScanNote(
      draft.uncertain
        ? "Some lines were unclear — check qty and names, then save."
        : "Check the lines, then save.",
    );
  };

  const insertPastedLines = (rows: RecipeDraft["ingredients"]) => {
    const next = toDraftLines(rows);
    setLines((prev) => {
      const kept = prev.filter(
        (l) => l.name.trim() || l.qty.trim() || l.buyItemId || l.componentRecipeId,
      );
      return kept.length ? [...kept, ...next] : next;
    });
    setLineQueries((prev) => ({
      ...prev,
      ...Object.fromEntries(next.map((l) => [l.key, l.name])),
    }));
    rememberNested(next);
    setScanNote(`Inserted ${next.length} ingredient${next.length === 1 ? "" : "s"}. Check qty and names, then save.`);
  };

  const setLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const extraCount = Math.max(0, sizes.length - 1);
  const multi = sizes.length >= 2;

  const addSize = () => {
    if (sizes.length >= 4) return;
    if (sizes.length === 0) {
      setSizes([
        { key: Math.random().toString(36).slice(2), label: "Regular" },
        { key: Math.random().toString(36).slice(2), label: "Small" },
      ]);
      setLines((prev) => prev.map((l) => ({ ...l, extraQtys: [""] })));
      return;
    }
    setSizes((prev) => [...prev, { key: Math.random().toString(36).slice(2), label: "" }]);
    setLines((prev) => prev.map((l) => ({ ...l, extraQtys: [...l.extraQtys, ""] })));
  };

  const removeSize = (index: number) => {
    if (sizes.length <= 2) {
      if (index === 0) {
        setLines((prev) => prev.map((l) => ({ ...l, qty: l.extraQtys[0] ?? "", extraQtys: [] })));
      } else {
        setLines((prev) => prev.map((l) => ({ ...l, extraQtys: [] })));
      }
      setSizes([]);
      return;
    }
    setSizes((prev) => prev.filter((_, i) => i !== index));
    setLines((prev) =>
      prev.map((l) => {
        if (index === 0) {
          return { ...l, qty: l.extraQtys[0] ?? "", extraQtys: l.extraQtys.slice(1) };
        }
        return { ...l, extraQtys: l.extraQtys.filter((_, j) => j !== index - 1) };
      }),
    );
  };

  const setExtraQty = (key: string, extraIndex: number, value: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const extraQtys = [...l.extraQtys];
        extraQtys[extraIndex] = value;
        return { ...l, extraQtys };
      }),
    );
  };

  const buildPayload = (): RecipeWritePayload | null => {
    if (!name.trim()) {
      setError("Name the recipe.");
      return null;
    }
    if (!categoryId) {
      setError("Pick a category.");
      return null;
    }
    const ingredients = lines
      .map((l) => {
        const qty = parseRecipeQty(l.qty);
        const extraQtys = multi
          ? sizes.slice(1).map((_, i) => parseRecipeQty(l.extraQtys[i] ?? "") )
          : [];
        return {
          name: l.name.trim() || l.catalogName || undefined,
          qty: qty ?? 0,
          extraQtys: extraQtys.map((q) => q ?? null),
          unit: unitFromQtyText(l.qty) ?? l.unit,
          note: l.note.trim() || null,
          buyItemId: l.buyItemId,
          componentRecipeId: l.componentRecipeId,
        };
      })
      .filter(
        (l) =>
          (l.componentRecipeId || l.name) &&
          (l.qty > 0 || l.extraQtys.some((q) => q != null && q > 0)),
      );
    const namedWithoutQty = lines.filter((l) => {
      if (!(l.name.trim() || l.componentRecipeId)) return false;
      if (parseRecipeQty(l.qty)) return false;
      if (multi && l.extraQtys.some((q) => parseRecipeQty(q))) return false;
      return true;
    });
    if (ingredients.length === 0) {
      setError("Add at least one ingredient.");
      return null;
    }
    if (namedWithoutQty.length) {
      setError("Check qty — use 1/2 or 0.5, not a blank box.");
      return null;
    }
    const parsedYield = parseRecipeQty(yieldQty);
    return {
      name: name.trim(),
      categoryId,
      version: {
        yieldQty: parsedYield,
        yieldUnit: parsedYield ? (unitFromQtyText(yieldQty) ?? yieldUnit) : null,
        yieldNote: yieldNote.trim() || null,
        sizes: multi ? sizes.map((s) => ({ label: s.label.trim() })) : undefined,
        ingredients,
        steps: steps.map((s) => s.text.trim()).filter(Boolean),
        usage: usage
          .filter((u) => u.axis1.trim() && parseRecipeQty(u.qty))
          .map((u) => ({
            axis1: u.axis1.trim(),
            axis2: u.axis2.trim() || null,
            qty: parseRecipeQty(u.qty) as number,
            unit: unitFromQtyText(u.qty) ?? u.unit,
          })),
      },
    };
  };

  const recipeHits = new Map<string, string>();
  for (const [id, rName] of Object.entries(pickedRecipes)) {
    if (id !== recipeId) recipeHits.set(id, rName);
  }
  for (const r of recipes.data?.items ?? []) {
    if (r.id !== recipeId) recipeHits.set(r.id, r.name);
  }
  const pickerOptions = [
    ...[...recipeHits.entries()].map(([id, rName]) => ({
      id: `recipe:${id}`,
      label: rName,
      hint: "Recipe",
    })),
    ...(items.data?.items ?? []).map((it) => {
      const alias = it.alias?.trim();
      return {
        id: `item:${it.id}`,
        label: alias || it.name,
        hint: alias ? it.name : unitLabel(it.unit),
      };
    }),
  ];

  return (
    <div>
      <Link
        to={recipeId ? `/recipes/${recipeId}` : "/recipes"}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-500"
      >
        <ArrowLeft className="h-3 w-3" /> {recipeId ? "Recipe" : "All recipes"}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-slate-900">
        {recipeId ? "Edit recipe" : "New recipe"}
      </h1>
      {scanNote && <p className="mt-1 text-sm text-emerald-700">{scanNote}</p>}

      <form
        className="mt-4 space-y-2.5 rounded-card border border-slate-200 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const body = buildPayload();
          if (!body) return;
          if (recipeId) {
            update.mutate(
              { id: recipeId, ...body },
              {
                onSuccess: (row) => navigate(`/recipes/${row.id}`),
                onError: (err) => setError(err instanceof Error ? err.message : "Could not save"),
              },
            );
          } else {
            create.mutate(body, {
              onSuccess: (row) => navigate(`/recipes/${row.id}`),
              onError: (err) => setError(err instanceof Error ? err.message : "Could not save"),
            });
          }
        }}
      >
        {canWrite && <ScanRecipeBlock onDraft={applyDraft} onInsertLines={insertPastedLines} />}

        <div className="grid grid-cols-1 gap-2 min-[560px]:grid-cols-2">
          <Field label="Name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              disabled={!canWrite}
            />
          </Field>
          <Field label="Category" required>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={selectClass}
              disabled={!canWrite}
            >
              <option value="">Pick…</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentName ? `${c.parentName} / ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,6rem)_minmax(0,1fr)] gap-2">
          <Field label="Yield">
            <input
              inputMode="decimal"
              value={yieldQty}
              onChange={(e) => setYieldQty(e.target.value)}
              className={inputClass}
              disabled={!canWrite}
            />
          </Field>
          <Field label="Unit">
            <select
              value={yieldUnit}
              onChange={(e) => setYieldUnit(e.target.value as RecipeUnit)}
              className={selectClass}
              disabled={!canWrite}
            >
              {RECIPE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {unitLabel(u)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Yield note">
            <input
              value={yieldNote}
              onChange={(e) => setYieldNote(e.target.value)}
              placeholder="1 kg batter, 24 cookies…"
              className={inputClass}
              disabled={!canWrite}
            />
          </Field>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Ingredients</p>
          <p className="text-xs text-slate-500">
            Pick the item from the list, then set a short alias (oil, maida) for the kitchen.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {multi &&
              sizes.map((s, i) => (
                <span key={s.key} className="inline-flex items-center gap-1">
                  <input
                    value={s.label}
                    onChange={(e) =>
                      setSizes((prev) =>
                        prev.map((row) => (row.key === s.key ? { ...row, label: e.target.value } : row)),
                      )
                    }
                    placeholder={i === 0 ? "Regular" : i === 1 ? "Small" : "350g"}
                    className={`${inputClass} w-[5.5rem] py-1 text-xs`}
                    disabled={!canWrite}
                  />
                  {canWrite && (
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-700"
                      onClick={() => removeSize(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))}
            {canWrite && sizes.length < 4 && (
              <button
                type="button"
                onClick={addSize}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-700"
              >
                <Plus className="h-4 w-4" /> Add size
              </button>
            )}
          </div>
          {lines.map((line) => {
            const catalogName =
              line.catalogName ??
              items.data?.items.find((row) => row.id === line.buyItemId)?.name;
            const q = lineQueries[line.key] ?? (line.buyItemId ? catalogName ?? "" : line.name);
            const qtyCols = Array.from({ length: multi ? sizes.length : 1 }, () => "4.5rem").join(" ");
            return (
              <div
                key={line.key}
                className="grid gap-1.5"
                style={{
                  gridTemplateColumns: `${qtyCols} 5.5rem minmax(8rem,1fr) 7.5rem auto`,
                }}
              >
                <Field label={multi ? sizes[0]?.label || "Qty" : "Qty"}>
                  <input
                    inputMode="decimal"
                    value={line.qty}
                    onChange={(e) => setLine(line.key, { qty: e.target.value })}
                    placeholder="1/2"
                    className={inputClass}
                    disabled={!canWrite}
                  />
                </Field>
                {multi &&
                  sizes.slice(1).map((s, i) => (
                    <Field key={s.key} label={s.label || "Qty"}>
                      <input
                        inputMode="decimal"
                        value={line.extraQtys[i] ?? ""}
                        onChange={(e) => setExtraQty(line.key, i, e.target.value)}
                        placeholder="1/2"
                        className={inputClass}
                        disabled={!canWrite}
                      />
                    </Field>
                  ))}
                <Field label="Unit">
                  <select
                    value={line.unit}
                    onChange={(e) => setLine(line.key, { unit: e.target.value as RecipeUnit })}
                    className={selectClass}
                    disabled={!canWrite}
                  >
                    {RECIPE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {unitLabel(u)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Item or recipe">
                  <div className="flex items-start gap-1.5">
                    <div className="min-w-0 flex-1">
                      <SearchCreate
                        query={q}
                        onQuery={(next) => {
                          setPickerSearch(next);
                          setLineQueries((prev) => ({ ...prev, [line.key]: next }));
                          if (line.buyItemId) return;
                          setLine(line.key, {
                            name: next,
                            buyItemId: undefined,
                            catalogName: undefined,
                            componentRecipeId: undefined,
                          });
                        }}
                        options={pickerOptions.filter((o) => {
                          const needle = q.trim().toLowerCase();
                          if (!needle) return true;
                          return (
                            o.label.toLowerCase().includes(needle) ||
                            (o.hint?.toLowerCase().includes(needle) ?? false)
                          );
                        })}
                        placeholder="Maida, cookie recipe…"
                        createLabel={q.trim() && !line.buyItemId && !line.componentRecipeId ? `Use “${q.trim()}”` : null}
                        onSelect={(raw) => {
                          if (raw.startsWith("recipe:")) {
                            const id = raw.slice(7);
                            const rName =
                              recipeHits.get(id) ??
                              recipes.data?.items.find((row) => row.id === id)?.name ??
                              "";
                            setPickedRecipes((prev) => ({ ...prev, [id]: rName }));
                            setLine(line.key, {
                              componentRecipeId: id,
                              buyItemId: undefined,
                              catalogName: undefined,
                              name: rName,
                            });
                            setLineQueries((prev) => ({ ...prev, [line.key]: rName }));
                            return;
                          }
                          if (raw.startsWith("item:")) {
                            const id = raw.slice(5);
                            const it = items.data?.items.find((row) => row.id === id);
                            const kitchen = it?.alias?.trim() || "";
                            setLine(line.key, {
                              buyItemId: id,
                              componentRecipeId: undefined,
                              catalogName: it?.name,
                              name: kitchen,
                            });
                            setLineQueries((prev) => ({ ...prev, [line.key]: it?.name ?? "" }));
                          }
                        }}
                        onCreate={(n) => {
                          setLine(line.key, {
                            name: n,
                            buyItemId: undefined,
                            catalogName: undefined,
                            componentRecipeId: undefined,
                          });
                          setLineQueries((prev) => ({ ...prev, [line.key]: n }));
                        }}
                      />
                    </div>
                    {line.componentRecipeId ? (
                      <span className="mt-2.5 shrink-0 text-[10px] font-medium tracking-wide text-brand-600 uppercase">
                        Recipe
                      </span>
                    ) : null}
                    {(line.buyItemId || line.componentRecipeId) && canWrite ? (
                      <button
                        type="button"
                        title="Unlink"
                        className="mt-2.5 shrink-0 text-slate-400 hover:text-slate-700"
                        onClick={() =>
                          setLine(line.key, {
                            buyItemId: undefined,
                            catalogName: undefined,
                            componentRecipeId: undefined,
                          })
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </Field>
                {!line.componentRecipeId ? (
                  <Field label="Alias">
                    <input
                      value={line.name}
                      onChange={(e) => setLine(line.key, { name: e.target.value })}
                      placeholder="oil"
                      maxLength={40}
                      className={inputClass}
                      disabled={!canWrite}
                    />
                  </Field>
                ) : (
                  <span />
                )}
                {lines.length > 1 && canWrite && (
                  <button
                    type="button"
                    className="mt-5 text-slate-400 hover:text-red-700"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
          {canWrite && (
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, emptyLine(extraCount)])}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700"
            >
              <Plus className="h-4 w-4" /> Add ingredient
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Process</p>
          {steps.map((step, index) => (
            <div key={step.key} className="flex items-start gap-1.5">
              <span className="mt-2.5 w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">
                {index + 1}.
              </span>
              <input
                value={step.text}
                onChange={(e) =>
                  setSteps((prev) =>
                    prev.map((s) => (s.key === step.key ? { ...s, text: e.target.value } : s)),
                  )
                }
                placeholder="Preheat the oven…"
                className={`${inputClass} min-w-0 flex-1`}
                disabled={!canWrite}
              />
              {steps.length > 1 && canWrite && (
                <button
                  type="button"
                  className="mt-2.5 text-slate-400 hover:text-red-700"
                  onClick={() => setSteps((prev) => prev.filter((s) => s.key !== step.key))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {canWrite && (
            <button
              type="button"
              onClick={() => setSteps((prev) => [...prev, emptyStep()])}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700"
            >
              <Plus className="h-4 w-4" /> Add step
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Portions <span className="font-normal text-slate-400">(size / crust)</span>
          </p>
          {usage.map((row) => (
            <div key={row.key} className="grid grid-cols-[1fr_1fr_4.5rem_5.5rem_auto] gap-1.5">
              <Field label="Size / pack">
                <input
                  value={row.axis1}
                  onChange={(e) =>
                    setUsage((prev) =>
                      prev.map((u) => (u.key === row.key ? { ...u, axis1: e.target.value } : u)),
                    )
                  }
                  placeholder='6" / 250 ml'
                  className={inputClass}
                  disabled={!canWrite}
                />
              </Field>
              <Field label="Style">
                <input
                  value={row.axis2}
                  onChange={(e) =>
                    setUsage((prev) =>
                      prev.map((u) => (u.key === row.key ? { ...u, axis2: e.target.value } : u)),
                    )
                  }
                  placeholder="thin, thick…"
                  className={inputClass}
                  disabled={!canWrite}
                />
              </Field>
              <Field label="Qty">
                <input
                  inputMode="decimal"
                  value={row.qty}
                  onChange={(e) =>
                    setUsage((prev) =>
                      prev.map((u) => (u.key === row.key ? { ...u, qty: e.target.value } : u)),
                    )
                  }
                  className={inputClass}
                  disabled={!canWrite}
                />
              </Field>
              <Field label="Unit">
                <select
                  value={row.unit}
                  onChange={(e) =>
                    setUsage((prev) =>
                      prev.map((u) =>
                        u.key === row.key ? { ...u, unit: e.target.value as RecipeUnit } : u,
                      ),
                    )
                  }
                  className={selectClass}
                  disabled={!canWrite}
                >
                  {RECIPE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {unitLabel(u)}
                    </option>
                  ))}
                </select>
              </Field>
              {canWrite && (
                <button
                  type="button"
                  className="mt-5 text-slate-400 hover:text-red-700"
                  onClick={() => setUsage((prev) => prev.filter((u) => u.key !== row.key))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {canWrite && (
            <button
              type="button"
              onClick={() => setUsage((prev) => [...prev, emptyUsage()])}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700"
            >
              <Plus className="h-4 w-4" /> Add portion
            </button>
          )}
        </div>

        {error && <p className="text-xs text-red-700">{error}</p>}
        {canWrite && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : recipeId ? "Save" : "Save recipe"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
