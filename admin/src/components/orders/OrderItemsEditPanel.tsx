import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  useEditOrderItems,
  useUpdateOrder,
  type AdminOrder,
} from "@/hooks/useAdminOrders";
import { useAdminAddons } from "@/hooks/useAddons";
import { useFlavours } from "@/hooks/useFlavours";
import { useAllAdminProducts } from "@/hooks/useAdminProducts";
import { useAdminToppings } from "@/hooks/useToppings";
import { inputClass } from "@/components/form/Field";
import { DeliveryPaidToField } from "@/components/form/DeliveryPaidToField";
import {
  OrderItemsEditor,
  adminOrderItemToDraft,
  extraChargeItem,
  newOrderItem,
  orderItemsIssue,
  resolveReferenceImageUrls,
  toEditOrderItemPayload,
  type OrderItemDraft,
} from "@/components/order-items";
import { OrderItemScheduleFooter } from "@/components/orders/OrderItemCard";
import { cn } from "@/lib/cn";
import { isExtraChargeItem, isZeroExtraCharge } from "@/lib/extraCharge";

export function OrderItemsEditPanel({ order }: { order: AdminOrder }) {
  const editItems = useEditOrderItems();
  const update = useUpdateOrder();
  const { data: products = [] } = useAllAdminProducts();
  const { data: allAddons = [] } = useAdminAddons();
  const { data: toppings = [] } = useAdminToppings();
  const { data: flavours = [] } = useFlavours();
  const addons = useMemo(() => allAddons.filter((a) => a.isActive), [allAddons]);

  const mapFromOrder = useCallback(
    () =>
      order.items
        .filter((it) => !isZeroExtraCharge(it))
        .map((it) =>
          adminOrderItemToDraft(it, {
            product: products.find((p) => p.id === it.productId),
            addons,
            toppings,
            flavours,
          }),
        ),
    [order.items, products, addons, toppings, flavours],
  );

  const [items, setItems] = useState<OrderItemDraft[]>(mapFromOrder);
  const [collectedNow, setCollectedNow] = useState("");
  const [deliveryPaidToRider, setDeliveryPaidToRider] = useState(order.deliveryPaidToRider);
  const [deliveryFeeInput, setDeliveryFeeInput] = useState(
    Number(order.deliveryFee) > 0 ? String(Number(order.deliveryFee)) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const rematchedFor = useRef<string | null>(null);

  useEffect(() => {
    setItems(mapFromOrder());
    rematchedFor.current =
      addons.length > 0 || toppings.length > 0 || flavours.length > 0 || products.length > 0
        ? order.id
        : null;
    setCollectedNow("");
    setDeliveryPaidToRider(order.deliveryPaidToRider);
    setDeliveryFeeInput(Number(order.deliveryFee) > 0 ? String(Number(order.deliveryFee)) : "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  useEffect(() => {
    if (rematchedFor.current === order.id) return;
    if (addons.length === 0 && toppings.length === 0 && flavours.length === 0 && products.length === 0) {
      return;
    }
    rematchedFor.current = order.id;
    setItems(mapFromOrder());
  }, [addons, toppings, flavours, products, mapFromOrder, order.id]);

  const existingIds = useMemo(() => new Set(order.items.map((it) => it.id)), [order.items]);

  const patchItem = (id: string, patch: Partial<OrderItemDraft>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) return { ...it, ...patch };
        if (patch.expanded === true) return { ...it, expanded: false };
        return it;
      }),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      return next.length ? next : mapFromOrder();
    });
  };

  const addItem = (kind: "CUSTOM" | "CATALOG") => {
    setItems((prev) => [
      newOrderItem(kind),
      ...prev.map((it) => ({ ...it, expanded: false })),
    ]);
  };

  const addExtraCharge = () => {
    setItems((prev) => [extraChargeItem(), ...prev.map((it) => ({ ...it, expanded: false }))]);
  };

  const itemsSubtotal = useMemo(
    () =>
      items
        .filter((it) => !isZeroExtraCharge(it))
        .reduce((sum, it) => sum + Math.max(0, Number(it.unitPrice) || 0) * (Number(it.qty) || 1), 0),
    [items],
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
  const balanceAfterCollect = Math.max(
    0,
    previewTotal - Math.min(paidBefore + collect, previewTotal),
  );

  const saveable = items.filter((it) => !isZeroExtraCharge(it));
  const issue = orderItemsIssue(saveable);
  const valid = saveable.length >= 1 && issue === null;

  const save = async () => {
    setError(null);
    if (!valid) {
      setError(issue ?? "Each item needs a name, qty, and a price.");
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
      for (const item of saveable) {
        const referenceImageUrls =
          item.kind === "CUSTOM" ? await resolveReferenceImageUrls(item) : item.keptImageUrls;
        payloadItems.push({
          ...(existingIds.has(item.id) ? { id: item.id } : {}),
          ...toEditOrderItemPayload(item, referenceImageUrls, flavours, toppings, addons),
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
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : "Failed to save items");
    }
  };

  return (
    <div className="min-w-0">
      <OrderItemsEditor
        mode="edit"
        items={items}
        patchItem={patchItem}
        removeItem={removeItem}
        addItem={addItem}
        onReorder={setItems}
        extraAction={
          <button
            type="button"
            onClick={addExtraCharge}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-300"
          >
            <Plus className="h-3.5 w-3.5" /> Extra charge
          </button>
        }
        itemFooter={(draft) => {
          if (isExtraChargeItem(draft)) return null;
          const saved = order.items.find((it) => it.id === draft.id);
          if (!saved) return null;
          return (
            <OrderItemScheduleFooter
              item={saved}
              pending={update.isPending}
              onSaveSchedule={(payload) =>
                update.mutateAsync({ id: order.id, items: [payload] })
              }
              showEditButton={false}
              editorOpen={draft.expanded}
            />
          );
        }}
      />

      {isDelivery && (
        <div className="mt-3 grid max-w-lg grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          <label className="block min-w-0">
            <span className="mb-0.5 block text-[11px] font-medium text-slate-500">
              Delivery charge
            </span>
            <input
              inputMode="decimal"
              value={deliveryFeeInput}
              onChange={(e) => setDeliveryFeeInput(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="e.g. 80"
              className={cn(inputClass, "px-2.5 py-1.5")}
            />
          </label>
          <DeliveryPaidToField
            compact
            paidToRider={deliveryPaidToRider}
            onChange={setDeliveryPaidToRider}
          />
        </div>
      )}

      <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Previous total</span>
          <span className="tabular-nums">₹{previousTotal.toFixed(0)}</span>
        </div>
        {isDelivery && deliveryFee > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>
              {deliveryPaidToRider ? "Delivery · pay rider (not in total)" : "Delivery · us"}
            </span>
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
            ₹{refundOnline.toFixed(0)} goes back to the customer&apos;s online payment when you
            save.
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

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!valid || editItems.isPending || uploading}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : editItems.isPending ? "Saving…" : "Save item changes"}
        </button>
      </div>
    </div>
  );
}
