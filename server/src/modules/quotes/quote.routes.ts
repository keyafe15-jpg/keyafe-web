import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { HttpError } from "../../utils/httpError.js";
import { createQuoteRequest, createQuoteSchema } from "./quote.service.js";

export const publicQuoteRouter = Router();

publicQuoteRouter.post("/", async (req, res) => {
  const parsed = createQuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid quote request", parsed.error.flatten());
  }
  const quote = await createQuoteRequest(parsed.data);
  res.status(StatusCodes.CREATED).json(quote);
});
