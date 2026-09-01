import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:5175"),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  // Storage
  STORAGE_PROVIDER: z
    .enum(["local", "r2", "s3", "cloudinary"])
    .default("local"),
  UPLOAD_DIR: z.string().default("./uploads"),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:4000"),
  UPLOAD_TOKEN_SECRET: z
    .string()
    .min(16, "UPLOAD_TOKEN_SECRET must be at least 16 chars")
    .default("dev-only-upload-secret-change-me"),
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(12 * 1024 * 1024),

  // Email — SMTP (Gmail app password recommended). If SMTP_USER/PASS are
  // missing, emails are only logged so dev flows keep working.
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("Keyafe Bakery <keyafe15@gmail.com>"),

  // Web Push (VAPID). If either key is missing, push endpoints stay
  // functional but sendPushToAll() no-ops with a warning.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:admin@keyafe.in"),

  // WhatsApp Cloud API (Meta). Leave blank until the bakery number is connected;
  // sendStaffWhatsApp() then only logs. WHATSAPP_STAFF_TO is comma-separated
  // E.164-ish numbers (e.g. 919330048665) that receive staff alerts.
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_STAFF_TO: z.string().optional(),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 chars")
    .default("dev-secret-keyafe-please-change-me-2026"),
  JWT_EXPIRES_IN: z.string().default("7d"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
