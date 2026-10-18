import { Router } from "express";
import { getCustomerDetail, listCustomers, lookupCustomersForOrder } from "./customer.service.js";

export const adminCustomerRouter = Router();

/** Name/phone search for offline-order forms. Mounted with looser permissions than the rest. */
export const adminCustomerLookupRouter = Router();
adminCustomerLookupRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  res.json(await lookupCustomersForOrder(q));
});

adminCustomerRouter.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const activeParam = typeof req.query.active === "string" ? req.query.active : undefined;
  const active = activeParam === "true" ? true : activeParam === "false" ? false : null;
  const registeredParam =
    typeof req.query.registered === "string" ? req.query.registered : undefined;
  const registered = registeredParam === "true" ? true : registeredParam === "false" ? false : null;

  const customers = await listCustomers(
    Number(req.query.page ?? 1),
    Number(req.query.pageSize ?? 20),
    search,
    active,
    registered,
  );
  res.json(customers);
});

adminCustomerRouter.get("/:id", async (req, res) => {
  const detail = await getCustomerDetail(req.params.id);
  res.json(detail);
});
