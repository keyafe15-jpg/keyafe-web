import { useEffect, useState } from "react";
import { Search, X, ChevronRight, Layers } from "lucide-react";
import {
  useAdminCustomers,
  type AdminCustomer,
  type CustomerActiveFilter,
  type CustomerRegisteredFilter,
} from "@/hooks/useAdminCustomers";
import { CustomerDetailDrawer } from "@/pages/customers/CustomerDetailDrawer";
import { PaginationControls } from "@/components/ClientPagination";
import { inputClass } from "@/components/form/Field";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 20;

const TYPE_TABS: { key: CustomerRegisteredFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "REGISTERED", label: "Registered" },
  { key: "GUEST", label: "Guest" },
];

const STATUS_TABS: { key: CustomerActiveFilter; label: string }[] = [
  { key: "ALL", label: "Any status" },
  { key: "ACTIVE", label: "Active" },
  { key: "INACTIVE", label: "Disabled" },
];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CustomersListPage() {
  const [page, setPage] = useState(1);
  const [typeTab, setTypeTab] = useState<CustomerRegisteredFilter>("ALL");
  const [statusTab, setStatusTab] = useState<CustomerActiveFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const { data, isLoading, isFetching } = useAdminCustomers({
    page,
    pageSize: PAGE_SIZE,
    search: search || null,
    active: statusTab,
    registered: typeTab,
  });
  const customers = data?.items ?? [];
  const total = data?.total ?? 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const searching = search.length > 0;

  const changeTypeTab = (t: CustomerRegisteredFilter) => {
    setTypeTab(t);
    setPage(1);
  };

  const changeStatusTab = (t: CustomerActiveFilter) => {
    setStatusTab(t);
    setPage(1);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
        <p className="mt-1 text-sm text-slate-500">
          {searching
            ? `${total} match${total === 1 ? "" : "es"} for “${search}”`
            : "Contacts grouped by phone & email — click a row for full history."}
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1">
            {TYPE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => changeTypeTab(t.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  typeTab === t.key
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative w-full max-w-md lg:w-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, phone, or email…"
              className={cn(inputClass, "w-full pl-9 pr-9")}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => changeStatusTab(t.key)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                statusTab === t.key
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        )}
        {!isLoading && customers.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            {searching ? (
              <>No customers match “{search}”.</>
            ) : typeTab === "GUEST" ? (
              "No guest customers yet."
            ) : typeTab === "REGISTERED" ? (
              "No registered customers yet."
            ) : (
              "No customers yet."
            )}
          </div>
        )}
        {!isLoading && customers.length > 0 && (
          <>
            {isFetching && !isLoading && (
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                Updating results…
              </div>
            )}
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Phone</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium text-right">Orders</th>
                  <th className="px-4 py-2 font-medium">First seen</th>
                  <th className="px-4 py-2 font-medium">Signals</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{c.name}</p>
                      {!c.isActive && (
                        <span className="mt-0.5 inline-flex rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-600">
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {c.phone}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {c.email ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium tabular-nums text-slate-900">
                        {c.totalOrderCount}
                      </p>
                      {c.guestCheckoutCount > 0 && (
                        <p className="text-[10px] text-amber-700">
                          {c.guestCheckoutCount} guest
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <ContactSignals customer={c} />
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge customer={c} />
                    </td>
                    <td className="px-2 py-3 text-slate-300">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              page={data?.page ?? 1}
              pageCount={data?.totalPages ?? 1}
              total={total}
              firstItem={
                data && data.total > 0
                  ? (data.page - 1) * data.pageSize + 1
                  : 0
              }
              lastItem={
                data ? Math.min(data.page * data.pageSize, data.total) : 0
              }
              onPageChange={setPage}
              noun="customers"
              className="mx-4 mb-4"
            />
          </>
        )}
      </div>

      <CustomerDetailDrawer
        customer={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function ContactSignals({ customer }: { customer: AdminCustomer }) {
  const chips: string[] = [];
  if (customer.isOrderOnly) chips.push("Orders only");
  if (customer.nameVariants.length > 0) chips.push("Multiple names");
  if (customer.emailVariants.length > 0) chips.push("Multiple emails");
  if (customer.phoneVariants.length > 0) chips.push("Multiple phones");
  if (customer.guestCheckoutCount > 0 && customer.isRegistered) {
    chips.push("Guest checkouts");
  }

  if (chips.length === 0) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip) => (
        <span
          key={chip}
          className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
        >
          {chip === "Guest checkouts" || chip === "Multiple names" ? (
            <Layers className="h-2.5 w-2.5" />
          ) : null}
          {chip}
        </span>
      ))}
    </div>
  );
}

function TypeBadge({ customer }: { customer: AdminCustomer }) {
  if (customer.isOrderOnly) {
    return (
      <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
        Order contact
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        customer.isRegistered
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-800",
      )}
    >
      {customer.isRegistered ? "Registered" : "Guest"}
    </span>
  );
}
