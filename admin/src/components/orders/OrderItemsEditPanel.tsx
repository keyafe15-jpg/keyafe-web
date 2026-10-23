import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useEditOrderItems,
  type AdminOrder,
  type AdminOrderItem,
} from "@/hooks/useAdminOrders";
import { useAdminAddons } from "@/hooks/useAddons";
import { useAdminFlavours } from "@/hooks/useFlavours";
import { inputClass, textareaClass } from "@/components/form/Field";
import { SearchableSelect } from "@/components/form/SearchableSelect";
import { QtyStepper } from "@/components/form/QtyStepper";
import { DeliveryPaidToField } from "@/components/form/DeliveryPaidToField";
import {
  AddonGroupPicker,
  addonIdsFromHint,
  composeAddonNotes,
  leftoverNotesAfterAddons,
  mergeInstructions,
} from "@/components/order-items";
import { RefImagesPicker } from "@/components/order-items/RefImagesPicker";
import { ReorderHandle, ReorderList } from "@/components/reorder/ReorderList";
import { uploadImage } from "@/lib/uploads";
import { cn } from "@/lib/cn";
import { isZeroExtraCharge } from "@/lib/extraCharge";

type DraftLine = {
  key: string;
  id?: string;
  productId: string | null;
  productName: string;
  sizeLabel: string;
  sizeGrams: string;
  flavourId: string;
  flavourName: string;
  messageOnCake: string;
  instructions: string;
  description: string;
  showDescription: boolean;
  unitPrice: string;
  qty: string;
  referenceImageUrls: string[];
  refFiles: File[];
  /** Add-ons picked in this edit; their price is already in unitPrice. */
  addonSelections: string[];
  showAddons: boolean;
};

function matchFlavourId(
  flavourId: string | null | undefined,
  flavourName: string | null | undefined,
  flavours: Array<{ id: string; name: string }>,
): string {
  if (flavourId && flavours.some((f) => f.id === flavourId)) return flavourId;
  const n = flavourName?.trim().toLowerCase();
  if (n) {
    const hit = flavours.find((f) => f.name.trim().toLowerCase() === n);
    if (hit) return hit.id;
  }
  return flavourId ?? "";
}

function itemToDraft(
  it: AdminOrderItem,
  addons: Array<{ id: string; name: string }> = [],
  flavours: Array<{ id: string; name: string }> = [],
): DraftLine {
  const hint = [it.instructions, it.messageOnCake].filter(Boolean).join("\n");
  const addonSelections = addonIdsFromHint(hint, addons);
  return {
    key: it.id,
    id: it.id,
    productId: it.productId,
    productName: it.productName,
    sizeLabel: it.sizeLabel ?? "",
    sizeGrams: it.sizeGrams != null ? String(it.sizeGrams) : "",
    flavourId: matchFlavourId(it.flavourId, it.flavourName, flavours),
    flavourName: it.flavourName ?? "",
    messageOnCake: leftoverNotesAfterAddons(it.messageOnCake, addons),
    instructions: leftoverNotesAfterAddons(it.instructions, addons),
    description: it.description ?? "",
    showDescription: !it.productId || !!it.description,
    unitPrice: String(Number(it.unitPrice)),
    qty: String(it.qty),
    referenceImageUrls: it.referenceImageUrls?.length
      ? it.referenceImageUrls
      : it.referenceImageUrl
        ? [it.referenceImageUrl]
        : it.productImage
          ? [it.productImage]
          : [],
    refFiles: [],
    addonSelections,
    showAddons: addonSelections.length > 0,
  };
}

function newDraftLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    productId: null,
    productName: "",
    sizeLabel: "",
    sizeGrams: "",
    flavourId: "",
    flavourName: "",
    messageOnCake: "",
    instructions: "",
    description: "",
    showDescription: true,
    unitPrice: "",
    qty: "1",
    referenceImageUrls: [],
    refFiles: [],
    addonSelections: [],
    showAddons: false,
  };
}

function extraChargeDraftLine(): DraftLine {
  return {
    ...newDraftLine(),
    productName: "Extra charge",
    showDescription: false,
  };
}

function lineSubtotal(d: DraftLine): number {
  return Math.max(0, Number(d.unitPrice) || 0) * Math.max(1, Number(d.qty) || 0);
}

const compactInput = cn(inputClass, "px-2.5 py-1.5");
const compactArea = cn(textareaClass, "min-h-0 px-2.5 py-1.5");

function CompactField({
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

export function OrderItemsEditPanel({
  order,
  onClose,
}: {
  order: AdminOrder;
  onClose: () => void;
}) {
  const editItems = useEditOrderItems();
  const { data: allAddons } = useAdminAddons();
  const { data: allFlavours } = useAdminFlavours();
  const addons = useMemo(() => (allAddons ?? []).filter((a) => a.isActive), [allAddons]);
  const flavours = useMemo(
    () => (allFlavours ?? []).filter((f) => f.isActive),
    [allFlavours],
  );
  const [lines, setLines] = useState<DraftLine[]>(() => order.items.map((it) => itemToDraft(it)));
  const [collectedNow, setCollectedNow] = useState("");
  const [deliveryPaidToRider, setDeliveryPaidToRider] = useState(order.deliveryPaidToRider);
  const [deliveryFeeInput, setDeliveryFeeInput] = useState(
    Number(order.deliveryFee) > 0 ? String(Number(order.deliveryFee)) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const rematchedFor = useRef<string | null>(null);

  useEffect(() => {
    setLines(order.items.map((it) => itemToDraft(it, addons, flavours)));
    rematchedFor.current = addons.length > 0 || flavours.length > 0 ? order.id : null;
    setCollectedNow("");
    setDeliveryPaidToRider(order.deliveryPaidToRider);
    setDeliveryFeeInput(Number(order.deliveryFee) > 0 ? String(Number(order.deliveryFee)) : "");
    setError(null);
    // Hydrate from this order; rematch when addon/flavour lists arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  useEffect(() => {
    if ((addons.length === 0 && flavours.length === 0) || rematchedFor.current === order.id) return;
    rematchedFor.current = order.id;
    setLines(order.items.map((it) => itemToDraft(it, addons, flavours)));
  }, [addons, flavours, order.id, order.items]);

  const patchLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const toggleAddon = (line: DraftLine, addonId: string) => {
    const on = line.addonSelections.includes(addonId);
    const delta = Number(addons.find((a) => a.id === addonId)?.priceDelta ?? 0);
    patchLine(line.key, {
      addonSelections: on
        ? line.addonSelections.filter((id) => id !== addonId)
        : [...line.addonSelections, addonId],
      unitPrice: String(Math.max(0, (Number(line.unitPrice) || 0) + (on ? -delta : delta))),
    });
  };

  const itemsSubtotal = useMemo(
    () => lines.reduce((sum, l) => sum + lineSubtotal(l), 0),
    [lines],
  );
  const discount = Math.min(Number(order.discount) || 0, itemsSubtotal);
  const isDelivery = order.fulfillment === "DELIVERY";
  const deliveryFee =
    isDelivery && deliveryFeeInput.trim() !== "" ? Math.max(0, Number(deliveryFeeInput) || 0) : 0;
  const billedDelivery = isDelivery && deliveryFee > 0 && !deliveryPaidToRider ? deliveryFee : 0;
  const previewTotal = Math.max(0, itemsSubtotal - discount + billedDelivery);
  const previousTotal = Number(order.total) || 0;
  const paidBefore = Number(order.advanceAmount) || 0;
  const collect = Math.max(0, Number(collectedNow) || 0);
  const refundDue = Math.max(0, paidBefore - previewTotal);
  const refundOnline =
    order.paymentMethod === "cashfree"
      ? Math.min(refundDue, order.money?.onlineRefundable ?? 0)
      : 0;
  const refundManual = Math.max(0, refundDue - refundOnline);
  const extraDue = Math.max(0, previewTotal - paidBefore);
  const balanceAfterCollect = Math.max(0, previewTotal - Math.min(paidBefore + collect, previewTotal));

  const valid =
    lines.length >= 1 &&
    lines.every(
      (l) =>
        l.productName.trim().length >= 1 &&
        Number(l.unitPrice) >= 0 &&
        Number(l.qty) >= 1 &&
        Number.isFinite(Number(l.unitPrice)) &&
        Number.isFinite(Number(l.qty)),
    );

  const save = async () => {
    setError(null);
    if (!valid) {
      setError("Each item needs a name, qty ≥ 1, and a price.");
      return;
    }
    if (
      refundOnline > 0 &&
      !window.confirm(
        `Saving sends ₹${refundOnline.toFixed(0)} back to the customer's online payment. This can't be undone. Continue?`,
      )
    ) {
      return;
    }
    try {
      setUploading(true);
      const payloadItems = [];
      for (const line of lines) {
        if (isZeroExtraCharge({ productName: line.productName, unitPrice: line.unitPrice })) {
          continue;
        }
        const uploaded: string[] = [];
        for (const file of line.refFiles) {
          uploaded.push((await uploadImage(file, "quote-reference")).publicUrl);
        }
        const referenceImageUrls = [...line.referenceImageUrls, ...uploaded].slice(0, 5);
        const referenceImageUrl = referenceImageUrls[0] ?? null;
        const gramsRaw = line.sizeGrams.trim();
        const sizeGrams =
          gramsRaw === "" ? null : Math.max(1, Math.round(Number(gramsRaw)) || 0) || null;
        payloadItems.push({
          id: line.id,
          productId: line.productId,
          productName: line.productName.trim(),
          sizeLabel: line.sizeLabel.trim() || null,
          sizeGrams,
          flavourId: line.flavourId || null,
          flavourName: line.flavourId
            ? (flavours.find((f) => f.id === line.flavourId)?.name ??
                (line.flavourName.trim() || null))
            : line.flavourName.trim() || null,
          messageOnCake: line.messageOnCake.trim() || null,
          instructions: mergeInstructions(composeAddonNotes(line, addons), line.instructions),
          description: line.description.trim() || null,
          referenceImageUrl: referenceImageUrl || null,
          referenceImageUrls,
          unitPrice: Number(line.unitPrice) || 0,
          qty: Math.max(1, Math.round(Number(line.qty)) || 1),
        });
      }
      setUploading(false);

      const result = await editItems.mutateAsync({
        id: order.id,
        items: payloadItems,
        collectedNow: collect > 0 ? collect : 0,
        ...(isDelivery ? { deliveryPaidToRider, deliveryFee } : {}),
      });
      if (result.refundedOnline > 0 || result.refundDue > 0) {
        window.alert(
          [
            "Order updated.",
            result.refundedOnline > 0 &&
              `₹${result.refundedOnline.toFixed(0)} is on its way back to the customer's online payment.`,
            result.refundDue > 0 &&
              `Refund due ₹${result.refundDue.toFixed(0)} — pay the customer back manually.`,
          ]
            .filter(Boolean)
            .join(" "),
        );
      }
      onClose();
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : "Failed to save items");
    }
  };

  return (
    <div className="min-w-0 overflow-x-hidden rounded-card border border-brand-200 bg-brand-50/40 p-2.5 sm:p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Edit items</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Size, qty, price, delivery (Rapido / us), or photos. Discount stays as-is.
            {order.invoiceNumber
              ? ` Re-download invoice ${order.invoiceNumber} after save.`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-slate-500 hover:text-brand-700"
        >
          Cancel
        </button>
      </div>

      <ReorderList
        as="ul"
        className="mt-2.5 space-y-2.5"
        items={lines}
        getId={(line) => line.key}
        onReorder={setLines}
        disabled={lines.length <= 1}
      >
        {(line, ctx) => {
          const index = lines.findIndex((l) => l.key === line.key);
          const extra = line.productName === "Extra charge";
          return (
          <li
            ref={ctx.setNodeRef}
            style={ctx.style}
            className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <ReorderHandle {...ctx.handleProps} className="h-7 w-7" />
                <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  Item {index + 1}
                  {line.id ? "" : " · new"}
                </span>
                <span className="text-[11px] font-medium text-slate-700 tabular-nums">
                  ₹{lineSubtotal(line).toFixed(0)}
                </span>
              </div>
              <button
                type="button"
                disabled={lines.length <= 1}
                onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-800 disabled:opacity-40"
              >
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-x-2 gap-y-2 min-[400px]:grid-cols-2">
              {!extra && (
                <div className="col-span-2 flex min-w-0 flex-wrap items-start gap-2">
                  <RefImagesPicker
                    compact
                    keptUrls={line.referenceImageUrls}
                    files={line.refFiles}
                    onChange={(referenceImageUrls, refFiles) =>
                      patchLine(line.key, { referenceImageUrls, refFiles })
                    }
                  />
                </div>
              )}
              <CompactField label="Name" className="col-span-2">
                <input
                  value={line.productName}
                  onChange={(e) => patchLine(line.key, { productName: e.target.value })}
                  className={cn(compactInput, "min-w-0")}
                />
              </CompactField>
              <CompactField label="Size">
                <input
                  value={line.sizeLabel}
                  onChange={(e) => patchLine(line.key, { sizeLabel: e.target.value })}
                  placeholder="1.5 lb / Medium"
                  className={cn(compactInput, "min-w-0")}
                />
              </CompactField>
              <CompactField label="Grams">
                <input
                  inputMode="numeric"
                  value={line.sizeGrams}
                  onChange={(e) =>
                    patchLine(line.key, { sizeGrams: e.target.value.replace(/\D/g, "") })
                  }
                  placeholder="680"
                  className={cn(compactInput, "min-w-0")}
                />
              </CompactField>
              <CompactField label="Qty">
                <QtyStepper
                  className="h-9 max-w-full"
                  value={Number(line.qty) || 1}
                  onChange={(qty) => patchLine(line.key, { qty: String(qty) })}
                />
              </CompactField>
              <CompactField label="Price (₹)">
                <input
                  inputMode="decimal"
                  value={line.unitPrice}
                  onChange={(e) =>
                    patchLine(line.key, {
                      unitPrice: e.target.value.replace(/[^0-9.]/g, ""),
                    })
                  }
                  className={cn(compactInput, "min-w-0")}
                />
              </CompactField>
              {line.showDescription && (
                <CompactField label="Description" className="col-span-2">
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={line.description}
                    onChange={(e) => patchLine(line.key, { description: e.target.value })}
                    placeholder="e.g. Gift hamper…"
                    className={cn(compactArea, "min-w-0 resize-y")}
                  />
                </CompactField>
              )}
              <CompactField label="Flavour">
                <SearchableSelect
                  value={
                    line.flavourId ||
                    (line.flavourName.trim() ? `keep:${line.key}` : "")
                  }
                  onChange={(next) => {
                    if (!next) {
                      patchLine(line.key, { flavourId: "", flavourName: "" });
                      return;
                    }
                    if (next.startsWith("keep:")) return;
                    const picked = flavours.find((f) => f.id === next);
                    patchLine(line.key, {
                      flavourId: next,
                      flavourName: picked?.name ?? line.flavourName,
                    });
                  }}
                  searchPlaceholder="Search flavours…"
                  placeholder="— Pick flavour —"
                  allowEmpty
                  options={[
                    ...(!line.flavourId && line.flavourName.trim()
                      ? [
                          {
                            value: `keep:${line.key}`,
                            label: `${line.flavourName.trim()} (current)`,
                          },
                        ]
                      : []),
                    ...flavours.map((f) => ({
                      value: f.id,
                      label: f.name,
                      keywords: f.name,
                    })),
                    ...(line.flavourId && !flavours.some((f) => f.id === line.flavourId)
                      ? [{ value: line.flavourId, label: line.flavourName || "Current flavour" }]
                      : []),
                  ]}
                />
              </CompactField>
              <CompactField label="Message on cake">
                <input
                  value={line.messageOnCake}
                  onChange={(e) => patchLine(line.key, { messageOnCake: e.target.value })}
                  className={cn(compactInput, "min-w-0")}
                />
              </CompactField>
              <CompactField label="Instructions" className="col-span-2">
                <textarea
                  rows={2}
                  value={line.instructions}
                  onChange={(e) => patchLine(line.key, { instructions: e.target.value })}
                  className={cn(compactArea, "min-w-0")}
                />
              </CompactField>
              {addons.length > 0 && (
                <div className="col-span-2">
                  {line.showAddons || line.addonSelections.length > 0 ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-2">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-slate-600">Add-ons</span>
                        {line.addonSelections.length === 0 && (
                          <button
                            type="button"
                            onClick={() => patchLine(line.key, { showAddons: false })}
                            className="text-[11px] text-slate-500 hover:text-slate-700"
                          >
                            Hide
                          </button>
                        )}
                      </div>
                      <AddonGroupPicker
                        addons={addons}
                        selected={line.addonSelections}
                        onToggle={(id) => toggleAddon(line, id)}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => patchLine(line.key, { showAddons: true })}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:text-brand-900"
                    >
                      <Plus className="h-3 w-3" /> Add-ons
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
          );
        }}
      </ReorderList>

      <div className="mt-2 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, newDraftLine()])}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-900"
        >
          <Plus className="h-3.5 w-3.5" /> Add item
        </button>
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, extraChargeDraftLine()])}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-900"
        >
          <Plus className="h-3.5 w-3.5" /> Extra charge
        </button>
      </div>

      {isDelivery && (
        <div className="mt-2.5 grid max-w-lg grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          <CompactField label="Delivery charge">
            <input
              inputMode="decimal"
              value={deliveryFeeInput}
              onChange={(e) => setDeliveryFeeInput(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="e.g. 80"
              className={cn(compactInput, "min-w-0 w-full")}
            />
          </CompactField>
          <DeliveryPaidToField
            compact
            paidToRider={deliveryPaidToRider}
            onChange={setDeliveryPaidToRider}
          />
        </div>
      )}

      <div className="mt-2.5 space-y-1 rounded-lg border border-slate-200 bg-white p-2.5 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Previous total</span>
          <span className="tabular-nums">₹{previousTotal.toFixed(0)}</span>
        </div>
        {isDelivery && deliveryFee > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>{deliveryPaidToRider ? "Delivery · pay rider (not in total)" : "Delivery · us"}</span>
            <span className="tabular-nums">₹{deliveryFee.toFixed(0)}</span>
          </div>
        )}
        <div className="flex justify-between font-medium text-slate-900">
          <span>New total</span>
          <span className="tabular-nums">₹{previewTotal.toFixed(0)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Already collected</span>
          <span className="tabular-nums">₹{paidBefore.toFixed(0)}</span>
        </div>
        {extraDue > 0 && (
          <div className="flex justify-between text-amber-800">
            <span>Extra due</span>
            <span className="tabular-nums">₹{extraDue.toFixed(0)}</span>
          </div>
        )}
        {refundOnline > 0 && (
          <div className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
            ₹{refundOnline.toFixed(0)} goes back to the customer&apos;s online payment when you save.
          </div>
        )}
        {refundManual > 0 && (
          <div className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
            Refund due ₹{refundManual.toFixed(0)} — pay the customer back manually.
          </div>
        )}
        {extraDue > 0 && (
          <label className="mt-2 block text-xs">
            <span className="font-medium text-slate-700">Collected now (₹)</span>
            <input
              inputMode="decimal"
              value={collectedNow}
              onChange={(e) => setCollectedNow(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder={`Up to ${extraDue.toFixed(0)}`}
              className={cn(inputClass, "mt-1 min-w-0 w-full max-w-[9rem]")}
            />
            {collect > 0 && (
              <p className="mt-1 text-[11px] text-slate-500">
                Balance after save: ₹{balanceAfterCollect.toFixed(0)}
              </p>
            )}
          </label>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!valid || editItems.isPending || uploading}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : editItems.isPending ? "Saving…" : "Save item changes"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:border-brand-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
