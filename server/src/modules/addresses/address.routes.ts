import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { requireAuth } from "../../middleware/auth.js";
import { HttpError } from "../../utils/httpError.js";

export const addressRouter = Router();

const addressSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(50),
  recipientName: z.string().trim().min(2, "Recipient name is required").max(80),
  phone: z.string().trim().min(7, "Phone is required").max(20),
  line1: z.string().trim().min(3, "Address line 1 is required").max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  landmark: z.string().trim().max(200).optional().or(z.literal("")),
  mapSearchQuery: z
    .string()
    .trim()
    .min(3, "Rapido search is required")
    .max(200, "Search text is too long"),
  city: z.string().trim().min(2, "City is required").max(80),
  state: z.string().trim().min(2, "State is required").max(80),
  stateCode: z.string().trim().min(1, "State code is required").max(10),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
  isDefault: z.boolean().optional(),
});

addressRouter.use(requireAuth);

addressRouter.get("/", async (req, res) => {
  const userId = (req as any).user.id as string;

  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  res.json(addresses);
});

addressRouter.post("/", async (req, res) => {
  const userId = (req as any).user.id as string;
  const parsed = addressSchema.safeParse(req.body);

  if (!parsed.success) {
    throw HttpError.badRequest(
      "Invalid address payload",
      parsed.error.flatten(),
    );
  }

  const input = parsed.data;

  const existing = await prisma.address.findMany({ where: { userId } });

  if (input.isDefault || existing.length === 0) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.create({
    data: {
      userId,
      label: input.label,
      recipientName: input.recipientName,
      phone: input.phone,
      line1: input.line1,
      line2: input.line2 || null,
      landmark: input.landmark || null,
      mapSearchQuery: input.mapSearchQuery,
      city: input.city,
      state: input.state,
      stateCode: input.stateCode,
      pincode: input.pincode,
      isDefault: input.isDefault ?? existing.length === 0,
    },
  });

  res.status(201).json(address);
});

addressRouter.patch("/:id/default", async (req, res) => {
  const userId = (req as any).user.id as string;
  const { id } = req.params;

  const target = await prisma.address.findFirst({
    where: { id, userId },
  });

  if (!target) {
    throw HttpError.notFound("Address not found");
  }

  await prisma.address.updateMany({
    where: { userId },
    data: { isDefault: false },
  });

  const updated = await prisma.address.update({
    where: { id },
    data: { isDefault: true },
  });

  res.json(updated);
});

addressRouter.delete("/:id", async (req, res) => {
  const userId = (req as any).user.id as string;
  const { id } = req.params;

  const address = await prisma.address.findFirst({
    where: { id, userId },
  });

  if (!address) {
    throw HttpError.notFound("Address not found");
  }

  await prisma.address.delete({ where: { id } });
  res.json({ success: true, id });
});
