import crypto from "node:crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/httpError.js";
import {
  normalizeCustomerPhone,
  phoneLookupVariants,
  phonesMatch,
} from "../../lib/phone.js";
import { ensureCustomerRole } from "../customers/customer.service.js";

export const authRouter = Router();

const normalizePhone = normalizeCustomerPhone;

const phoneSchema = z
  .string()
  .trim()
  .transform((value) => normalizePhone(value))
  .refine(
    (value) => /^(?:\+?[1-9]\d{7,14}|[6-9]\d{9})$/.test(value),
    "Enter a valid phone number",
  );
const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit OTP");

const sendOtpSchema = z.object({
  phone: phoneSchema,
});

const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: otpSchema,
  name: z.string().trim().min(2, "Please enter your name").optional(),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const otpStore = new Map<string, { code: string; expiresAt: number }>();

const userInclude = {
  role: {
    include: {
      permissions: { include: { permission: true } },
    },
  },
} as const;

async function findUserByPhone(phone: string) {
  for (const variant of phoneLookupVariants(phone)) {
    const user = await prisma.user.findUnique({
      where: { phone: variant },
      include: userInclude,
    });
    if (user) return user;
  }
  return null;
}

async function completeRegistration(
  user: { id: string; phone: string; phoneVerifiedAt: Date | null; email: string | null },
  input: { phone: string; name?: string; email?: string },
) {
  return prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      phoneVerifiedAt: user.phoneVerifiedAt ?? new Date(),
      ...(input.phone !== user.phone ? { phone: input.phone } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.email && !user.email ? { email: input.email } : {}),
    },
    include: userInclude,
  });
}

function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signAccessToken(userId: string, phone: string): string {
  return jwt.sign({ sub: userId, type: "access", phone }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

async function ensureCustomerRoleForAuth() {
  return ensureCustomerRole();
}

function serializeUser(user: {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: {
    slug: string;
    isSuperuser: boolean;
    permissions: { permission: { key: string } }[];
  };
}) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email ?? undefined,
    role: {
      slug: user.role.slug,
      isSuperuser: user.role.isSuperuser,
      permissions: user.role.permissions.map((row) => row.permission.key),
    },
  };
}

function issueOtp(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(normalizedPhone, {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return code;
}

function validateOtp(phone: string, code: string) {
  const normalizedPhone = normalizePhone(phone);
  const record = otpStore.get(normalizedPhone);
  if (!record) return false;
  if (record.expiresAt < Date.now()) {
    otpStore.delete(normalizedPhone);
    return false;
  }
  return record.code === code;
}

function consumeOtp(phone: string, code: string) {
  const normalizedPhone = normalizePhone(phone);
  const matches = validateOtp(normalizedPhone, code);
  if (matches) otpStore.delete(normalizedPhone);
  return matches;
}

authRouter.post("/send-otp", async (req, res) => {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid phone number", parsed.error.flatten());
  }

  const { phone } = parsed.data;
  const otp = issueOtp(phone);

  res.json({
    message: "OTP sent successfully",
    expiresInSeconds: 300,
    otp: env.NODE_ENV !== "production" ? otp : undefined,
  });
});

authRouter.post("/verify-otp", async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid OTP request", parsed.error.flatten());
  }

  const { phone, otp, name, email } = parsed.data;
  const normalizedPhone = normalizePhone(phone);

  if (!validateOtp(normalizedPhone, otp)) {
    throw HttpError.unauthorized("Invalid or expired OTP");
  }

  let user = await findUserByPhone(normalizedPhone);

  if (!user) {
    if (!name) {
      return res.status(202).json({
        requiresProfile: true,
        phone: normalizedPhone,
        message: "Complete your profile to finish account setup",
      });
    }

    const existingEmail = email
      ? await prisma.user.findUnique({ where: { email }, include: userInclude })
      : null;

    if (existingEmail) {
      if (phonesMatch(existingEmail.phone, normalizedPhone)) {
        user = await completeRegistration(existingEmail, {
          phone: normalizedPhone,
          name,
          email,
        });
      } else {
        throw HttpError.conflict("An account with this email already exists");
      }
    } else {
      const role = await ensureCustomerRoleForAuth();
      try {
        user = await prisma.user.create({
          data: {
            name,
            phone: normalizedPhone,
            email: email ?? null,
            roleId: role.id,
            phoneVerifiedAt: new Date(),
            lastLoginAt: new Date(),
          },
          include: userInclude,
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          const retry = await findUserByPhone(normalizedPhone);
          if (!retry) throw err;
          user = await completeRegistration(retry, {
            phone: normalizedPhone,
            name,
            email,
          });
        } else {
          throw err;
        }
      }
    }
  } else {
    const emailConflict =
      email && !user.email
        ? await prisma.user.findUnique({ where: { email } })
        : null;
    if (emailConflict && emailConflict.id !== user.id) {
      throw HttpError.conflict("An account with this email already exists");
    }

    user = await completeRegistration(user, {
      phone: normalizedPhone,
      name,
      email,
    });
  }

  if (!consumeOtp(normalizedPhone, otp)) {
    throw HttpError.unauthorized("Invalid or expired OTP");
  }

  const accessToken = signAccessToken(user.id, user.phone);
  const refreshToken = crypto.randomBytes(32).toString("hex");

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ip: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    },
  });

  res.json({
    user: serializeUser(user),
    accessToken,
    refreshToken,
    tokenType: "Bearer",
  });
});
