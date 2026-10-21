/** Bakery bill plus rider delivery — the amount the customer actually spends. */
export function customerPayableTotal(
  bakeryTotal: number,
  deliveryFee: number,
  paidToRider: boolean,
): number {
  return bakeryTotal + (paidToRider && deliveryFee > 0 ? deliveryFee : 0);
}

export function customerOrderPayable(order: {
  total: number | string;
  deliveryFee: number | string;
  deliveryPaidToRider: boolean;
  fulfillment?: "DELIVERY" | "PICKUP" | string;
}): number {
  const rider =
    order.fulfillment !== "PICKUP" &&
    order.deliveryPaidToRider &&
    Number(order.deliveryFee) > 0;
  return customerPayableTotal(Number(order.total), rider ? Number(order.deliveryFee) : 0, rider);
}
