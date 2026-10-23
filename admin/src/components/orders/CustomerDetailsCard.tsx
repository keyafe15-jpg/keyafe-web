import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Mail, Pencil, Phone, Save, X } from "lucide-react";
import {
  useUpdateOrder,
  type AdminOrder,
  type OrderAddressInput,
} from "@/hooks/useAdminOrders";
import { inputClass } from "@/components/form/Field";
import { cn } from "@/lib/cn";

function formatAddress(a: NonNullable<AdminOrder["deliveryAddress"]>): string {
  return [
    a.line1,
    a.line2,
    a.landmark ? `Near ${a.landmark}` : null,
    [a.area, a.city].filter(Boolean).join(", ") || null,
    a.pincode,
  ]
    .filter(Boolean)
    .join(", ");
}

function customerSummary(order: AdminOrder): string {
  const who = order.customerCompanyName
    ? `${order.customerCompanyName} · ${order.customerName}`
    : order.customerName;
  const bits = [who, order.customerPhone];
  if (order.fulfillment === "DELIVERY" && order.deliveryAddress) {
    const dest = [
      order.recipientName && order.recipientName !== order.customerName
        ? `to ${order.recipientName}`
        : null,
      formatAddress(order.deliveryAddress),
    ]
      .filter(Boolean)
      .join(" · ");
    if (dest) bits.push(dest);
  } else {
    bits.push("Pickup · Bakery HQ");
  }
  return bits.join(" · ");
}

function emptyAddr(): OrderAddressInput {
  return {
    line1: "",
    line2: "",
    landmark: "",
    mapSearchQuery: "",
    pincode: "",
    city: "",
    area: "",
  };
}

function fromAddr(a: AdminOrder["deliveryAddress"] | undefined): OrderAddressInput {
  if (!a) return emptyAddr();
  return {
    line1: a.line1 ?? "",
    line2: a.line2 ?? "",
    landmark: a.landmark ?? "",
    mapSearchQuery: a.mapSearchQuery ?? "",
    pincode: a.pincode ?? "",
    city: a.city ?? "",
    area: a.area ?? "",
    state: a.state ?? null,
    stateCode: a.stateCode ?? null,
  };
}

export function CustomerDetailsCard({
  order,
  canEdit,
}: {
  order: AdminOrder;
  canEdit: boolean;
}) {
  const update = useUpdateOrder();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(order.customerName);
  const [phone, setPhone] = useState(order.customerPhone);
  const [email, setEmail] = useState(order.customerEmail ?? "");
  const [company, setCompany] = useState(order.customerCompanyName ?? "");
  const [recipient, setRecipient] = useState(order.recipientName ?? "");
  const [deliveryPhone, setDeliveryPhone] = useState(order.deliveryPhone ?? "");
  const [addr, setAddr] = useState<OrderAddressInput>(fromAddr(order.deliveryAddress));

  useEffect(() => {
    setName(order.customerName);
    setPhone(order.customerPhone);
    setEmail(order.customerEmail ?? "");
    setCompany(order.customerCompanyName ?? "");
    setRecipient(order.recipientName ?? "");
    setDeliveryPhone(order.deliveryPhone ?? "");
    setAddr(fromAddr(order.deliveryAddress));
    setError(null);
  }, [order.id, order.updatedAt]);

  const isDelivery = order.fulfillment === "DELIVERY";

  const save = async () => {
    setError(null);
    if (!name.trim() || phone.trim().length < 7) {
      setError("Name and a valid phone are required.");
      return;
    }
    if (isDelivery && (!addr.line1.trim() || !addr.pincode.trim())) {
      setError("Delivery needs a street address and pincode.");
      return;
    }
    try {
      await update.mutateAsync({
        id: order.id,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim() || null,
        customerCompanyName: company.trim() || null,
        recipientName: isDelivery ? recipient.trim() || null : order.recipientName,
        deliveryPhone: isDelivery ? deliveryPhone.trim() || null : order.deliveryPhone,
        ...(isDelivery
          ? {
              deliveryAddress: {
                ...addr,
                line1: addr.line1.trim(),
                line2: addr.line2?.trim() || null,
                landmark: addr.landmark?.trim() || null,
                mapSearchQuery: addr.mapSearchQuery?.trim() || null,
                pincode: addr.pincode.trim(),
                city: addr.city?.trim() || null,
                area: addr.area?.trim() || null,
              },
            }
          : {}),
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  const rideText =
    isDelivery && order.deliveryAddress
      ? order.deliveryAddress.mapSearchQuery?.trim() || formatAddress(order.deliveryAddress)
      : "";

  return (
    <section className="rounded-card border border-slate-200 bg-white">
      <div className={cn("flex items-start justify-between gap-2 px-4 py-3", editing && "border-b border-slate-100")}>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">Customer</h2>
          {!editing && (
            <>
              <p className="mt-1 text-sm leading-snug text-slate-700">{customerSummary(order)}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <a
                  href={`tel:${order.customerPhone}`}
                  className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {order.customerPhone}
                </a>
                {order.customerEmail && (
                  <a
                    href={`mailto:${order.customerEmail}`}
                    className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {order.customerEmail}
                  </a>
                )}
              </div>
              {rideText && <CopyForRideApp text={rideText} />}
            </>
          )}
        </div>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-50 hover:text-brand-700"
            aria-label="Edit customer details"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {editing ? (
        <form
          className="space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
            <Field label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input
                value={phone}
                inputMode="tel"
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                value={email}
                inputMode="email"
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Company">
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          {isDelivery && (
            <>
              <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                <Field label="Recipient">
                  <input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Delivery phone">
                  <input
                    value={deliveryPhone}
                    inputMode="tel"
                    onChange={(e) => setDeliveryPhone(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Address" className="min-[400px]:col-span-2">
                  <input
                    value={addr.line1}
                    onChange={(e) => setAddr({ ...addr, line1: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Line 2">
                  <input
                    value={addr.line2 ?? ""}
                    onChange={(e) => setAddr({ ...addr, line2: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Landmark">
                  <input
                    value={addr.landmark ?? ""}
                    onChange={(e) => setAddr({ ...addr, landmark: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Area">
                  <input
                    value={addr.area ?? ""}
                    onChange={(e) => setAddr({ ...addr, area: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="City">
                  <input
                    value={addr.city ?? ""}
                    onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Pincode">
                  <input
                    value={addr.pincode}
                    inputMode="numeric"
                    onChange={(e) => setAddr({ ...addr, pincode: e.target.value.replace(/\D/g, "") })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Rapido / Uber search" className="min-[400px]:col-span-2">
                  <input
                    value={addr.mapSearchQuery ?? ""}
                    onChange={(e) => setAddr({ ...addr, mapSearchQuery: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
            </>
          )}
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={update.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {update.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setName(order.customerName);
                setPhone(order.customerPhone);
                setEmail(order.customerEmail ?? "");
                setCompany(order.customerCompanyName ?? "");
                setRecipient(order.recipientName ?? "");
                setDeliveryPhone(order.deliveryPhone ?? "");
                setAddr(fromAddr(order.deliveryAddress));
                setEditing(false);
                setError(null);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function CopyForRideApp({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="mt-2 flex w-full items-center gap-2 rounded-lg border border-brand-500/20 bg-brand-100/50 px-2.5 py-1.5 text-left hover:bg-brand-100"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0 text-brand-700" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold tracking-wide text-brand-700 uppercase">
          {copied ? "Copied" : "Copy for Uber / Rapido"}
        </span>
        <span className="line-clamp-1 text-xs text-slate-700">{text}</span>
      </span>
    </button>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-0.5 block text-[11px] font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
