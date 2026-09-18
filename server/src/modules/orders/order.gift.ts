import { z } from "zod";

/** Shared delivery / billing address snapshot shape. */
export const orderAddressSchema = z.object({
  line1: z.string().trim().min(3),
  line2: z.string().trim().optional().nullable(),
  landmark: z.string().trim().optional().nullable(),
  mapSearchQuery: z.string().trim().min(3, "Tell us what to search on Uber / Rapido").max(200),
  pincode: z.string().regex(/^\d{6}$/),
  city: z.string().trim().optional().nullable(),
  area: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  stateCode: z.string().trim().optional().nullable(),
});

export type OrderAddressInput = z.infer<typeof orderAddressSchema>;

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone number");

/** Gift / billing fields accepted on place-order payloads. */
export const giftBillingFieldsSchema = z.object({
  recipientName: z.string().trim().min(2).max(80).optional().nullable(),
  deliveryPhone: phoneSchema.optional().nullable(),
  billingAddress: orderAddressSchema.optional().nullable(),
  billingSameAsDelivery: z.boolean().optional(),
  isSurpriseGift: z.boolean().optional(),
});

export type GiftBillingInput = z.infer<typeof giftBillingFieldsSchema>;

export type ResolvedGiftBilling = {
  recipientName: string | null;
  deliveryPhone: string | null;
  billingAddress: OrderAddressInput | null;
  isSurpriseGift: boolean;
};

/**
 * Resolve gift/billing snapshots for persistence.
 * - Delivery: require deliveryPhone (fallback customerPhone) + billing address
 * - Pickup: no delivery phone; billing optional but accepted when provided
 * - Surprise only applies to delivery
 */
export function resolveGiftBilling(input: {
  fulfillment: "DELIVERY" | "PICKUP";
  customerName: string;
  customerPhone: string;
  deliveryAddress?: OrderAddressInput | null;
  recipientName?: string | null;
  deliveryPhone?: string | null;
  billingAddress?: OrderAddressInput | null;
  billingSameAsDelivery?: boolean;
  isSurpriseGift?: boolean;
}): ResolvedGiftBilling {
  const isDelivery = input.fulfillment === "DELIVERY";
  const isSurpriseGift = isDelivery ? Boolean(input.isSurpriseGift) : false;

  if (!isDelivery) {
    return {
      recipientName: null,
      deliveryPhone: null,
      billingAddress: input.billingAddress ?? null,
      isSurpriseGift: false,
    };
  }

  const deliveryPhone = (input.deliveryPhone?.trim() || input.customerPhone).trim();
  const recipientName =
    input.recipientName?.trim() || input.customerName.trim() || null;

  let billingAddress: OrderAddressInput | null = null;
  if (input.billingSameAsDelivery !== false) {
    billingAddress = input.deliveryAddress ?? input.billingAddress ?? null;
  } else {
    billingAddress = input.billingAddress ?? null;
  }

  if (!billingAddress) {
    throw new Error("BILLING_ADDRESS_REQUIRED");
  }

  return {
    recipientName,
    deliveryPhone,
    billingAddress,
    isSurpriseGift,
  };
}
