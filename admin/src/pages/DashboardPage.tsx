import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Package,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/money";
import { customLabel, monthRange, toInputDate } from "@/lib/dateRange";
import { useAdminAuth } from "@/store/adminAuth";
import { staffHasPermission } from "@/lib/permissions";
import { useCollectionsSummary, type CollectionsScope } from "@/hooks/useCollections";
import { GstExportPanel } from "@/pages/orders/GstExportPanel";
import { OrdersBackupPanel } from "@/pages/orders/OrdersBackupPanel";
import { PendingPaymentsDrawer } from "@/pages/dashboard/PendingPaymentsDrawer";

interface DashboardAnalyticsResponse {
  summary: {
    totalOrdersReceived: number;
    totalSales: number;
    totalGstReceived: number;
    ordersThisMonth: number;
    monthlySales: number;
    monthlyGstReceived: number;
    rangeOrders: number;
    rangeSales: number;
    rangeGstReceived: number;
  };
  chart: Array<{
    date: string;
    label: string;
    sales: number;
    orders: number;
  }>;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

const COMPACT_FROM = 10_00_000;

/** ₹12.5L / ₹1.2Cr — used on narrow screens where full figures don't fit two-up. */
function formatCompact(value: number, currency: boolean) {
  if (Math.abs(value) < COMPACT_FROM) return null;
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
    ...(currency && { style: "currency", currency: "INR" }),
  }).format(value);
}

type Preset = "this-month" | "last-month" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "custom", label: "Custom" },
];

export function DashboardPage() {
  const [preset, setPreset] = useState<Preset>("this-month");
  const [customFrom, setCustomFrom] = useState(() => monthRange(0).from);
  const [customTo, setCustomTo] = useState(() => toInputDate(new Date()));
  const [showMore, setShowMore] = useState(false);
  const [drawer, setDrawer] = useState<{ scope: CollectionsScope; label: string } | null>(null);
  const user = useAdminAuth((s) => s.user);
  const canReadDashboard = staffHasPermission(user, "dashboard.read");

  const range =
    preset === "custom"
      ? { from: customFrom, to: customTo, label: customLabel(customFrom, customTo) }
      : monthRange(preset === "this-month" ? 0 : -1);
  const { from, to } = range;
  const rangeValid = !!from && !!to && from <= to;

  const collections = useCollectionsSummary(from, to, canReadDashboard && rangeValid);
  const money = collections.data?.range;
  const outstanding = collections.data?.outstandingAllTime;
  const collectedPct =
    money && money.sales > 0 ? Math.round((money.received / money.sales) * 100) : null;
  const stallHint =
    money && money.stall.sales > 0 ? `incl. stall ${formatINR(money.stall.sales)}` : undefined;

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params;
  }, [from, to]);

  const { data, isLoading } = useQuery<DashboardAnalyticsResponse>({
    queryKey: ["admin", "orders", "analytics", from, to],
    queryFn: () =>
      api.get<DashboardAnalyticsResponse>(
        `/admin/orders/analytics${queryParams.size ? `?${queryParams.toString()}` : ""}`,
      ),
    staleTime: 30_000,
    enabled: canReadDashboard && rangeValid && showMore,
  });

  const summary = data?.summary ?? {
    totalOrdersReceived: 0,
    totalSales: 0,
    totalGstReceived: 0,
    ordersThisMonth: 0,
    monthlySales: 0,
    monthlyGstReceived: 0,
    rangeOrders: 0,
    rangeSales: 0,
    rangeGstReceived: 0,
  };

  const chart = data?.chart ?? [];
  const peakSales = Math.max(...chart.map((point) => point.sales), 1);

  const kpis = [
    {
      label: "Total orders received",
      value: formatNumber(summary.totalOrdersReceived),
      compact: formatCompact(summary.totalOrdersReceived, false),
      icon: ShoppingBag,
      accent: "text-slate-700",
      tone: "bg-slate-100",
    },
    {
      label: "Orders this month",
      value: formatNumber(summary.ordersThisMonth),
      compact: formatCompact(summary.ordersThisMonth, false),
      icon: Package,
      accent: "text-brand-600",
      tone: "bg-brand-100",
    },
    {
      label: "Overall sales",
      value: formatINR(summary.totalSales),
      compact: formatCompact(summary.totalSales, true),
      icon: TrendingUp,
      accent: "text-emerald-600",
      tone: "bg-emerald-100",
    },
    {
      label: "Monthly sales",
      value: formatINR(summary.monthlySales),
      compact: formatCompact(summary.monthlySales, true),
      icon: ArrowUpRight,
      accent: "text-indigo-600",
      tone: "bg-indigo-100",
    },
    {
      label: "GST received",
      value: formatINR(summary.totalGstReceived),
      compact: formatCompact(summary.totalGstReceived, true),
      icon: ArrowUpRight,
      accent: "text-violet-600",
      tone: "bg-violet-100",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Money collected and still pending, by delivery date."
      />

      <div className="mb-4 flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-3 sm:mb-5 sm:p-4 md:flex-row md:items-center md:justify-between">
        <div
          role="tablist"
          aria-label="Reporting range"
          className="flex self-start rounded-lg border border-slate-200 bg-slate-50 p-0.5"
        >
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={preset === p.key}
              onClick={() => setPreset(p.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
                preset === p.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-600 sm:flex-none">
              <CalendarRange className="hidden h-4 w-4 text-slate-400 sm:block" />
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                aria-label="From date"
                className="focus:border-brand-300 w-full min-w-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-700 ring-0 transition outline-none sm:w-auto"
              />
            </label>
            <span className="shrink-0 text-xs tracking-[0.2em] text-slate-400 uppercase">to</span>
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-600 sm:flex-none">
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                aria-label="To date"
                className="focus:border-brand-300 w-full min-w-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-700 ring-0 transition outline-none sm:w-auto"
              />
            </label>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-800">{range.label}</span> · by delivery date
          </p>
        )}
      </div>

      {!rangeValid && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Pick a start date on or before the end date.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <MoneyCard
          label="Total sales"
          value={money ? formatINR(money.sales) : "—"}
          hint={stallHint}
        />
        <MoneyCard
          label="Received"
          value={money ? formatINR(money.received) : "—"}
          hint={
            [collectedPct == null ? null : `${collectedPct}% collected`, stallHint]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          valueClassName="text-emerald-700"
        />
        <MoneyCard
          label="Pending"
          value={money ? formatINR(money.pending) : "—"}
          hint={
            !money
              ? undefined
              : money.pendingOrders > 0
                ? `${money.pendingOrders} order${money.pendingOrders === 1 ? "" : "s"} · see who owes`
                : "All paid"
          }
          valueClassName="text-amber-700"
          className="col-span-2 border-amber-200 bg-amber-50/40 sm:col-span-1"
          onClick={
            money && money.pending > 0
              ? () =>
                  setDrawer({
                    scope: { from, to },
                    label: `${range.label} · by delivery date`,
                  })
              : undefined
          }
        />
      </div>

      {outstanding && outstanding.pending > 0 && (
        <button
          type="button"
          onClick={() => setDrawer({ scope: "all", label: "All orders, all time" })}
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-card border border-slate-200 bg-white px-3 py-2.5 text-left text-sm transition hover:border-amber-300 sm:px-4"
        >
          <span className="text-slate-600">
            Outstanding across all orders:{" "}
            <span className="font-semibold text-amber-700 tabular-nums">
              {formatINR(outstanding.pending)}
            </span>{" "}
            from {outstanding.customers} customer{outstanding.customers === 1 ? "" : "s"}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      )}

      <section className="mt-4 rounded-card border border-slate-200 bg-white sm:mt-6">
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          aria-expanded={showMore}
          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left sm:px-4"
        >
          <span>
            <span className="block text-sm font-semibold text-slate-900">More stats</span>
            <span className="block text-xs text-slate-500">
              Order counts, overall sales, GST and the daily sales chart
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform",
              showMore && "rotate-180",
            )}
          />
        </button>

        {showMore && (
          <div className="border-t border-slate-100 p-3 sm:p-4">
            <p className="mb-3 text-xs text-slate-500">
              These figures count orders by the date they were placed, for{" "}
              <span className="font-medium text-slate-700">{range.label}</span>.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
              {kpis.map((kpi, index) => {
                const Icon = kpi.icon;
                const isLastOdd = index === kpis.length - 1 && kpis.length % 2 === 1;
                return (
                  <div
                    key={kpi.label}
                    className={cn(
                      "min-w-0 rounded-card border border-slate-200 bg-white p-3 sm:p-4",
                      isLastOdd && "col-span-2 xl:col-span-1",
                    )}
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-2 sm:mb-3 sm:items-center">
                      <span className="line-clamp-2 text-[11px] leading-tight font-medium tracking-wide text-slate-500 uppercase sm:text-xs">
                        {kpi.label}
                      </span>
                      <span
                        className={cn("shrink-0 rounded-md p-1 sm:p-1.5", kpi.tone, kpi.accent)}
                      >
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </span>
                    </div>
                    <p
                      className="truncate text-xl font-semibold text-slate-900 tabular-nums sm:text-2xl"
                      title={kpi.value}
                    >
                      {isLoading ? (
                        "—"
                      ) : kpi.compact ? (
                        <>
                          <span className="sm:hidden">{kpi.compact}</span>
                          <span className="hidden sm:inline">{kpi.value}</span>
                        </>
                      ) : (
                        kpi.value
                      )}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 sm:gap-4 lg:grid-cols-[1.5fr_0.8fr]">
              <PanelCard title="Sales over time" description="Daily sales for the selected period.">
                {chart.length === 0 ? (
                  <EmptyState label="No sales recorded for this range." />
                ) : (
                  <SalesLineChart chart={chart} peakSales={peakSales} />
                )}
              </PanelCard>

              <PanelCard title="Range summary" description="Selected window totals.">
                <div className="-my-1.5 divide-y divide-slate-100">
                  <StatLine label="Orders in range" value={formatNumber(summary.rangeOrders)} />
                  <StatLine label="Sales in range" value={formatINR(summary.rangeSales)} />
                  <StatLine label="GST in range" value={formatINR(summary.rangeGstReceived)} />
                  <StatLine label="Monthly sales" value={formatINR(summary.monthlySales)} />
                  <StatLine label="Overall sales" value={formatINR(summary.totalSales)} />
                  <StatLine
                    label="Total GST received"
                    value={formatINR(summary.totalGstReceived)}
                  />
                </div>
              </PanelCard>
            </div>
          </div>
        )}
      </section>

      <div className="mt-6 space-y-4">
        <GstExportPanel />
        <OrdersBackupPanel />
      </div>

      <PendingPaymentsDrawer
        scope={drawer?.scope ?? null}
        label={drawer?.label ?? ""}
        onClose={() => setDrawer(null)}
      />
    </div>
  );
}

function MoneyCard({
  label,
  value,
  hint,
  valueClassName,
  className,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
  className?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-[11px] font-medium tracking-wide text-slate-500 uppercase sm:text-xs">
        {label}
        {onClick && <ChevronRight className="h-4 w-4 text-amber-600" />}
      </span>
      <span
        className={cn(
          "mt-1.5 block truncate text-xl font-semibold text-slate-900 tabular-nums sm:text-2xl",
          valueClassName,
        )}
        title={value}
      >
        {value}
      </span>
      {hint && <span className="mt-0.5 block text-xs leading-snug text-slate-500">{hint}</span>}
    </>
  );

  const base = cn(
    "min-w-0 rounded-card border border-slate-200 bg-white p-3 text-left sm:p-4",
    className,
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(base, "transition hover:border-amber-400 hover:shadow-sm")}
    >
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

function PanelCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-2.5 sm:px-4 sm:py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

function SalesLineChart({
  chart,
  peakSales,
}: {
  chart: Array<{ date: string; label: string; sales: number; orders: number }>;
  peakSales: number;
}) {
  const width = 760;
  const height = 240;
  const padding = 24;
  const labelStep = Math.max(1, Math.ceil(chart.length / 8));

  const points = chart.map((point, index) => {
    const x = padding + (index / Math.max(chart.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (point.sales / Math.max(peakSales, 1)) * (height - padding * 2);
    return { x, y, point, index };
  });

  const area = `${points[0]?.x ?? padding},${height - padding} ${points
    .map(({ x, y }) => `${x},${y}`)
    .join(" ")} ${width - padding},${height - padding} ${padding},${height - padding}`;

  return (
    <div className="w-full overflow-hidden sm:h-64">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full sm:h-full">
        {[0, 25, 50, 75, 100].map((step) => {
          const y = padding + ((100 - step) / 100) * (height - padding * 2);
          return (
            <line
              key={step}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray="4 4"
            />
          );
        })}

        <polygon points={area} fill="rgba(227, 28, 121, 0.12)" stroke="none" />

        <polyline
          points={points.map(({ x, y }) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#e31c79"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map(({ x, y, point }) => (
          <g key={point.date}>
            <circle cx={x} cy={y} r="4" fill="#fff" stroke="#e31c79" strokeWidth="2" />
            <title>{`${point.label}: ${formatINR(point.sales)} (${point.orders} orders)`}</title>
          </g>
        ))}

        {chart.map((point, index) => {
          if (index % labelStep !== 0 && index !== chart.length - 1) return null;

          const x = padding + (index / Math.max(chart.length - 1, 1)) * (width - padding * 2);

          return (
            <text
              key={`${point.date}-label`}
              x={x}
              y={height - 6}
              textAnchor="middle"
              fontSize="9"
              fill="#64748b"
            >
              {point.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 sm:py-2.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
      {label}
    </p>
  );
}
