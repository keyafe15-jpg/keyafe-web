import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Field, inputClass, selectClass, textareaClass } from "@/components/form/Field";
import { toInputDate } from "@/lib/dateRange";
import { useStaffPermission } from "@/lib/permissions";
import { useAdminVendors } from "@/hooks/useAdminVendors";
import {
  useAdminExpense,
  useCreateExpense,
  useExpenseCategories,
  useUpdateExpense,
  useVoidExpense,
} from "@/hooks/useAdminBooks";
import {
  BOOKS_PAY_METHODS,
  EXPENSE_PURPOSES,
  payLabel,
  type BooksPaymentMethod,
  type ExpensePurpose,
} from "@/pages/expenses/books-ui";
import { SearchCreate } from "@/pages/expenses/SearchCreate";
import { ExpenseCategoryField } from "@/pages/expenses/ExpenseCategoryField";
import { PaidByField } from "@/pages/expenses/PaidByField";
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
              amount: String(existing.data.amount),
              category: existing.data.category.slug,
              purpose: existing.data.purpose,
              paymentMethod: existing.data.paymentMethod,
              paidById: existing.data.paidById,
              notes: existing.data.notes ?? "",
              vendorId: existing.data.vendorId,
              vendorName: existing.data.vendor?.name ?? "",
              vendorChannel: existing.data.vendor?.channel ?? "OFFLINE",
              voidedAt: existing.data.voidedAt,
            }
          : {
              date: toInputDate(new Date()),
              amount: "",
              category: "salary",
              purpose: "OPS",
              paymentMethod: "CASH",
              paidById: null,
              notes: "",
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
    category: string;
    purpose: ExpensePurpose;
    paymentMethod: BooksPaymentMethod;
    paidById: string | null;
    notes: string;
    vendorId: string | null;
    vendorName: string;
    vendorChannel: VendorChannel;
    voidedAt: string | null;
  };
}) {
  const navigate = useNavigate();
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
  const [notes, setNotes] = useState(initial.notes);
  const [vendorId, setVendorId] = useState<string | undefined>(initial.vendorId ?? undefined);
  const [vendorName, setVendorName] = useState(initial.vendorName);
  const [vendorChannel, setVendorChannel] = useState<VendorChannel>(initial.vendorChannel);
  const [vendorQuery, setVendorQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const voided = Boolean(initial.voidedAt);
  const pending = create.isPending || update.isPending;
  const vendors = useAdminVendors({ search: vendorQuery || null, active: "ACTIVE", pageSize: 20 });

  const cat = (categories.data?.items ?? []).find((c) => c.slug === category || c.id === category);
  const marketing = Boolean(cat?.marketing);
  const requiresNote = Boolean(cat?.requiresNote);

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

      <form
        className="mt-4 space-y-3 rounded-card border border-slate-200 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setSaved(false);
          const n = Number(amount);
          if (!(n > 0)) {
            setError("Enter an amount.");
            return;
          }
          if (requiresNote && !notes.trim()) {
            setError("Add a note for miscellaneous.");
            return;
          }
          if (!paidById) {
            setError("Who paid for this?");
            return;
          }
          const body = {
            date,
            amount: n,
            category,
            purpose: marketing ? ("MARKETING" as const) : purpose,
            paymentMethod,
            paidBy: paidById,
            notes: notes.trim() || null,
            vendor: vendorId
              ? { id: vendorId, channel: vendorChannel }
              : vendorName.trim()
                ? { name: vendorName.trim(), channel: vendorChannel }
                : null,
          };
          if (expenseId) {
            update.mutate(
              { id: expenseId, ...body },
              {
                onSuccess: () => setSaved(true),
                onError: (err) => setError(err instanceof Error ? err.message : "Could not save"),
              },
            );
          } else {
            create.mutate(body, {
              onSuccess: (row) => navigate(`/expenses/${row.id}`, { replace: true }),
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
          <Field label="Amount" required>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              disabled={!canWrite || voided}
            />
          </Field>
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
          <PaidByField
            value={paidById}
            onChange={setPaidById}
            disabled={!canWrite || voided}
            required
            autofill={!expenseId}
            hint="Whose cash / UPI / bank this left."
          />
        </div>

        <Field label="Vendor" hint="Optional — gas guy, Meta, the landlord…">
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

        {expenseId && !marketing && (
          <PurposeMark
            value={purpose}
            options={EXPENSE_PURPOSES.filter((p) => p !== "MARKETING")}
            onChange={setPurpose}
            disabled={!canWrite || voided}
          />
        )}

        <Field label="Note" required={requiresNote} hint={requiresNote ? "Required for miscellaneous." : undefined}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={textareaClass}
            disabled={!canWrite || voided}
          />
        </Field>

        {error && <p className="text-xs text-red-700">{error}</p>}
        {saved && <p className="text-xs text-emerald-700">Saved.</p>}

        {canWrite && !voided && (
          <div className="flex flex-wrap justify-end gap-2">
            {expenseId && (
              <button
                type="button"
                disabled={voidExp.isPending}
                onClick={() => {
                  if (!window.confirm("Void this expense? It will drop out of the books.")) return;
                  voidExp.mutate(expenseId, {
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
              {pending ? "Saving…" : expenseId ? "Save" : "Save expense"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
