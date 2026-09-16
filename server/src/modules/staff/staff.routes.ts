import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../utils/httpError.js";
import { requirePermission, type AuthenticatedRequest } from "../../middleware/auth.js";
import { normalizeCustomerPhone } from "../../lib/phone.js";
import {
  createRole,
  createStaffUser,
  listPermissions,
  listRoles,
  listStaffUsers,
  updateRole,
  updateStaffUser,
} from "./staff.service.js";

export const adminStaffRouter = Router();

const listUsersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  roleId: z.string().optional(),
  active: z
    .enum(["true", "false", "all"])
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : null)),
});

adminStaffRouter.get("/users", requirePermission("users.manage"), async (req, res) => {
  const parsed = listUsersSchema.safeParse(req.query);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid query", parsed.error.flatten());
  }
  res.json(await listStaffUsers(parsed.data));
});

const createUserSchema = z.object({
  name: z.string().trim().min(2),
  phone: z
    .string()
    .trim()
    .transform((value) => normalizeCustomerPhone(value))
    .refine(
      (value) => /^(?:\+?[1-9]\d{7,14}|[6-9]\d{9})$/.test(value),
      "Enter a valid phone number",
    ),
  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  roleId: z.string().min(1),
  promote: z.boolean().optional(),
});

adminStaffRouter.post("/users", requirePermission("users.manage"), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid staff user", parsed.error.flatten());
  }
  const created = await createStaffUser(parsed.data);
  res.status(201).json(created);
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().nullable().optional(),
  roleId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

adminStaffRouter.patch("/users/:id", requirePermission("users.manage"), async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid update", parsed.error.flatten());
  }
  const actorId = (req as AuthenticatedRequest).staff?.id;
  if (!actorId) throw HttpError.unauthorized("Authentication required");
  res.json(await updateStaffUser(req.params.id ?? "", parsed.data, actorId));
});

adminStaffRouter.get(
  "/roles",
  requirePermission("roles.manage", "users.manage"),
  async (_req, res) => {
    res.json(await listRoles());
  },
);

adminStaffRouter.get("/permissions", requirePermission("roles.manage"), async (_req, res) => {
  res.json(await listPermissions());
});

const createRoleSchema = z.object({
  name: z.string().trim().min(2),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

adminStaffRouter.post("/roles", requirePermission("roles.manage"), async (req, res) => {
  const parsed = createRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid role", parsed.error.flatten());
  }
  const created = await createRole(parsed.data);
  res.status(201).json(created);
});

const updateRoleSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  permissionIds: z.array(z.string()).optional(),
});

adminStaffRouter.patch("/roles/:id", requirePermission("roles.manage"), async (req, res) => {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid role update", parsed.error.flatten());
  }
  res.json(await updateRole(req.params.id ?? "", parsed.data));
});
