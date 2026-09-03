import { Router } from "express";
import { getCustomerDetail, listCustomers } from "./customer.service.js";

// TODO: gate behind requireAuth + requirePermission("customers.read") once auth is wired.
export const adminCustomerRouter = Router();

adminCustomerRouter.get("/", async (req, res) => {
  const search =
    typeof req.query.search === "string" ? req.query.search : undefined;
  const activeParam =
    typeof req.query.active === "string" ? req.query.active : undefined;
  const active =
    activeParam === "true" ? true : activeParam === "false" ? false : null;
  const registeredParam =
    typeof req.query.registered === "string" ? req.query.registered : undefined;
  const registered =
    registeredParam === "true"
      ? true
      : registeredParam === "false"
        ? false
        : null;

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
