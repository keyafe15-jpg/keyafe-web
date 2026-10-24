import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Field, inputClass, selectClass } from "@/components/form/Field";
import { toInputDate } from "@/lib/dateRange";
import { useStaffPermission } from "@/lib/permissions";
import { useAdminVendors } from "@/hooks/useAdminVendors";
import {
  useAdminExpense,
  useCreateExpense,
  useExpenseCategories,
  useSalaryPayees,
  useUpdateExpense,
  useVoidExpense,
  type ReceiptDraft,
} from "@/hooks/useAdminBooks";
import {
  BOOKS_PAY_METHODS,
  EXPENSE_PURPOSES,
  isSalaryCategory,
  payLabel,
  vendorScanBits,
  type BooksPaymentMethod,
  type ExpensePurpose,
} from "@/pages/expenses/books-ui";
import { SearchCreate } from "@/pages/expenses/SearchCreate";
import { ExpenseCategoryField } from "@/pages/expenses/ExpenseCategoryField";
import { PaidByField } from "@/pages/expenses/PaidByField";
import { ScanBillBlock } from "@/pages/expenses/ScanBillBlock";
import { GstFields, gstAmt } from "@/pages/expenses/GstFields";
import { PurposeMark } from "@/pages/expenses/PurposeMark";
import { VendorChannelField } from "@/pages/vendors/VendorChannelField";
import { channelLabel, type VendorChannel } from "@/pages/vendors/vendor-ui";

export function ExpenseFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const existing = useAdminExpense(isNew ? undefined : id);

  if (!isNew && existing.isLoading) {
    return <p className="text-sm text-slate-500">Loading expense…</p>;
  }
  if (!isNew && existing.isError) {
    return <p className="text-sm text-red-700">Expense not found.</p>;
  }
  if (existing.data?.purchaseId) {
    return <Navigate to={`/expenses/buys/${existing.data.purchaseId}`} replace />;
  }
  if (existing.data?.orderId) {
    return <Navigate to={`/orders/${existing.data.orderId}`} replace />;
  }

  return (
    <ExpenseForm
      key={existing.data?.id ?? "new"}
      expenseId={existing.data?.id}
      initial={
        existing.data
          ? {
              date: existing.data.date,
              amount: existing.data.amountMasked ? "" : String(existing.data.amount ?? ""),
              amountMasked: Boolean(existing.data.amountMasked),
              category: existing.data.category.slug,
              purpose: existing.data.purpose,
              paymentMethod: existing.data.paymentMethod,
              paidById: existing.data.paidById,
              paidTo: existing.data.paidTo ?? "",
              notes: existing.data.notes ?? "",
              cgst: existing.data.cgst > 0 ? String(existing.data.cgst) : "",
              sgst: existing.data.sgst > 0 ? String(existing.data.sgst) : "",
              igst: existing.data.igst > 0 ? String(existing.data.igst) : "",
              vendorId: existing.data.vendorId,
              vendorName: existing.data.vendor?.name ?? "",
              vendorChannel: existing.data.vendor?.channel ?? "OFFLINE",
              voidedAt: existing.data.voidedAt,
            }
          : {
              date: toInputDate(new Date()),
              amount: "",
              amountMasked: false,
              category: "salary",
              purpose: "OPS",
              paymentMethod: "UPI",
              paidById: null,
              paidTo: "",
              notes: "",
              cgst: "",
              sgst: "",
              igst: "",
              vendorId: null,
              vendorName: "",
              vendorChannel: "OFFLINE",
              voidedAt: null,
            }
      }
    />
  );
}

function ExpenseForm({
  expenseId,
  initial,
}: {
  expenseId?: string;
  initial: {
    date: string;
    amount: string;
    amountMasked: boolean;
    category: string;
    purpose: ExpensePurpose;
    paymentMethod: BooksPaymentMethod;
    paidById: string | null;
    paidTo: string;
    notes: string;
    cgst: string;
    sgst: string;
    igst: string;
    vendorId: string | null;
    vendorName: string;
    vendorChannel: VendorChannel;
    voidedAt: string | null;
  };
}) {
  const navigate = useNavigate();
  const leaveAfterSave = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) navigate(-1);
    else navigate("/expenses");
  };
  const canWrite = useStaffPermission("expenses.write");
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const voidExp = useVoidExpense();
  const categories = useExpenseCategories();
  const [date, setDate] = useState(initial.date);
  const [amount, setAmount] = useState(initial.amount);
  const [category, setCategory] = useState(initial.category);
  const [purpose, setPurpose] = useState<ExpensePurpose>(initial.purpose);
  const [paymentMethod, setPaymentMethod] = useState<BooksPaymentMethod>(initial.paymentMethod);
  const [paidById, setPaidById] = useState<string | null>(initial.paidById);
  const [paidTo, setPaidTo] = useState(initial.paidTo);
  const [notes, setNotes] = useState(initial.notes);
  const [cgst, setCgst] = useState(initial.cgst);
  const [sgst, setSgst] = useState(initial.sgst);
  const [igst, setIgst] = useState(initial.igst);
  const [vendorId, setVendorId] = useState<string | undefined>(initial.vendorId ?? undefined);
  const [vendorName, setVendorName] = useState(initial.vendorName);
  const [vendorChannel, setVendorChannel] = useState<VendorChannel>(initial.vendorChannel);
  const [vendorGstin, setVendorGstin] = useState<string | null>(null);
  const [vendorPhone, setVendorPhone] = useState<string | null>(null);
  const [vendorAddress, setVendorAddress] = useState<string | null>(null);
  const [vendorQuery, setVendorQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [buyDraft, setBuyDraft] = useState<ReceiptDraft | null>(null);
  const voided = Boolean(initial.voidedAt);
  const pending = create.isPending || update.isPending;
  const vendors = useAdminVendors({ search: vendorQuery || null, active: "ACTIVE", pageSize: 20 });
  const payees = useSalaryPayees();

  const cat = (categories.data?.items ?? []).find((c) => c.slug === category || c.id === category);
  const marketing = Boolean(cat?.marketing);
  const requiresNote = Boolean(cat?.requiresNote);
  const salary = isSalaryCategory(cat?.slug ?? category);

  const applyDraft = (draft: ReceiptDraft) => {
    if (draft.date) setDate(draft.date);
    if (draft.category) setCategory(draft.category);
    const nextSalary = isSalaryCategory(draft.category);
    if (nextSalary) {
      setVendorId(undefined);
      setVendorName("");
      setVendorQuery("");
    } else if (draft.vendorId || draft.vendorName) {
      setVendorId(draft.vendorId ?? undefined);
      setVendorName(draft.vendorName ?? "");
      setVendorQuery(draft.vendorName ?? "");
      setVendorChannel(draft.vendorChannel);
    }
    if (draft.vendorGstin) setVendorGstin(draft.vendorGstin);
    if (draft.vendorPhone) setVendorPhone(draft.vendorPhone);
    if (draft.vendorAddress) setVendorAddress(draft.vendorAddress);
    if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
    if (draft.notes) setNotes(draft.notes);
    if (draft.cgst > 0) setCgst(String(draft.cgst));
    if (draft.sgst > 0) setSgst(String(draft.sgst));
    if (draft.igst > 0) setIgst(String(draft.igst));
    if (!(draft.cgst > 0) && !(draft.sgst > 0) && !(draft.igst > 0) && draft.gst > 0) {
      const half = Math.round((draft.gst / 2) * 100) / 100;
      setCgst(String(half));
      setSgst(String(Math.round((draft.gst - half) * 100) / 100));
    }
    const fromLines =
      draft.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0) +
      draft.shipping +
      (draft.miscCharges ?? 0);
    const nextAmount = draft.amount && draft.amount > 0 ? draft.amount : fromLines;
    if (nextAmount > 0) setAmount(String(nextAmount));
    setBuyDraft(draft.looksLikeBuy ? draft : null);
    setScanNote(
      [
        draft.uncertain
          ? "Some of the bill was unclear — check the amount, then save."
          : "Check the amount, then save.",
        vendorScanBits(draft),
      ]
        .filter(Boolean)
        .join(" "),
    );
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
        {expenseId ? "Edit expense" : "Log an expense"}
      </h1>
      {voided && <p className="mt-1 text-sm text-slate-500">Voided — not in the books.</p>}
      {scanNote && <p className="mt-1 text-sm text-emerald-700">{scanNote}</p>}
      {buyDraft && (
        <p className="mt-1 text-sm text-slate-600">
          This looks like a shop buy.{" "}
          <button
            type="button"
            onClick={() => navigate("/expenses/new-buy", { state: { receiptDraft: buyDraft } })}
            className="font-medium text-brand-700 underline"
          >
            Open as a buy
          </button>
        </p>
      )}

      <form
        className="mt-4 space-y-3 rounded-card border border-slate-200 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const n = Number(amount);
          if (!(n > 0) && !(initial.amountMasked && expenseId && salary)) {
            setError("Enter an amount.");
            return;
          }
          if (requiresNote && !notes.trim()) {
            setError("Add a title for this category.");
            return;
          }
          if (!paidById) {
            setError("Who paid for this?");
            return;
          }
          if (salary && !paidTo.trim() && !(initial.amountMasked && expenseId)) {
            setError("Who was this salary paid to?");
            return;
          }
          const hidePayroll = initial.amountMasked && salary && Boolean(expenseId);
          const body = {
            date,
            ...(hidePayroll || !(n > 0) ? {} : { amount: n }),
            category,
            purpose: marketing ? ("MARKETING" as const) : purpose,
            paymentMethod,
            paidBy: paidById,
            ...(hidePayroll ? {} : { paidTo: salary ? paidTo.trim() : null }),
            notes: notes.trim() || null,
            ...(hidePayroll || salary
              ? {}
              : { cgst: gstAmt(cgst), sgst: gstAmt(sgst), igst: gstAmt(igst) }),
            vendor: salary
              ? null
              : vendorId
                ? {
                    id: vendorId,
                    channel: vendorChannel,
                    gstin: vendorGstin,
                    phone: vendorPhone,
                    address: vendorAddress,
                  }
                : vendorName.trim()
                  ? {
                      name: vendorName.trim(),
                      channel: vendorChannel,
                      gstin: vendorGstin,
                      phone: vendorPhone,
                      address: vendorAddress,
                    }
                  : null,
          };
          if (expenseId) {
            update.mutate(
              { id: expenseId, ...body },
              {
                onSuccess: leaveAfterSave,
                onError: (err) => setError(err instanceof Error ? err.message : "Could not save"),
              },
            );
          } else {
            create.mutate(body, {
              onSuccess: leaveAfterSave,
              onError: (err) => setError(err instanceof Error ? err.message : "Could not save"),
            });
          }
        }}
      >
        {!expenseId && canWrite && !voided && (
          <ScanBillBlock kind="EXPENSE" vendorId={vendorId} onDraft={applyDraft} />
        )}
        <Field
          label="Title"
          required={requiresNote}
          hint={
            requiresNote
              ? "Required — bike parking, bus to Howrah, trade license…"
              : "What this spend was for. Shows on the list."
          }
        >
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Bike parking"
            className={inputClass}
            disabled={!canWrite || voided}
          />
        </Field>
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
          <Field
            label="Amount"
            required={!initial.amountMasked}
            hint={
              initial.amountMasked
                ? "Hidden while salaries are masked."
                : "What you paid — GST sits in the fields below."
            }
          >
            <input
              inputMode="decimal"
              value={initial.amountMasked ? "••••" : amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              disabled={!canWrite || voided || initial.amountMasked}
            />
          </Field>
        </div>
        {!salary && (
          <GstFields
            cgst={cgst}
            sgst={sgst}
            igst={igst}
            onCgst={setCgst}
            onSgst={setSgst}
            onIgst={setIgst}
            disabled={!canWrite || voided || initial.amountMasked}
          />
        )}
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          <ExpenseCategoryField
            value={category}
            onChange={(next) => {
              setCategory(next);
              if (isSalaryCategory(next)) {
                setVendorId(undefined);
                setVendorName("");
                setVendorQuery("");
              }
            }}
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
          <PaidByField
            value={paidById}
            onChange={setPaidById}
            disabled={!canWrite || voided}
            required
            autofill={!expenseId}
            hint="Whose cash / UPI / bank this left."
          />
        </div>

        {salary ? (
          <Field
            label="Salary paid to"
            required={!initial.amountMasked}
            hint={initial.amountMasked ? "Hidden while salaries are masked." : "Who received this pay."}
          >
            {initial.amountMasked ? (
              <input value="••••" className={inputClass} disabled />
            ) : (
              <SearchCreate
                query={paidTo}
                onQuery={setPaidTo}
                options={(payees.data?.items ?? [])
                  .filter((name) => name.toLowerCase().includes(paidTo.trim().toLowerCase()))
                  .map((name) => ({ id: name, label: name }))}
                placeholder="Name"
                createLabel={
                  paidTo.trim() &&
                  !(payees.data?.items ?? []).some(
                    (name) => name.toLowerCase() === paidTo.trim().toLowerCase(),
                  )
                    ? `Use “${paidTo.trim()}”`
                    : null
                }
                onSelect={(name) => setPaidTo(name)}
                onCreate={(name) => setPaidTo(name)}
              />
            )}
          </Field>
        ) : (
          <>
            <Field
              label="Vendor"
              hint={
                vendorGstin || vendorPhone || vendorAddress
                  ? [vendorGstin ? `GSTIN ${vendorGstin}` : null, vendorPhone, vendorAddress]
                      .filter(Boolean)
                      .join(" · ")
                  : "Optional — gas guy, Meta, the landlord…"
              }
            >
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
                placeholder="Optional"
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
            {(vendorId || vendorName.trim()) && (
              <VendorChannelField
                value={vendorChannel}
                onChange={setVendorChannel}
                disabled={!canWrite || voided}
              />
            )}
          </>
        )}

        {expenseId && !marketing && (
          <PurposeMark
            value={purpose}
            options={EXPENSE_PURPOSES.filter((p) => p !== "MARKETING")}
            onChange={setPurpose}
            disabled={!canWrite || voided}
          />
        )}

        {error && <p className="text-xs text-red-700">{error}</p>}

        {canWrite && !voided && (
          <div className="flex flex-wrap justify-end gap-2">
            {expenseId && (
              <button
                type="button"
                disabled={voidExp.isPending}
                onClick={() => {
                  if (!window.confirm("Delete this expense? It will drop out of the books.")) return;
                  voidExp.mutate(expenseId, {
                    onSuccess: () => navigate("/expenses"),
                    onError: (err) =>
                      setError(err instanceof Error ? err.message : "Could not delete"),
                  });
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : expenseId ? "Save" : "Save expense"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
