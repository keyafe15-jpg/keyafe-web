import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    phone: string;
  };
}

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw HttpError.unauthorized("Authentication required");
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as {
      sub?: string;
      phone?: string;
      type?: string;
    };

    if (!payload.sub || payload.type !== "access") {
      throw new Error("Invalid token payload");
    }

    (req as AuthenticatedRequest).user = {
      id: payload.sub,
      phone: payload.phone ?? "",
    };
    next();
  } catch {
    throw HttpError.unauthorized("Invalid or expired session");
  }
}

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as {
      sub?: string;
      phone?: string;
      type?: string;
    };

    if (payload.sub && payload.type === "access") {
      (req as AuthenticatedRequest).user = {
        id: payload.sub,
        phone: payload.phone ?? "",
      };
    }
    next();
  } catch {
    next();
  }
}
