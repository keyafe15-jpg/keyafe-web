import { ShoppingBag, Package, Ticket, TrendingUp } from "lucide-react";

const KPIS = [
  { label: "Orders today", value: "—", icon: ShoppingBag, delta: null },
  { label: "Active products", value: "—", icon: Package, delta: null },
  { label: "Active coupons", value: "—", icon: Ticket, delta: null },
  { label: "Revenue this month", value: "—", icon: TrendingUp, delta: null },
];

export function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="What's happening today." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((kpi) => {
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
                <span className="rounded-md bg-slate-100 p-1.5 text-slate-500">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-semibold text-slate-900">
                {kpi.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <PanelCard
          title="Recent orders"
          description="Last 10 orders across all channels."
        >
          <EmptyState label="No orders yet." />
        </PanelCard>
        <PanelCard
          title="Low availability"
          description="Products flagged as unavailable."
        >
          <EmptyState label="Nothing to review." />
        </PanelCard>
        <PanelCard title="Same-day store" description="Live open/close state.">
          <EmptyState label="Wire status here." />
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

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
      {label}
    </p>
  );
}
