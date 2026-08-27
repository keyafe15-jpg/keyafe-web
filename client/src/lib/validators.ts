import { z } from "zod";

// Indian mobile: 10 digits starting with 6/7/8/9.
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");

export const passwordSchema = z
  .string()
  .min(6, "Minimum 6 characters")
  .max(72, "Maximum 72 characters");

export const loginSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name"),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

// Get-a-quote request: for custom designs not in the catalogue.
export const getQuoteSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name"),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  address: z.string().trim().min(10, "Please share a full delivery address"),
  deliveryDate: z
    .string()
    .min(1, "Pick a delivery date")
    .refine((v) => {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d >= today;
    }, "Delivery date can't be in the past"),
  description: z
    .string()
    .trim()
    .min(20, "Please describe what you're looking for (min 20 chars)")
    .max(1000, "Too long — please keep it under 1000 characters"),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type GetQuoteInput = z.infer<typeof getQuoteSchema>;
