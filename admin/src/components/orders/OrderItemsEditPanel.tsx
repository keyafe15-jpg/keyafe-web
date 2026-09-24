import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ImageOff } from "lucide-react";
import {
  useEditOrderItems,
  type AdminOrder,
  type AdminOrderItem,
} from "@/hooks/useAdminOrders";
import { inputClass, textareaClass } from "@/components/form/Field";
import { uploadImage } from "@/lib/uploads";
import { cn } from "@/lib/cn";

type DraftLine = {
  key: string;
  id?: string;
  productId: string | null;
  productName: string;
  sizeLabel: string;
  sizeGrams: string;
  flavourName: string;
  messageOnCake: string;
  instructions: string;
  unitPrice: string;
  qty: string;
  referenceImageUrl: string | null;
  refFile: File | null;
  refPreview: string | null;
};

function itemToDraft(it: AdminOrderItem): DraftLine {
  return {
    key: it.id,
    id: it.id,
    productId: it.productId,
    productName: it.productName,
    sizeLabel: it.sizeLabel ?? "",
    sizeGrams: it.sizeGrams != null ? String(it.sizeGrams) : "",
    flavourName: it.flavourName ?? "",
    messageOnCake: it.messageOnCake ?? "",
    instructions: it.instructions ?? "",
    unitPrice: String(Number(it.unitPrice)),
    qty: String(it.qty),
    referenceImageUrl: it.referenceImageUrl ?? it.productImage,
    refFile: null,
    refPreview: it.referenceImageUrl ?? it.productImage,
  };
}

function newDraftLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    productId: null,
    productName: "",
    sizeLabel: "",
    sizeGrams: "",
    flavourName: "",
    messageOnCake: "",
    instructions: "",
    unitPrice: "",
    qty: "1",
    referenceImageUrl: null,
    refFile: null,
    refPreview: null,
  };
}

function lineSubtotal(d: DraftLine): number {
  return Math.max(0, Number(d.unitPrice) || 0) * Math.max(1, Number(d.qty) || 0);
}

export function OrderItemsEditPanel({
  order,
  onClose,
}: {
  order: AdminOrder;
  onClose: () => void;
}) {
  const editItems = useEditOrderItems();
  const [lines, setLines] = useState<DraftLine[]>(() => order.items.map(itemToDraft));
  const [collectedNow, setCollectedNow] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setLines(order.items.map(itemToDraft));
    setCollectedNow("");
    setError(null);
  }, [order.id]);

  const patchLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const itemsSubtotal = useMemo(
    () => lines.reduce((sum, l) => sum + lineSubtotal(l), 0),
    [lines],
  );
  const discount = Math.min(Number(order.discount) || 0, itemsSubtotal);
  const deliveryFee = Number(order.deliveryFee) || 0;
  const previewTotal = Math.max(0, itemsSubtotal - discount + deliveryFee);
  const previousTotal = Number(order.total) || 0;
  const paidBefore = Number(order.advanceAmount) || 0;
  const collect = Math.max(0, Number(collectedNow) || 0);
  const refundDue = Math.max(0, paidBefore - previewTotal);
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
    try {
      setUploading(true);
      const payloadItems = [];
      for (const line of lines) {
        let referenceImageUrl = line.referenceImageUrl;
        if (line.refFile) {
          const res = await uploadImage(line.refFile, "quote-reference");
          referenceImageUrl = res.publicUrl;
        }
        const gramsRaw = line.sizeGrams.trim();
        const sizeGrams =
          gramsRaw === "" ? null : Math.max(1, Math.round(Number(gramsRaw)) || 0) || null;
        payloadItems.push({
          id: line.id,
          productId: line.productId,
          productName: line.productName.trim(),
          sizeLabel: line.sizeLabel.trim() || null,
          sizeGrams,
          flavourName: line.flavourName.trim() || null,
          messageOnCake: line.messageOnCake.trim() || null,
          instructions: line.instructions.trim() || null,
          referenceImageUrl: referenceImageUrl || null,
          unitPrice: Number(line.unitPrice) || 0,
          qty: Math.max(1, Math.round(Number(line.qty)) || 1),
        });
      }
      setUploading(false);

      const result = await editItems.mutateAsync({
        id: order.id,
        items: payloadItems,
        collectedNow: collect > 0 ? collect : 0,
      });
      if (result.refundDue > 0) {
        window.alert(
          `Order updated. Refund due ₹${result.refundDue.toFixed(0)} — refund manually for now (Razorpay auto-refund later).`,
        );
      }
      onClose();
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : "Failed to save items");
    }
  };

  return (
    <div className="rounded-card border border-brand-200 bg-brand-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Edit items</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Change size, qty, price, or ref image. Add/remove lines. Delivery fee &amp; discount stay
            as-is. Invoiced orders can&apos;t be edited here.
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

      <ul className="mt-4 space-y-4">
        {lines.map((line, index) => (
          <li
            key={line.key}
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Item {index + 1}
                {line.id ? "" : " · new"}
              </span>
              <button
                type="button"
                disabled={lines.length <= 1}
                onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 disabled:opacity-40"
              >
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs sm:col-span-2">
                <span className="font-medium text-slate-700">Product / cake name</span>
                <input
                  value={line.productName}
                  onChange={(e) => patchLine(line.key, { productName: e.target.value })}
                  className={cn(inputClass, "mt-1")}
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700">Size label</span>
                <input
                  value={line.sizeLabel}
                  onChange={(e) => patchLine(line.key, { sizeLabel: e.target.value })}
                  placeholder="1.5 lb / Medium"
                  className={cn(inputClass, "mt-1")}
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700">Size grams (optional)</span>
                <input
                  inputMode="numeric"
                  value={line.sizeGrams}
                  onChange={(e) =>
                    patchLine(line.key, { sizeGrams: e.target.value.replace(/\D/g, "") })
                  }
                  placeholder="680"
                  className={cn(inputClass, "mt-1")}
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700">Qty</span>
                <input
                  inputMode="numeric"
                  value={line.qty}
                  onChange={(e) =>
                    patchLine(line.key, { qty: e.target.value.replace(/\D/g, "") || "1" })
                  }
                  className={cn(inputClass, "mt-1")}
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700">Unit price (₹)</span>
                <input
                  inputMode="decimal"
                  value={line.unitPrice}
                  onChange={(e) =>
                    patchLine(line.key, {
                      unitPrice: e.target.value.replace(/[^0-9.]/g, ""),
                    })
                  }
                  className={cn(inputClass, "mt-1")}
                />
              </label>
              <label className="block text-xs sm:col-span-2">
                <span className="font-medium text-slate-700">Flavour</span>
                <input
                  value={line.flavourName}
                  onChange={(e) => patchLine(line.key, { flavourName: e.target.value })}
                  className={cn(inputClass, "mt-1")}
                />
              </label>
              <label className="block text-xs sm:col-span-2">
                <span className="font-medium text-slate-700">Message on cake</span>
                <input
                  value={line.messageOnCake}
                  onChange={(e) => patchLine(line.key, { messageOnCake: e.target.value })}
                  className={cn(inputClass, "mt-1")}
                />
              </label>
              <label className="block text-xs sm:col-span-2">
                <span className="font-medium text-slate-700">Instructions</span>
                <textarea
                  rows={2}
                  value={line.instructions}
                  onChange={(e) => patchLine(line.key, { instructions: e.target.value })}
                  className={cn(textareaClass, "mt-1")}
                />
              </label>
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-slate-700">Reference image</span>
                <div className="mt-1 flex items-center gap-3">
                  {line.refPreview ? (
                    <img
                      src={line.refPreview}
                      alt=""
                      className="h-14 w-14 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                      <ImageOff className="h-4 w-4" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (!file) return;
                      const url = URL.createObjectURL(file);
                      patchLine(line.key, { refFile: file, refPreview: url });
                    }}
                    className="text-xs text-slate-600"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 sm:col-span-2">
                Line total{" "}
                <span className="font-medium text-slate-800 tabular-nums">
                  ₹{lineSubtotal(line).toFixed(0)}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setLines((prev) => [...prev, newDraftLine()])}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-900"
      >
        <Plus className="h-3.5 w-3.5" /> Add item
      </button>

      <div className="mt-4 space-y-1.5 rounded-lg border border-slate-200 bg-white p-3 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Previous total</span>
          <span className="tabular-nums">₹{previousTotal.toFixed(0)}</span>
        </div>
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
        {refundDue > 0 && (
          <div className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
            Refund due ₹{refundDue.toFixed(0)}. Refund manually for now — Razorpay auto-refund when
            online payments are live.
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
              className={cn(inputClass, "mt-1 w-36")}
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
