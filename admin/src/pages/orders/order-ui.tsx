import { Globe, Link2, PhoneCall } from "lucide-react";
import type { OrderSource, OrderStatus } from "@/hooks/useAdminOrders";
import { cn } from "@/lib/cn";

export const STATUS_FLOW: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "IN_KITCHEN",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export function nextStatus(current: OrderStatus): OrderStatus | null {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1] ?? null;
}

export function nextStatusLabel(next: OrderStatus): string {
  const labels: Partial<Record<OrderStatus, string>> = {
    CONFIRMED: "Confirm",
    IN_KITCHEN: "Start kitchen",
    READY: "Mark ready",
    OUT_FOR_DELIVERY: "Out for delivery",
    DELIVERED: "Mark delivered",
  };
  return labels[next] ?? next.toLowerCase().replace(/_/g, " ");
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-slate-100 text-slate-700" },
    CONFIRMED: { label: "Confirmed", className: "bg-blue-50 text-blue-700" },
    IN_KITCHEN: {
      label: "In kitchen",
      className: "bg-amber-50 text-amber-700",
    },
    READY: { label: "Ready", className: "bg-emerald-50 text-emerald-700" },
    OUT_FOR_DELIVERY: {
      label: "Out for delivery",
      className: "bg-brand-100 text-brand-700",
    },
    DELIVERED: {
      label: "Delivered",
      className:
        "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20",
    },
    CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-700" },
  };
  const cfg = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}

export function SourceBadge({ source }: { source: OrderSource }) {
  const map: Record<
    OrderSource,
    { label: string; className: string; Icon: typeof Globe }
  > = {
    STOREFRONT: {
      label: "Storefront",
      className: "bg-sky-100 text-sky-800",
      Icon: Globe,
    },
    OFFLINE_LINK: {
      label: "Link",
      className: "bg-brand-100 text-brand-800",
      Icon: Link2,
    },
    OFFLINE_DIRECT: {
      label: "Offline",
      className: "bg-amber-100 text-amber-800",
      Icon: PhoneCall,
    },
  };
  const cfg = map[source];
  const Icon = cfg.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        cfg.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

export function deliveryIso(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
