import { backfillGuestCustomersFromOrders } from "../src/modules/customers/customer.service.js";

const result = await backfillGuestCustomersFromOrders();
console.log(`Linked ${result.ordersProcessed} guest order(s) to customer records.`);
