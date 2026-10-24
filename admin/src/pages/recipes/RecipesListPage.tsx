import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Plus, Printer } from "lucide-react";
import { PaginationControls } from "@/components/ClientPagination";
import { DebouncedSearchInput } from "@/components/form/DebouncedSearchInput";
import { useListSearch } from "@/store/listSearch";
import { useStaffPermission } from "@/lib/permissions";
import { cn } from "@/lib/cn";
import { useAdminRecipes, useImportRecipes, usePrintRecipes } from "@/hooks/useAdminRecipes";
import { formatRecipeQty } from "@/pages/recipes/recipe-ui";

const PAGE_SIZE = 20;

export function RecipesListPage() {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string | null>(null);
  const [printed, setPrinted] = useState<"yes" | "no" | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const search = useListSearch((s) => s.query);
  const setSearch = useListSearch((s) => s.setQuery);
  const navigate = useNavigate();
  const canWrite = useStaffPermission("recipes.write");
  const print = usePrintRecipes();
  const importCsv = useImportRecipes();
  const [importNote, setImportNote] = useState<string | null>(null);
  const { data, isLoading, isFetching } = useAdminRecipes({
    search: search || null,
    category,
    printed,
    page,
    pageSize: PAGE_SIZE,
  });
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const categories = data?.categories ?? [];
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  useEffect(() => {
    setPage(1);
  }, [search, category, printed]);

  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(rows.map((r) => r.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Recipes</h1>
          <p className="mt-1 text-sm text-slate-500">
            {search
              ? `${total} match${total === 1 ? "" : "es"} for “${search}”`
              : `${total} kitchen formula${total === 1 ? "" : "s"}`}
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={selected.size === 0 || print.isPending}
              onClick={() => {
                setError(null);
                print.mutate(
                  { recipeIds: [...selected] },
                  {
                    onSuccess: () => setSelected(new Set()),
                    onError: (err) =>
                      setError(err instanceof Error ? err.message : "Could not print"),
                  },
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              {print.isPending ? "Printing…" : `Print${selected.size ? ` (${selected.size})` : ""}`}
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              {importCsv.isPending ? "Importing…" : "Import CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={importCsv.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setError(null);
                  setImportNote(null);
                  importCsv.mutate(file, {
                    onSuccess: (res) => {
                      const fail = res.errors.length
                        ? ` · ${res.errors.length} failed${res.errors[0] ? ` (${res.errors[0].name})` : ""}`
                        : "";
                      setImportNote(`Imported ${res.created}, skipped ${res.skipped}${fail}`);
                      if (res.errors.length) {
                        setError(res.errors.map((x) => `${x.name}: ${x.message}`).join(" · "));
                      }
                    },
                    onError: (err) =>
                      setError(err instanceof Error ? err.message : "Could not import"),
                  });
                }}
              />
            </label>
            <Link
              to="/recipes/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" /> New recipe
            </Link>
          </div>
        )}
      </div>

      <div className="mb-3">
        <DebouncedSearchInput placeholder="Search recipes…" onDebouncedChange={setSearch} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
          {categories.map((row) => {
            const active = category === row.slug || category === row.id;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setCategory(active ? null : row.slug)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                  active
                    ? "bg-brand-50 border-brand-500 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                )}
              >
                {row.name} <span className="tabular-nums">{row.count ?? 0}</span>
              </button>
            );
          })}
          {(
            [
              { key: "yes", label: "Printed" },
              { key: "no", label: "Not printed" },
            ] as const
          ).map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setPrinted((prev) => (prev === chip.key ? null : chip.key))}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                printed === chip.key
                  ? "bg-brand-50 border-brand-500 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {chip.label}
            </button>
          ))}
      </div>

      {importNote && <p className="mb-3 text-sm text-emerald-700">{importNote}</p>}
      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-clip rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && rows.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            {search
              ? `No recipes match “${search}”.`
              : "No recipes yet. Scan a sheet or add one by hand."}
          </div>
        )}
        {!isLoading && rows.length > 0 && (
          <>
            {isFetching && !isLoading && (
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                Updating results…
              </div>
            )}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  {canWrite && (
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (allOnPageSelected) rows.forEach((r) => next.delete(r.id));
                            else rows.forEach((r) => next.add(r.id));
                            return next;
                          });
                        }}
                        aria-label="Select all on this page"
                      />
                    </th>
                  )}
                  <th className="px-4 py-2 font-medium">Recipe</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Yield</th>
                  <th className="px-4 py-2 font-medium">Version</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => navigate(`/recipes/${row.id}`)}
                  >
                    {canWrite && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                          aria-label={`Select ${row.name}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-3 text-slate-600">{row.category.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.yieldQty != null && row.yieldUnit
                        ? formatRecipeQty(row.yieldQty, row.yieldUnit)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.versionLabel}
                      {row.printed ? (
                        <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-800 uppercase">
                          Printed
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 text-slate-300">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="flex items-start">
                  {canWrite && (
                    <div className="shrink-0 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                        aria-label={`Select ${row.name}`}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/recipes/${row.id}`)}
                    className="flex min-w-0 flex-1 items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.category.name} · {row.versionLabel}
                        {row.yieldQty != null && row.yieldUnit
                          ? ` · ${formatRecipeQty(row.yieldQty, row.yieldUnit)}`
                          : ""}
                        {row.printed ? " · Printed" : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </button>
                </li>
              ))}
            </ul>

            <PaginationControls
              page={data?.page ?? 1}
              pageCount={data?.totalPages ?? 1}
              total={total}
              firstItem={data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0}
              lastItem={data ? Math.min(data.page * data.pageSize, data.total) : 0}
              onPageChange={setPage}
              noun="recipes"
              className="mx-4 mb-4 mt-2"
            />
          </>
        )}
      </div>
    </div>
  );
}
