import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Field, inputClass, selectClass, textareaClass } from "@/components/form/Field";
import { toInputDate } from "@/lib/dateRange";
import { useStaffPermission } from "@/lib/permissions";
import { useAdminVendor, useAdminVendors } from "@/hooks/useAdminVendors";
import {
  useAdminBuyItems,
  useAdminPurchase,
  useCreatePurchase,
  useUpdatePurchase,
  useVoidPurchase,
  useExpenseCategories,
  type PurchaseWritePayload,
} from "@/hooks/useAdminBooks";
import {
  BOOKS_PAY_METHODS,
  BUY_ITEM_UNITS,
  inr,
  lineQtyLabel,
  packUnitLabel,
  payLabel,
  PURCHASE_PURPOSES,
  unitLabel,
  type BooksPaymentMethod,
  type BuyItemUnit,
  type PurchasePurpose,
} from "@/pages/expenses/books-ui";
import { SearchCreate } from "@/pages/expenses/SearchCreate";
import { ExpenseCategoryField } from "@/pages/expenses/ExpenseCategoryField";
import { PurposeMark } from "@/pages/expenses/PurposeMark";
import { VendorChannelField } from "@/pages/vendors/VendorChannelField";
import { channelLabel, type VendorChannel } from "@/pages/vendors/vendor-ui";

type DraftLine = {
  key: string;
  buyItemId?: string;
  name: string;
  unit: BuyItemUnit;
  packSize: string;
  qty: string;
  unitPrice: string;
};

function emptyLine(): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    name: "",
    unit: "KG",
    packSize: "",
    qty: "",
    unitPrice: "",
  };
}

export function PurchaseFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const [params] = useSearchParams();
  const prefillVendor = params.get("vendorId");
  const navigate = useNavigate();
  const canWrite = useStaffPermission("expenses.write");
  const existing = useAdminPurchase(isNew ? undefined : id);
  const prefill = useAdminVendor(prefillVendor || undefined);
  const categories = useExpenseCategories();

  if (!isNew && existing.isLoading) {
    return <p className="text-sm text-slate-500">Loading buy…</p>;
  }
  if (!isNew && existing.isError) {
    return <p className="text-sm text-red-700">Buy not found.</p>;
  }

  return (
    <PurchaseForm
      key={existing.data?.id ?? prefillVendor ?? "new"}
      canWrite={canWrite}
      initial={
        existing.data
          ? {
              date: existing.data.date,
              vendorId: existing.data.vendorId,
              vendorName: existing.data.vendor.name,
              vendorChannel: existing.data.vendor.channel ?? "OFFLINE",
              purpose: existing.data.purpose,
              paymentMethod: existing.data.paymentMethod,
              notes: existing.data.notes ?? "",
              categoryId: existing.data.categoryId ?? "raw-materials",
              voidedAt: existing.data.voidedAt,
              lines: existing.data.lines.map((l) => ({
                key: l.id,
                buyItemId: l.buyItemId,
                name: l.buyItem.name,
                unit: l.buyItem.unit,
                packSize: l.buyItem.packSize ? String(l.buyItem.packSize) : "",
                qty: String(l.qty),
                unitPrice: String(l.unitPrice),
              })),
            }
          : {
              date: toInputDate(new Date()),
              vendorId: prefill.data?.id,
              vendorName: prefill.data?.name ?? "",
              vendorChannel: prefill.data?.channel ?? "OFFLINE",
              purpose: "PRODUCTION",
              paymentMethod: "CASH",
              notes: "",
              categoryId:
                categories.data?.items.find((c) => c.slug === "raw-materials")?.slug ??
                "raw-materials",
              voidedAt: null,
              lines: [emptyLine()],
            }
      }
      purchaseId={existing.data?.id}
      onSaved={(nextId) => {
        if (isNew) navigate(`/expenses/buys/${nextId}`, { replace: true });
      }}
    />
  );
}

function PurchaseForm({
  canWrite,
  initial,
  purchaseId,
  onSaved,
}: {
  canWrite: boolean;
  purchaseId?: string;
  onSaved: (id: string) => void;
  initial: {
    date: string;
    vendorId?: string;
    vendorName: string;
    vendorChannel: VendorChannel;
    purpose: PurchasePurpose;
    paymentMethod: BooksPaymentMethod;
    notes: string;
    categoryId: string;
    voidedAt: string | null;
    lines: DraftLine[];
  };
}) {
  const navigate = useNavigate();
  const create = useCreatePurchase();
  const update = useUpdatePurchase();
  const voidBuy = useVoidPurchase();
  const [date, setDate] = useState(initial.date);
  const [vendorId, setVendorId] = useState(initial.vendorId);
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorName, setVendorName] = useState(initial.vendorName);
  const [vendorChannel, setVendorChannel] = useState<VendorChannel>(initial.vendorChannel);
  const [purpose, setPurpose] = useState<PurchasePurpose>(initial.purpose);
  const [paymentMethod, setPaymentMethod] = useState<BooksPaymentMethod>(initial.paymentMethod);
  const [notes, setNotes] = useState(initial.notes);
  const [category, setCategory] = useState(initial.categoryId);
  const [lines, setLines] = useState<DraftLine[]>(initial.lines);
  const [itemQueries, setItemQueries] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const voided = Boolean(initial.voidedAt);
  const pending = create.isPending || update.isPending;

  const vendors = useAdminVendors({ search: vendorQuery || null, active: "ACTIVE", pageSize: 20 });
  const itemSearch = Object.values(itemQueries).find((q) => q.trim()) ?? "";
  const items = useAdminBuyItems({ search: itemSearch || null, pageSize: 20 });

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.qty);
        const rate = Number(line.unitPrice);
        if (!(qty > 0) || !(rate >= 0)) return sum;
        return Math.round((sum + qty * rate + Number.EPSILON) * 100) / 100;
      }, 0),
    [lines],
  );

  const setLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const buildPayload = (): PurchaseWritePayload | null => {
    if (!vendorId && !vendorName.trim() && !vendorQuery.trim()) {
      setError("Pick or type a vendor.");
      return null;
    }
    const payloadLines = lines
      .map((line) => ({
        buyItemId: line.buyItemId,
        name: line.name.trim() || undefined,
        unit: line.unit,
        packSize: Number(line.packSize) > 1 ? Number(line.packSize) : null,
        qty: Number(line.qty),
        unitPrice: Number(line.unitPrice),
      }))
      .filter((l) => l.qty > 0 && (l.buyItemId || l.name));
    if (payloadLines.length === 0) {
      setError("Add at least one line with qty and an item.");
      return null;
    }
    return {
      date,
      vendor: vendorId
        ? { id: vendorId, channel: vendorChannel }
        : { name: vendorName.trim() || vendorQuery.trim(), channel: vendorChannel },
      purpose,
      paymentMethod,
      notes: notes.trim() || null,
      category,
      lines: payloadLines,
    };
  };

  return (
    <div>
      <Link
        to="/expenses"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-500"
      >
        <ArrowLeft className="h-3 w-3" /> All expenses
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-slate-900">
        {purchaseId ? "Edit buy" : "Log a buy"}
      </h1>
      {voided && <p className="mt-1 text-sm text-slate-500">Voided — not in the books.</p>}

      <form
        className="mt-4 space-y-3 rounded-card border border-slate-200 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setSaved(false);
          const body = buildPayload();
          if (!body) return;
          if (purchaseId) {
            update.mutate(
              { id: purchaseId, ...body },
              {
                onSuccess: () => setSaved(true),
                onError: (err) => setError(err instanceof Error ? err.message : "Could not save"),
              },
            );
          } else {
            create.mutate(body, {
              onSuccess: (row) => onSaved(row.id),
              onError: (err) => setError(err instanceof Error ? err.message : "Could not save"),
            });
          }
        }}
      >
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          <Field label="Date" required>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
              disabled={!canWrite || voided}
            />
          </Field>
          <Field label="Vendor" required>
            <SearchCreate
              query={vendorQuery || vendorName}
              onQuery={(q) => {
                setVendorQuery(q);
                setVendorId(undefined);
                setVendorName(q);
              }}
              options={(vendors.data?.items ?? []).map((v) => ({
                id: v.id,
                label: v.name,
                hint: [channelLabel(v.channel), v.phone].filter(Boolean).join(" · ") || undefined,
              }))}
              placeholder="Shop or person"
              createLabel={
                (vendorQuery || vendorName).trim() && !vendorId
                  ? `Use “${(vendorQuery || vendorName).trim()}”`
                  : null
              }
              onSelect={(id) => {
                const v = vendors.data?.items.find((row) => row.id === id);
                setVendorId(id);
                setVendorName(v?.name ?? "");
                setVendorQuery(v?.name ?? "");
                setVendorChannel(v?.channel ?? "OFFLINE");
              }}
              onCreate={(name) => {
                setVendorId(undefined);
                setVendorName(name);
                setVendorQuery(name);
              }}
            />
          </Field>
        </div>

        <VendorChannelField
          value={vendorChannel}
          onChange={setVendorChannel}
          disabled={!canWrite || voided}
        />

        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          <ExpenseCategoryField
            value={category}
            onChange={setCategory}
            disabled={!canWrite || voided}
          />
          <Field label="Paid with">
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as BooksPaymentMethod)}
              className={selectClass}
              disabled={!canWrite || voided}
            >
              {BOOKS_PAY_METHODS.map((m) => (
                <option key={m} value={m}>
                  {payLabel(m)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Lines</p>
          <div className="grid grid-cols-1 gap-2 min-[720px]:grid-cols-2">
          {lines.map((line) => {
            const qty = Number(line.qty);
            const rate = Number(line.unitPrice);
            const amount = qty > 0 && rate >= 0 ? Math.round(qty * rate * 100) / 100 : 0;
            const q = itemQueries[line.key] ?? line.name;
            return (
              <div
                key={line.key}
                className="rounded-lg border border-slate-200 p-2.5"
              >
                <Field label="Item" required>
                  <SearchCreate
                    query={q}
                    onQuery={(next) => {
                      setItemQueries((prev) => ({ ...prev, [line.key]: next }));
                      setLine(line.key, { name: next, buyItemId: undefined });
                    }}
                    options={(items.data?.items ?? []).map((it) => ({
                      id: it.id,
                      label: it.name,
                      hint: packUnitLabel(it.unit, it.packSize),
                    }))}
                    placeholder="Cream, flour, box…"
                    createLabel={
                      q.trim() && !line.buyItemId ? `New item “${q.trim()}”` : null
                    }
                    onSelect={(itemId) => {
                      const it = items.data?.items.find((row) => row.id === itemId);
                      setLine(line.key, {
                        buyItemId: itemId,
                        name: it?.name ?? "",
                        unit: it?.unit ?? line.unit,
                        packSize: it?.packSize ? String(it.packSize) : line.packSize,
                      });
                      setItemQueries((prev) => ({ ...prev, [line.key]: it?.name ?? "" }));
                    }}
                    onCreate={(name) => {
                      setLine(line.key, { buyItemId: undefined, name });
                      setItemQueries((prev) => ({ ...prev, [line.key]: name }));
                    }}
                  />
                </Field>
                <div className="mt-2 grid grid-cols-2 gap-2 min-[480px]:grid-cols-4">
                  <Field label={line.unit === "PACKET" ? "Qty (packs)" : "Qty"}>
                    <input
                      inputMode="decimal"
                      value={line.qty}
                      onChange={(e) => setLine(line.key, { qty: e.target.value })}
                      className={inputClass}
                      disabled={!canWrite || voided}
                    />
                  </Field>
                  <Field label="Pcs / pack">
                    <input
                      inputMode="numeric"
                      value={line.packSize}
                      onChange={(e) => setLine(line.key, { packSize: e.target.value })}
                      placeholder={line.unit === "PACKET" ? "10" : "—"}
                      className={inputClass}
                      disabled={!canWrite || voided}
                    />
                  </Field>
                  <Field label={`Rate / ${packUnitLabel(line.unit, Number(line.packSize) || null)}`}>
                    <input
                      inputMode="decimal"
                      value={line.unitPrice}
                      onChange={(e) => setLine(line.key, { unitPrice: e.target.value })}
                      className={inputClass}
                      disabled={!canWrite || voided}
                    />
                  </Field>
                  <Field label="Unit">
                    <select
                      value={line.unit}
                      onChange={(e) => {
                        const unit = e.target.value as BuyItemUnit;
                        setLine(line.key, {
                          unit,
                          packSize: unit === "PACKET" && !line.packSize ? "10" : line.packSize,
                        });
                      }}
                      className={selectClass}
                      disabled={!canWrite || voided}
                    >
                      {BUY_ITEM_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {unitLabel(u)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    {Number(line.qty) > 0
                      ? lineQtyLabel(
                          Number(line.qty),
                          line.unit,
                          Number(line.packSize) || null,
                        )
                      : "Line"}{" "}
                    · {inr(amount)}
                  </span>
                  {lines.length > 1 && canWrite && !voided && (
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          </div>
          {canWrite && !voided && (
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700"
            >
              <Plus className="h-4 w-4" /> Add line
            </button>
          )}
        </div>

        {purchaseId && (
          <PurposeMark
            value={purpose}
            options={PURCHASE_PURPOSES}
            onChange={setPurpose}
            disabled={!canWrite || voided}
          />
        )}

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={textareaClass}
            disabled={!canWrite || voided}
          />
        </Field>

        <p className="text-right text-lg font-semibold text-slate-900">Total {inr(total)}</p>
        {error && <p className="text-xs text-red-700">{error}</p>}
        {saved && <p className="text-xs text-emerald-700">Saved.</p>}

        {canWrite && !voided && (
          <div className="flex flex-wrap justify-end gap-2">
            {purchaseId && (
              <button
                type="button"
                disabled={voidBuy.isPending}
                onClick={() => {
                  if (!window.confirm("Void this buy? It will drop out of the books.")) return;
                  voidBuy.mutate(purchaseId, {
                    onSuccess: () => navigate("/expenses"),
                    onError: (err) =>
                      setError(err instanceof Error ? err.message : "Could not void"),
                  });
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Void
              </button>
            )}
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : purchaseId ? "Save" : "Save buy"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
