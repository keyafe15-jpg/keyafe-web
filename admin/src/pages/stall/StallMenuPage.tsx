import { useEffect, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import {
  useCopyStallMenu,
  useCreateStall,
  useCreateStallMenuItem,
  useDeleteStall,
  useDeleteStallMenuItem,
  useManageStalls,
  useReorderStallMenu,
  useUpdateStall,
  useUpdateStallMenuItem,
  type Stall,
  type StallChargeBasis,
  type StallFields,
  type StallKind,
  type StallMenuItem,
} from "@/hooks/useStalls";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/money";
import { Field, inputClass, submitClass, textareaClass } from "@/components/form/Field";
import {
  ReorderHandle,
  ReorderList,
  type ReorderItemContext,
} from "@/components/reorder/ReorderList";
import { ActiveSwitch } from "@/components/ui/ActiveSwitch";
import {
  Segmented,
  Select,
  StallStatusBadge,
  StallSummaryCard,
  formatStallDates,
} from "./stall-ui";

const NO_STALLS: Stall[] = [];
const NO_ITEMS: StallMenuItem[] = [];
const STATUS_RANK = { live: 0, upcoming: 1, ended: 2 } as const;

/** Live first, then upcoming (soonest first), then ended (most recent first). */
function sortExhibitions(list: Stall[]) {
  return [...list].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      (a.status === "ended"
        ? (b.endDate ?? "").localeCompare(a.endDate ?? "")
        : (a.startDate ?? "").localeCompare(b.startDate ?? "")),
  );
}

export function StallMenuPage() {
  const { data: stalls = NO_STALLS, isLoading } = useManageStalls();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const stall = stalls.find((s) => s.id === selectedId) ?? stalls[0] ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Stalls &amp; menus</h1>
        <p className="mt-1 text-sm text-slate-500">
          Office counters and exhibitions, each with its own menu. Exhibitions appear on the counter
          only between their dates. Drag menu rows to order the counter buttons; switch an item off
          to hide it without deleting it.
        </p>
      </div>

      {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}

      {!isLoading && (stalls.length === 0 || adding) && (
        <NewStallForm
          stalls={stalls}
          onCreated={(id) => {
            setAdding(false);
            setSelectedId(id);
          }}
          onCancel={stalls.length > 0 ? () => setAdding(false) : undefined}
        />
      )}

      {stall && !adding && (
        <>
          <StallPicker
            stalls={stalls}
            selectedId={stall.id}
            onSelect={setSelectedId}
            onAdd={() => setAdding(true)}
          />
          <StallSettings key={stall.id} stall={stall} onDeleted={() => setSelectedId(null)} />
          <StallSummaryCard stallId={stall.id} className="mb-4" />
          <NewMenuItemRow stallId={stall.id} />
          <CopyMenu stall={stall} stalls={stalls} />
          <MenuList stall={stall} />
        </>
      )}
    </div>
  );
}

function StallPicker({
  stalls,
  selectedId,
  onSelect,
  onAdd,
}: {
  stalls: Stall[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const groups = [
    { label: "Offices", items: stalls.filter((s) => s.kind === "OFFICE") },
    { label: "Exhibitions", items: sortExhibitions(stalls.filter((s) => s.kind === "EXHIBITION")) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="mb-4 rounded-card border border-slate-200 bg-white p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Your stalls</h2>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          <Plus className="h-4 w-4" /> Add stall
        </button>
      </div>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-1 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
              {g.label}
            </p>
            <ul className="space-y-1">
              {g.items.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
                      s.id === selectedId
                        ? "bg-brand-100/60 ring-1 ring-brand-500"
                        : "hover:bg-slate-50",
                    )}
                  >
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate font-medium",
                        s.isActive ? "text-slate-900" : "text-slate-400",
                      )}
                    >
                      {s.name}
                    </span>
                    {s.kind === "EXHIBITION" && (
                      <span className="shrink-0 text-xs text-slate-500">
                        {formatStallDates(s.startDate, s.endDate)}
                      </span>
                    )}
                    {!s.isActive ? (
                      <span className="shrink-0 text-[10px] font-semibold text-slate-400 uppercase">
                        Off
                      </span>
                    ) : (
                      <StallStatusBadge stall={s} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

interface StallForm {
  name: string;
  kind: StallKind;
  location: string;
  startDate: string;
  endDate: string;
  chargeAmount: string;
  chargeBasis: StallChargeBasis;
}

const toForm = (s?: StallFields): StallForm => ({
  name: s?.name ?? "",
  kind: s?.kind ?? "EXHIBITION",
  location: s?.location ?? "",
  startDate: s?.startDate ?? "",
  endDate: s?.endDate ?? "",
  chargeAmount: s && s.chargeAmount > 0 ? String(s.chargeAmount) : "",
  chargeBasis: s?.chargeBasis ?? "TOTAL",
});

const exhibition = (f: StallForm) => f.kind === "EXHIBITION";

const toPayload = (f: StallForm) => ({
  name: f.name.trim(),
  kind: f.kind,
  location: exhibition(f) ? f.location.trim() || null : null,
  startDate: exhibition(f) ? f.startDate || null : null,
  endDate: exhibition(f) ? f.endDate || null : null,
  chargeAmount: exhibition(f) ? Math.max(Number(f.chargeAmount) || 0, 0) : 0,
  chargeBasis: f.chargeBasis,
});

function formProblem(f: StallForm) {
  if (!f.name.trim()) return "Give the stall a name.";
  if (exhibition(f)) {
    if (!f.startDate || !f.endDate) return "Pick the exhibition's start and end dates.";
    if (f.endDate < f.startDate) return "End date must be on or after the start date.";
  }
  return null;
}

function spanDays(f: StallForm) {
  if (!f.startDate || !f.endDate || f.endDate < f.startDate) return null;
  const ms =
    new Date(`${f.endDate}T00:00:00Z`).getTime() - new Date(`${f.startDate}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

function StallFieldsEditor({
  form,
  onChange,
}: {
  form: StallForm;
  onChange: (next: StallForm) => void;
}) {
  const set = <K extends keyof StallForm>(key: K, value: StallForm[K]) =>
    onChange({ ...form, [key]: value });
  const days = spanDays(form);
  const charge = Number(form.chargeAmount) || 0;

  return (
    <div className="space-y-3">
      <Segmented
        value={form.kind}
        onChange={(kind) => set("kind", kind)}
        options={[
          { key: "OFFICE", label: "Office" },
          { key: "EXHIBITION", label: "Exhibition" },
        ]}
      />
      <Field label={exhibition(form) ? "Exhibition name" : "Stall name"}>
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder={exhibition(form) ? "e.g. Durga Puja Food Fest" : "e.g. Tech Park stall"}
          maxLength={80}
          className={inputClass}
        />
      </Field>
      {exhibition(form) && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  onChange({
                    ...form,
                    startDate: e.target.value,
                    endDate:
                      !form.endDate || form.endDate < e.target.value
                        ? e.target.value
                        : form.endDate,
                  })
                }
                className={inputClass}
              />
            </Field>
            <Field label="Ends">
              <input
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e) => set("endDate", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Location">
            <textarea
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Venue, hall / stall number, address"
              maxLength={500}
              rows={2}
              className={cn(textareaClass, "min-h-0")}
            />
          </Field>
          <div>
            <span className="mb-1 block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Stall charge
            </span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="relative block sm:w-36">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={form.chargeAmount}
                  onChange={(e) => set("chargeAmount", e.target.value)}
                  placeholder="0"
                  aria-label="Stall charge"
                  className={cn(inputClass, "pl-7")}
                />
              </span>
              <Segmented
                value={form.chargeBasis}
                onChange={(basis) => set("chargeBasis", basis)}
                options={[
                  { key: "TOTAL", label: "Whole exhibition" },
                  { key: "PER_DAY", label: "Per day" },
                ]}
                className="sm:flex-1"
              />
            </div>
            {form.chargeBasis === "PER_DAY" && charge > 0 && days != null && (
              <p className="mt-1 text-xs text-slate-500">
                {formatINR(charge)} × {days} day{days === 1 ? "" : "s"} ={" "}
                <span className="font-medium text-slate-700">{formatINR(charge * days)}</span>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NewStallForm({
  stalls,
  onCreated,
  onCancel,
}: {
  stalls: Stall[];
  onCreated: (id: string) => void;
  onCancel?: () => void;
}) {
  const create = useCreateStall();
  const [form, setForm] = useState<StallForm>(() => ({
    ...toForm(),
    kind: stalls.some((s) => s.kind === "OFFICE") ? "EXHIBITION" : "OFFICE",
  }));
  const [copyFrom, setCopyFrom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const withMenus = stalls.filter((s) => s.menu.length > 0);

  const submit = async () => {
    const problem = formProblem(form);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    try {
      const { id } = await create.mutateAsync({
        ...toPayload(form),
        ...(copyFrom ? { copyMenuFrom: copyFrom } : {}),
      });
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create stall");
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!create.isPending) void submit();
      }}
      className="mb-4 rounded-card border border-slate-200 bg-white p-4"
    >
      <h2 className="mb-3 font-semibold text-slate-900">
        {stalls.length === 0 ? "Set up your first stall" : "Add a stall"}
      </h2>
      <StallFieldsEditor form={form} onChange={setForm} />
      {withMenus.length > 0 && (
        <Field label="Copy menu from (optional)" className="mt-3">
          <Select
            value={copyFrom}
            onChange={(e) => setCopyFrom(e.target.value)}
            wrapperClassName="block"
          >
            <option value="">Start with an empty menu</option>
            {withMenus.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.menu.length} item{s.menu.length === 1 ? "" : "s"})
              </option>
            ))}
          </Select>
        </Field>
      )}
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={create.isPending}
          className={cn(submitClass, "inline-flex items-center gap-1")}
        >
          <Plus className="h-4 w-4" /> {create.isPending ? "Creating…" : "Create stall"}
        </button>
      </div>
    </form>
  );
}

function StallSettings({ stall, onDeleted }: { stall: Stall; onDeleted: () => void }) {
  const update = useUpdateStall();
  const del = useDeleteStall();
  const initial = toForm(stall);
  const [form, setForm] = useState<StallForm>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(toPayload(form)) !== JSON.stringify(toPayload(initial));

  const save = async () => {
    const problem = formProblem(form);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({ id: stall.id, ...toPayload(form) });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  const onDelete = async () => {
    setError(null);
    if (stall.dayCount > 0) {
      setError("This stall has sales history, so it can't be deleted. Switch it off instead.");
      return;
    }
    if (!confirm(`Delete “${stall.name}” and its menu?`)) return;
    try {
      await del.mutateAsync(stall.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty && !update.isPending) void save();
      }}
      className="mb-4 rounded-card border border-slate-200 bg-white p-4"
    >
      <div className="mb-3 flex items-center gap-3">
        <h2 className="min-w-0 flex-1 truncate font-semibold text-slate-900">Stall details</h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-xs text-slate-500">Active</span>
          <ActiveSwitch
            checked={stall.isActive}
            label={`${stall.name} active`}
            title={
              stall.isActive
                ? "Can appear on the counter — tap to switch off"
                : "Hidden from the counter — tap to switch on"
            }
            onChange={(isActive) => update.mutate({ id: stall.id, isActive })}
          />
        </div>
        <button
          type="button"
          onClick={() => void onDelete()}
          disabled={del.isPending}
          title={stall.dayCount > 0 ? "Has sales history — switch it off instead" : "Delete stall"}
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition disabled:opacity-50",
            stall.dayCount > 0
              ? "text-slate-300 hover:bg-slate-50 hover:text-slate-500"
              : "text-red-500 hover:bg-red-50 hover:text-red-700",
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <StallFieldsEditor
        form={form}
        onChange={(next) => {
          setForm(next);
          setSaved(false);
        }}
      />
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && !dirty && <span className="text-xs text-emerald-700">Saved</span>}
        <button type="submit" disabled={!dirty || update.isPending} className={submitClass}>
          {update.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function CopyMenu({ stall, stalls }: { stall: Stall; stalls: Stall[] }) {
  const copy = useCopyStallMenu();
  const sources = stalls.filter((s) => s.id !== stall.id && s.menu.length > 0);
  const [fromId, setFromId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  if (sources.length === 0) return null;

  const run = () => {
    if (!fromId) return;
    setMessage(null);
    copy.mutate(
      { stallId: stall.id, fromStallId: fromId },
      {
        onSuccess: ({ copied }) =>
          setMessage(
            copied === 0
              ? "Nothing new to copy — those items are already on this menu."
              : `Copied ${copied} item${copied === 1 ? "" : "s"}.`,
          ),
        onError: (err) => setMessage(err instanceof Error ? err.message : "Could not copy menu"),
      },
    );
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-500">Copy items from</span>
      <Select
        value={fromId}
        onChange={(e) => setFromId(e.target.value)}
        aria-label="Copy menu from"
        className="w-auto py-1.5"
      >
        <option value="">Choose a stall…</option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <button
        type="button"
        onClick={run}
        disabled={!fromId || copy.isPending}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Copy className="h-3.5 w-3.5" /> Copy
      </button>
      {message && <span className="text-xs text-slate-500">{message}</span>}
    </div>
  );
}

function NewMenuItemRow({ stallId }: { stallId: string }) {
  const create = useCreateStallMenuItem();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const priceValue = Number(price);
  const canSubmit = name.trim().length > 0 && price !== "" && priceValue >= 0;

  const submit = async () => {
    setError(null);
    try {
      await create.mutateAsync({ stallId, name: name.trim(), price: priceValue });
      setName("");
      setPrice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item");
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !create.isPending) void submit();
      }}
      className="rounded-card border border-slate-200 bg-white p-4"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
        <Field label="New item">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Masala chai"
            maxLength={80}
            className={inputClass}
          />
        </Field>
        <Field label="Price ₹">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="30"
            className={inputClass}
          />
        </Field>
        <div className="col-span-2 sm:col-span-1 sm:self-end">
          <button
            type="submit"
            disabled={!canSubmit || create.isPending}
            className={cn(submitClass, "inline-flex w-full items-center justify-center gap-1")}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </form>
  );
}

function MenuList({ stall }: { stall: Stall }) {
  const menu = stall.menu.length > 0 ? stall.menu : NO_ITEMS;
  const reorder = useReorderStallMenu(stall.id);
  const [items, setItems] = useState<StallMenuItem[]>(menu);
  const [reorderError, setReorderError] = useState<string | null>(null);

  useEffect(() => {
    setItems(menu);
  }, [menu]);

  const onReorder = (next: StallMenuItem[]) => {
    const prev = items;
    setItems(next);
    setReorderError(null);
    void reorder.mutateAsync(next.map((m) => m.id)).catch((err) => {
      setItems(prev);
      setReorderError(err instanceof Error ? err.message : "Failed to save order");
    });
  };

  return (
    <>
      {reorderError && (
        <div className="mt-4 rounded-lg border border-brand-500/40 bg-brand-100/50 px-4 py-3 text-sm text-brand-700">
          {reorderError}
        </div>
      )}
      <div className="mt-4 overflow-hidden rounded-card border border-slate-200 bg-white">
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No items yet — add the first one above.
          </div>
        ) : (
          <ReorderList
            className="divide-y divide-slate-100"
            items={items}
            onReorder={onReorder}
            disabled={reorder.isPending}
          >
            {(item, ctx) => <MenuRow key={item.id} item={item} reorder={ctx} />}
          </ReorderList>
        )}
      </div>
    </>
  );
}

function MenuRow({ item, reorder }: { item: StallMenuItem; reorder: ReorderItemContext }) {
  const update = useUpdateStallMenuItem();
  const del = useDeleteStallMenuItem();
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const nextName = name.trim();
    const nextPrice = Number(price);
    if (!nextName || price === "" || !(nextPrice >= 0)) {
      setName(item.name);
      setPrice(String(item.price));
      return;
    }
    if (nextName === item.name && nextPrice === item.price) return;
    setError(null);
    update.mutate(
      { id: item.id, name: nextName, price: nextPrice },
      { onError: (err) => setError(err instanceof Error ? err.message : "Could not save") },
    );
  };

  const onDelete = () => {
    if (!confirm(`Delete “${item.name}” from the menu? Past sales keep their record.`)) return;
    del.mutate(item.id, {
      onError: (err) => setError(err instanceof Error ? err.message : "Could not delete"),
    });
  };

  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div
      ref={reorder.setNodeRef}
      style={reorder.style}
      className={cn(
        "flex items-center gap-2 py-2 pr-2 pl-1 hover:bg-slate-50",
        reorder.isDragging && "bg-white shadow-md",
        !item.isActive && "bg-slate-50/60",
      )}
    >
      <ReorderHandle {...reorder.handleProps} />
      <div className="min-w-0 flex-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={blurOnEnter}
          aria-label="Item name"
          maxLength={80}
          className={cn(
            "w-full truncate rounded-md border border-transparent bg-transparent px-1 py-1 font-medium outline-none focus:border-slate-200 focus:bg-white",
            item.isActive ? "text-slate-900" : "text-slate-400 line-through",
          )}
        />
        {error && <p className="px-1 text-xs text-red-700">{error}</p>}
      </div>
      <label className="relative shrink-0">
        <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-slate-400">
          ₹
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={commit}
          onKeyDown={blurOnEnter}
          aria-label={`${item.name} price`}
          className="w-20 rounded-md border border-slate-200 bg-white py-1 pr-2 pl-5 text-right text-sm tabular-nums outline-none focus:border-brand-500 sm:w-24"
        />
      </label>
      <ActiveSwitch
        checked={item.isActive}
        label={`${item.name} available`}
        title={
          item.isActive ? "On the counter — tap to hide" : "Hidden from the counter — tap to show"
        }
        onChange={(isActive) => update.mutate({ id: item.id, isActive })}
      />
      <button
        type="button"
        onClick={onDelete}
        disabled={del.isPending}
        title={`Delete “${item.name}”`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
