export type Money = number;

export interface Category {
  _id: string;
  slug: string;
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface ProductVariant {
  _id: string;
  label: string;
  flavor?: string;
  sizeLb?: number;
  tier?: 1 | 2 | 3;
  isFondant?: boolean;
  priceDelta: Money;
}

export interface Product {
  _id: string;
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  images: string[];
  basePrice: Money;
  variants: ProductVariant[];
  isCustomizable: boolean;
  supportsMessageOnCake: boolean;
  supportsSameDayDelivery: boolean;
}

export interface CartLine {
  id: string;
  productId: string;
  slug: string;
  name: string;
  image?: string;
  categorySlug?: string;

  // Options selected on the PDP
  sizeGrams?: number;
  sizeLabel?: string;
  flavourId?: string;
  flavourName?: string;
  messageOnCake?: string;
  instructions?: string;

  // Fulfillment selection
  fulfillment?: "delivery" | "pickup";
  date?: string;
  slotKey?: string;
  slotLabel?: string;

  // Pricing
  unitPrice: Money;
  qty: number;
}
