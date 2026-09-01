import { z } from "zod";
import type { QuoteStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { assertKitchenOpenOn } from "../store/store.service.js";

const PHONE_RE = /^(?:\+?[1-9]\d{7,14}|[6-9]\d{9})$/;

function normalizePhone(value: string) {
  return value.trim().replace(/[\s().-]/g, "");
}

function parseDeliveryDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) throw HttpError.badRequest("Invalid delivery date");
  const date = new Date(y, m - 1, d, 12, 0, 0);
  if (Number.isNaN(date.getTime())) {
    throw HttpError.badRequest("Invalid delivery date");
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(y, m - 1, d, 0, 0, 0);
  if (start < today) {
    throw HttpError.badRequest("Delivery date can't be in the past");
  }
  return date;
}

export const createQuoteSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name"),
  phone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .refine((v) => PHONE_RE.test(v), "Enter a valid phone number"),
  email: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Enter a valid email",
    ),
  address: z.string().trim().min(10, "Please share a full delivery address"),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a delivery date"),
  description: z
    .string()
    .trim()
    .min(20, "Please describe what you're looking for")
    .max(1000),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  referenceImages: z.array(z.string().min(1).max(2048)).max(4).default([]),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

const QUOTE_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUOTED",
  "CONVERTED",
  "CLOSED",
] as const satisfies readonly QuoteStatus[];

export const updateQuoteSchema = z.object({
  status: z.enum(QUOTE_STATUSES).optional(),
  adminNotes: z.string().trim().max(2000).nullable().optional(),
  quotedAmount: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      return n;
    })
    .refine(
      (v) => v == null || (Number.isFinite(v) && v >= 0),
      "Enter a valid quote amount",
    ),
});

export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

const quoteSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  deliveryDate: true,
  description: true,
  referenceImages: true,
  notes: true,
  status: true,
  adminNotes: true,
  quotedAmount: true,
  quotedAt: true,
  respondedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function serializeQuote<
  T extends {
    quotedAmount: unknown;
    deliveryDate: Date;
    quotedAt: Date | null;
    respondedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
>(row: T) {
  return {
    ...row,
    quotedAmount:
      row.quotedAmount == null ? null : Number(row.quotedAmount).toFixed(2),
  };
}

export async function createQuoteRequest(input: CreateQuoteInput) {
  const deliveryDate = parseDeliveryDate(input.deliveryDate);
  await assertKitchenOpenOn(input.deliveryDate);
  const created = await prisma.quoteRequest.create({
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      address: input.address,
      deliveryDate,
      description: input.description,
      notes: input.notes ?? null,
      referenceImages: input.referenceImages,
    },
    select: { id: true },
  });
  return created;
}

export async function listQuoteRequests(status?: string | null) {
  const where =
    status && (QUOTE_STATUSES as readonly string[]).includes(status)
      ? { status: status as QuoteStatus }
      : undefined;

  const rows = await prisma.quoteRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: quoteSelect,
  });

  return rows.map((row) => serializeQuote(row));
}

export async function getQuoteRequestById(id: string) {
  const row = await prisma.quoteRequest.findUnique({
    where: { id },
    select: quoteSelect,
  });
  if (!row) throw HttpError.notFound("Quote request not found");
  return serializeQuote(row);
}

export async function updateQuoteRequest(id: string, input: UpdateQuoteInput) {
  const existing = await prisma.quoteRequest.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) throw HttpError.notFound("Quote request not found");

  const now = new Date();
  const data: {
    status?: QuoteStatus;
    adminNotes?: string | null;
    quotedAmount?: number | null;
    quotedAt?: Date | null;
    respondedAt?: Date;
  } = {};

  if (input.adminNotes !== undefined) data.adminNotes = input.adminNotes;
  if (input.quotedAmount !== undefined) {
    data.quotedAmount = input.quotedAmount;
    data.quotedAt = input.quotedAmount == null ? null : now;
    if (input.quotedAmount != null && !input.status) {
      data.status = "QUOTED";
    }
  }
  if (input.status) data.status = input.status;
  if (data.status && data.status !== "NEW") data.respondedAt = now;

  const updated = await prisma.quoteRequest.update({
    where: { id },
    data,
    select: quoteSelect,
  });
  return serializeQuote(updated);
}
