import { Router } from "express";
import { HttpError } from "../../utils/httpError.js";
import {
  getQuoteRequestById,
  listQuoteRequests,
  updateQuoteRequest,
  updateQuoteSchema,
} from "./quote.service.js";

import { requirePermission } from "../../middleware/auth.js";

export const adminQuoteRouter = Router();

adminQuoteRouter.get("/", requirePermission("quotes.read"), async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const quotes = await listQuoteRequests(status);
  res.json(quotes);
});

adminQuoteRouter.get("/:id", requirePermission("quotes.read"), async (req, res) => {
  const quote = await getQuoteRequestById(req.params.id ?? "");
  res.json(quote);
});

adminQuoteRouter.patch("/:id", requirePermission("quotes.update"), async (req, res) => {
  const parsed = updateQuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid quote update", parsed.error.flatten());
  }
  const quote = await updateQuoteRequest(req.params.id ?? "", parsed.data);
  res.json(quote);
});
