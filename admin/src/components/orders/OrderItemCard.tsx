import { useState } from "react";
import { ImageOff, Pencil } from "lucide-react";
import type { AdminOrder } from "@/hooks/useAdminOrders";
import { inputClass, selectClass } from "@/components/form/Field";
import { ImageLightboxThumb } from "@/components/ui/ImageLightboxThumb";
import { TIME_SLOTS } from "@/content/slots";
import { cn } from "@/lib/cn";

type OrderItem = AdminOrder["items"][number];

export interface ItemSchedulePayload {
  id: string;
  deliveryDate: string | null;
  deliverySlotKey: string | null;
  deliverySlotLabel: string | null;
}

function toYmd(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function slotLabelFor(key: string) {
  const known = TIME_SLOTS.find((s) => s.key === key);
  if (known) return known.label;
  if (key === "SAME_DAY") return "Same day";
  return key;
}

function scheduleText(item: OrderItem) {
  if (!item.deliveryDate || !item.deliverySlotLabel) return "Ships pan-India via courier";
  const date = new Date(item.deliveryDate).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${date} · ${item.deliverySlotLabel}`;
}

export function SlotSelect({
  value,
  onChange,
  extraKey,
  extraLabel,
  disabled,
  className,
}: {
  value: string;
  onChange: (key: string) => void;
  extraKey?: string | null;
  extraLabel?: string | null;
  disabled?: boolean;
  className?: string;
}) {
  const extra =
    extraKey && !TIME_SLOTS.some((s) => s.key === extraKey)
      ? { key: extraKey, label: extraLabel || extraKey }
      : null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(selectClass, "min-w-0", className)}
    >
      {extra && <option value={extra.key}>{extra.label}</option>}
      {TIME_SLOTS.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

/**
 * One ordered item. The delivery date and slot read as plain text; when
 * `onSaveSchedule` is given, a pen icon opens an inline editor for them.
 */
export function OrderItemCard({
  item,
  pending = false,
  onSaveSchedule,
}: {
  item: OrderItem;
  pending?: boolean;
  onSaveSchedule?: (payload: ItemSchedulePayload) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const thumb = item.referenceImageUrl ?? item.productImage;

  return (
    <div className="py-3">
      <div className="flex items-start gap-3">
        {thumb ? (
          <ImageLightboxThumb src={thumb} alt={item.productName} className="h-14 w-14" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
            <ImageOff className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{item.productName}</p>
          <p className="text-xs text-slate-500">
            {[item.sizeLabel, item.flavourName].filter(Boolean).join(" · ")}
          </p>
          {item.description && (
            <p className="mt-0.5 text-xs whitespace-pre-line text-slate-700">{item.description}</p>
          )}
          {item.messageOnCake && (
            <p className="text-xs text-slate-600 italic">Message: "{item.messageOnCake}"</p>
          )}
          {item.instructions && (
            <p className="text-xs text-slate-600">Notes: {item.instructions}</p>
          )}
          <div className="mt-1 flex items-start gap-1">
            <p className="text-[11px] font-medium text-brand-700">{scheduleText(item)}</p>
            {onSaveSchedule && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="-my-1 shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-700"
                aria-label="Change delivery date and slot"
                title="Change delivery date and slot"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-slate-500">
            ₹{Number(item.unitPrice).toFixed(0)} × {item.qty}
          </p>
          <p className="font-medium text-slate-900 tabular-nums">
            ₹{Number(item.lineTotal).toFixed(2)}
          </p>
          {item.gstRate !== null && (
            <p className="mt-0.5 text-[11px] text-slate-400">
              {item.hsnCode ? `HSN ${item.hsnCode} · ` : ""}
              GST {Number(item.gstRate)}%
            </p>
          )}
        </div>
      </div>

      {onSaveSchedule && editing && (
        <div className="sm:pl-[68px]">
          <ItemScheduleEditor
            item={item}
            pending={pending}
            onSave={onSaveSchedule}
            onClose={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  );
}

function ItemScheduleEditor({
  item,
  pending,
  onSave,
  onClose,
}: {
  item: OrderItem;
  pending: boolean;
  onSave: (payload: ItemSchedulePayload) => Promise<unknown>;
  onClose: () => void;
}) {
  const [date, setDate] = useState(toYmd(item.deliveryDate));
  const [slotKey, setSlotKey] = useState(item.deliverySlotKey || TIME_SLOTS[0].key);
  const [error, setError] = useState<string | null>(null);

  const originalDate = toYmd(item.deliveryDate);
  const originalSlot = item.deliverySlotKey || "";
  const dirty = date !== originalDate || (date ? slotKey !== originalSlot : false);

  const save = async () => {
    setError(null);
    try {
      await onSave({
        id: item.id,
        deliveryDate: date || null,
        deliverySlotKey: date ? slotKey : null,
        deliverySlotLabel: date ? slotLabelFor(slotKey) : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
      <div className="flex flex-wrap items-end gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={cn(inputClass, "w-auto py-1.5 text-xs")}
          aria-label="Delivery date"
        />
        <div className="min-w-40 flex-1 sm:max-w-64">
          <SlotSelect
            value={slotKey}
            onChange={setSlotKey}
            extraKey={item.deliverySlotKey}
            extraLabel={item.deliverySlotLabel}
            disabled={pending}
            className="py-1.5 text-xs"
          />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={pending || !dirty || (!!date && !slotKey)}
          onClick={() => void save()}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-brand-600">{error}</p>}
    </div>
  );
}
