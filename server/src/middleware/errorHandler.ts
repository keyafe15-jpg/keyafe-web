import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError.js";
import { logger } from "../utils/logger.js";

export function notFound(_req: Request, res: Response): void {
  res.status(StatusCodes.NOT_FOUND).json({ error: "Route not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(StatusCodes.BAD_REQUEST).json({
      error: "Validation failed",
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  logger.error({ err }, "Unhandled error");
  res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: "Internal server error" });
}
