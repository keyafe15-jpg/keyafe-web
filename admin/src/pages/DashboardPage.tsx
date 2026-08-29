import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarRange,
  Package,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = new Date();
const defaultMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

export function DashboardPage() {
  const [from, setFrom] = useState(toInputDate(defaultMonthStart));
  const [to, setTo] = useState(toInputDate(today));

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
      icon: ShoppingBag,
      accent: "text-slate-700",
      tone: "bg-slate-100",
    },
    {
      label: "Orders this month",
      value: formatNumber(summary.ordersThisMonth),
      icon: Package,
      accent: "text-brand-600",
      tone: "bg-brand-100",
    },
    {
      label: "Overall sales",
      value: formatCurrency(summary.totalSales),
      icon: TrendingUp,
      accent: "text-emerald-600",
      tone: "bg-emerald-100",
    },
    {
      label: "GST received",
      value: formatCurrency(summary.totalGstReceived),
      icon: ArrowUpRight,
      accent: "text-violet-600",
      tone: "bg-violet-100",
    },
    {
      label: "Monthly sales",
      value: formatCurrency(summary.monthlySales),
      icon: ArrowUpRight,
      accent: "text-indigo-600",
      tone: "bg-indigo-100",
    },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Sales and order performance." />

      <div className="mb-5 flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Reporting range
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <CalendarRange className="h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-700 outline-none ring-0 transition focus:border-brand-300"
              />
            </label>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              to
            </span>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-700 outline-none ring-0 transition focus:border-brand-300"
              />
            </label>
          </div>
        </div>

        <div className="rounded-full bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
          Range sales: {formatCurrency(summary.rangeSales)}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-card border border-slate-200 bg-white p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {kpi.label}
                </span>
                <span className={`rounded-md p-1.5 ${kpi.tone} ${kpi.accent}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-semibold text-slate-900">
                {isLoading ? "—" : kpi.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_0.8fr]">
        <PanelCard
          title="Sales over time"
          description="Daily sales for the selected period."
        >
          {chart.length === 0 ? (
            <EmptyState label="No sales recorded for this range." />
          ) : (
            <SalesLineChart chart={chart} peakSales={peakSales} />
          )}
        </PanelCard>

        <PanelCard title="Range summary" description="Selected window totals.">
          <div className="space-y-4">
            <StatLine
              label="Orders in range"
              value={formatNumber(summary.rangeOrders)}
            />
            <StatLine
              label="Sales in range"
              value={formatCurrency(summary.rangeSales)}
            />
            <StatLine
              label="GST in range"
              value={formatCurrency(summary.rangeGstReceived)}
            />
            <StatLine
              label="Monthly sales"
              value={formatCurrency(summary.monthlySales)}
            />
            <StatLine
              label="Overall sales"
              value={formatCurrency(summary.totalSales)}
            />
            <StatLine
              label="Total GST received"
              value={formatCurrency(summary.totalGstReceived)}
            />
          </div>
        </PanelCard>
      </div>
    </div>
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
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>
      <div className="p-4">{children}</div>
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
    const x =
      padding + (index / Math.max(chart.length - 1, 1)) * (width - padding * 2);
    const y =
      height -
      padding -
      (point.sales / Math.max(peakSales, 1)) * (height - padding * 2);
    return { x, y, point, index };
  });

  const area = `${points[0]?.x ?? padding},${height - padding} ${points
    .map(({ x, y }) => `${x},${y}`)
    .join(
      " ",
    )} ${width - padding},${height - padding} ${padding},${height - padding}`;

  return (
    <div className="h-64 w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
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
            <circle
              cx={x}
              cy={y}
              r="4"
              fill="#fff"
              stroke="#e31c79"
              strokeWidth="2"
            />
            <title>{`${point.label}: ${formatCurrency(point.sales)} (${point.orders} orders)`}</title>
          </g>
        ))}

        {chart.map((point, index) => {
          if (index % labelStep !== 0 && index !== chart.length - 1)
            return null;

          const x =
            padding +
            (index / Math.max(chart.length - 1, 1)) * (width - padding * 2);

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
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
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
