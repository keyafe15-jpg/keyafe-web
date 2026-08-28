import { EventEmitter } from "node:events";

// One shared emitter for the whole process — SSE routes subscribe here,
// place-order services emit here.
export const orderEvents = new EventEmitter();

// Bump the default max listeners so many admin tabs can subscribe without warnings.
orderEvents.setMaxListeners(100);

export interface NewOrderEvent {
  id: string;
  orderNumber: string;
  customerName: string;
  total: string | number;
  source: "STOREFRONT" | "OFFLINE_LINK" | "OFFLINE_DIRECT";
  itemCount: number;
  createdAt: string;
}

export function emitNewOrder(event: NewOrderEvent) {
  orderEvents.emit("new-order", event);
}
