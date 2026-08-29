import { z } from "zod";

export const normalizePhone = (value: string) =>
  value.trim().replace(/[\s().-]/g, "");

export const formatPhoneWithCountryCode = (
  countryCode: string,
  phone: string,
) => {
  const normalizedCountryCode = countryCode.trim();
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedCountryCode) return normalizedPhone;
  return `${normalizedCountryCode}${normalizedPhone.startsWith("+") ? normalizedPhone.slice(1) : normalizedPhone}`;
};

export const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^\+\d{1,4}$/, "Select a valid country code");

export const phoneNumberSchema = z
  .string()
  .trim()
  .transform((value) => normalizePhone(value))
  .refine((value) => /^\d{5,15}$/.test(value), "Enter a valid phone number");

// Accept Indian mobile numbers as well as international numbers like +91..., +1..., +44...
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => normalizePhone(value))
  .refine(
    (value) => /^(?:\+?[1-9]\d{7,14}|[6-9]\d{9})$/.test(value),
    "Enter a valid phone number",
  );

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit OTP");

export const otpAuthSchema = z.object({
  countryCode: countryCodeSchema.default("+91"),
  name: z
    .string()
    .trim()
    .min(2, "Please enter your name")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: phoneNumberSchema,
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  otp: otpSchema,
});
export type OtpAuthInput = z.infer<typeof otpAuthSchema>;

export const loginSchema = z.object({
  phone: phoneSchema,
  otp: otpSchema,
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
  otp: otpSchema,
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
