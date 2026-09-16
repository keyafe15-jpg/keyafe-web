import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/db.js";
import { HttpError } from "../utils/httpError.js";
import { CUSTOMER_ROLE_SLUG } from "../modules/staff/rbac.catalog.js";

export interface StaffUser {
  id: string;
  phone: string;
  name: string;
  isActive: boolean;
  role: {
    id: string;
    slug: string;
    isSuperuser: boolean;
    permissions: string[];
  };
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    phone: string;
  };
  staff?: StaffUser;
}

function readAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  const queryToken = req.query.access_token;
  if (typeof queryToken === "string" && queryToken.length > 0) {
    return queryToken;
  }
  return null;
}

function verifyAccessToken(token: string): { id: string; phone: string } {
  const payload = jwt.verify(token, env.JWT_SECRET) as {
    sub?: string;
    phone?: string;
    type?: string;
  };
  if (!payload.sub || payload.type !== "access") {
    throw new Error("Invalid token payload");
  }
  return { id: payload.sub, phone: payload.phone ?? "" };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readAccessToken(req);
  if (!token) {
    throw HttpError.unauthorized("Authentication required");
  }

  try {
    const user = verifyAccessToken(token);
    (req as AuthenticatedRequest).user = user;
    next();
  } catch {
    throw HttpError.unauthorized("Invalid or expired session");
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readAccessToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const user = verifyAccessToken(token);
    (req as AuthenticatedRequest).user = user;
  } catch {
    // Ignore invalid tokens on optional routes.
  }
  next();
}

export function staffHasPermission(staff: StaffUser, key: string): boolean {
  if (staff.role.isSuperuser) return true;
  if (staff.role.permissions.includes(key)) return true;
  if (key.endsWith(".read")) {
    const writeKey = `${key.slice(0, -".read".length)}.write`;
    if (staff.role.permissions.includes(writeKey)) return true;
  }
  return false;
}

export async function loadStaffUser(userId: string): Promise<StaffUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      name: true,
      isActive: true,
      role: {
        select: {
          id: true,
          slug: true,
          isSuperuser: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    isActive: user.isActive,
    role: {
      id: user.role.id,
      slug: user.role.slug,
      isSuperuser: user.role.isSuperuser,
      permissions: user.role.permissions.map((row) => row.permission.key),
    },
  };
}

export function isStaffRole(role: { slug: string; isSuperuser: boolean }): boolean {
  if (role.isSuperuser) return true;
  return role.slug !== CUSTOMER_ROLE_SLUG;
}

export async function requireStaff(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = readAccessToken(req);
  if (!token) {
    throw HttpError.unauthorized("Authentication required");
  }

  let identity: { id: string; phone: string };
  try {
    identity = verifyAccessToken(token);
  } catch {
    throw HttpError.unauthorized("Invalid or expired session");
  }

  const staff = await loadStaffUser(identity.id);
  if (!staff || !staff.isActive) {
    throw HttpError.unauthorized("Invalid or expired session");
  }
  if (!isStaffRole(staff.role)) {
    throw HttpError.forbidden("Staff access required");
  }

  const authed = req as AuthenticatedRequest;
  authed.user = { id: staff.id, phone: staff.phone };
  authed.staff = staff;
  next();
}

export function requirePermission(...keys: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const staff = (req as AuthenticatedRequest).staff;
    if (!staff) {
      throw HttpError.unauthorized("Authentication required");
    }
    if (keys.some((key) => staffHasPermission(staff, key))) {
      next();
      return;
    }
    throw HttpError.forbidden("You don't have permission to do this");
  };
}
