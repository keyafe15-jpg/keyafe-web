import { useState } from "react";
import { Pencil } from "lucide-react";
import type { AdminOrder } from "@/hooks/useAdminOrders";
import { inputClass, selectClass } from "@/components/form/Field";
import { listedItemImages } from "@/components/orders/RefImageStrip";
import { OrderItemSummary } from "@/components/orders/OrderItemSummary";
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

function scheduleText(item: Pick<OrderItem, "deliveryDate" | "deliverySlotLabel">) {
  if (!item.deliveryDate || !item.deliverySlotLabel) return "Ships pan-India via courier";
  const date = new Date(item.deliveryDate).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
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
export function OrderItemScheduleFooter({
  item,
  pending = false,
  onSaveSchedule,
  showEditButton = true,
  editorOpen = false,
}: {
  item: Pick<OrderItem, "id" | "deliveryDate" | "deliverySlotKey" | "deliverySlotLabel">;
  pending?: boolean;
  onSaveSchedule?: (payload: ItemSchedulePayload) => Promise<unknown>;
  showEditButton?: boolean;
  /** When true, the date/slot fields are shown without a second pen. */
  editorOpen?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const open = editorOpen || editing;
  return (
    <>
      {!open && (
        <div className="flex items-start gap-1">
          <p className="min-w-0 text-[11px] font-medium leading-snug break-words text-brand-700">
            {scheduleText(item)}
          </p>
          {onSaveSchedule && showEditButton && (
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
      )}
      {onSaveSchedule && open && (
        <ItemScheduleEditor
          item={item}
          pending={pending}
          onSave={onSaveSchedule}
          onClose={() => setEditing(false)}
          embedded={editorOpen}
        />
      )}
    </>
  );
}

export function OrderItemCard({
  item,
  pending = false,
  onSaveSchedule,
}: {
  item: OrderItem;
  pending?: boolean;
  onSaveSchedule?: (payload: ItemSchedulePayload) => Promise<unknown>;
}) {
  return (
    <div className="py-3">
      <OrderItemSummary
        item={{
          name: item.productName,
          qty: item.qty,
          imageUrls: listedItemImages(item),
          sizeLine: item.sizeLabel || undefined,
          flavour: item.flavourName || undefined,
          description: item.description || undefined,
          messageOnCake: item.messageOnCake,
          instructions: item.instructions,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
        }}
        footer={
          <OrderItemScheduleFooter
            item={item}
            pending={pending}
            onSaveSchedule={onSaveSchedule}
          />
        }
      />
    </div>
  );
}

function ItemScheduleEditor({
  item,
  pending,
  onSave,
  onClose,
  embedded = false,
}: {
  item: Pick<OrderItem, "id" | "deliveryDate" | "deliverySlotKey" | "deliverySlotLabel">;
  pending: boolean;
  onSave: (payload: ItemSchedulePayload) => Promise<unknown>;
  onClose: () => void;
  embedded?: boolean;
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
      if (!embedded) onClose();
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
        {!embedded && (
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-brand-600">{error}</p>}
    </div>
  );
}
