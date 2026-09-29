import crypto from "node:crypto";
import { Router, type Request } from "express";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/httpError.js";
import { normalizeCustomerPhone, phoneLookupVariants, phonesMatch } from "../../lib/phone.js";
import { isIndianMobile, isMsg91Configured, sendOtpSms } from "../../lib/msg91.js";
import {
  burnPasswordCheck,
  hashPassword,
  passwordSchema,
  verifyPassword,
} from "../../lib/password.js";
import { ensureCustomerRole } from "../customers/customer.service.js";
import { sendEmail } from "../email/email.service.js";
import { renderPasswordReset } from "../email/templates.js";
import { isStaffRole, requireAuth, type AuthenticatedRequest } from "../../middleware/auth.js";
import { CUSTOMER_ROLE_SLUG } from "../staff/rbac.catalog.js";
import { logger } from "../../utils/logger.js";
import { hashToken, revokeUserSessions } from "./sessions.js";

export const authRouter = Router();

const normalizePhone = normalizeCustomerPhone;

const phoneSchema = z
  .string()
  .trim()
  .transform((value) => normalizePhone(value))
  .refine((value) => /^(?:\+?[1-9]\d{7,14}|[6-9]\d{9})$/.test(value), "Enter a valid phone number");
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
  audience: z.enum(["storefront", "admin"]).optional(),
  name: z.string().trim().min(2, "Please enter your name").optional(),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const otpStore = new Map<string, { code: string; expiresAt: number }>();

const OTP_COOLDOWN_MS = 45_000;
const OTP_DAILY_CAP = 15;
const otpRateStore = new Map<string, { lastSentAt: number; dayKey: string; count: number }>();

function assertOtpRateLimit(phone: string) {
  const key = normalizePhone(phone);
  const now = Date.now();
  const dayKey = new Date().toISOString().slice(0, 10);
  const current = otpRateStore.get(key);

  if (current && now - current.lastSentAt < OTP_COOLDOWN_MS) {
    const waitSec = Math.ceil((OTP_COOLDOWN_MS - (now - current.lastSentAt)) / 1000);
    throw HttpError.tooManyRequests(`Please wait ${waitSec}s before requesting another OTP`);
  }

  const count = current && current.dayKey === dayKey ? current.count : 0;
  if (count >= OTP_DAILY_CAP) {
    throw HttpError.tooManyRequests("Daily OTP limit reached for this number. Try again tomorrow.");
  }
}

function recordOtpSend(phone: string) {
  const key = normalizePhone(phone);
  const dayKey = new Date().toISOString().slice(0, 10);
  const current = otpRateStore.get(key);
  const count = current && current.dayKey === dayKey ? current.count : 0;
  otpRateStore.set(key, { lastSentAt: Date.now(), dayKey, count: count + 1 });
}

function clearIssuedOtp(phone: string) {
  otpStore.delete(normalizePhone(phone));
}

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

const DAY_MS = 24 * 60 * 60 * 1000;
// Staff sessions slide forward on every refresh, so an admin stays signed in until they log out.
const STAFF_REFRESH_TTL_MS = 365 * DAY_MS;
const CUSTOMER_REFRESH_TTL_MS = 30 * DAY_MS;

function isStaffUser(role: { slug: string; isSuperuser: boolean }): boolean {
  return isStaffRole(role) && role.slug !== CUSTOMER_ROLE_SLUG;
}

function refreshExpiryFor(role: { slug: string; isSuperuser: boolean }): Date {
  return new Date(
    Date.now() + (isStaffUser(role) ? STAFF_REFRESH_TTL_MS : CUSTOMER_REFRESH_TTL_MS),
  );
}

const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(1),
});

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
  passwordHash: string | null;
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
    hasPassword: user.passwordHash != null,
    role: {
      slug: user.role.slug,
      isSuperuser: user.role.isSuperuser,
      permissions: user.role.permissions.map((row) => row.permission.key),
    },
  };
}

type SessionUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;

async function issueSession(user: SessionUser, req: Request) {
  const accessToken = signAccessToken(user.id, user.phone);
  const refreshToken = crypto.randomBytes(32).toString("hex");

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiryFor(user.role),
      ip: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    },
  });

  return {
    user: serializeUser(user),
    accessToken,
    refreshToken,
    tokenType: "Bearer" as const,
  };
}

function assertAdminAudience(user: SessionUser | null): asserts user is SessionUser {
  if (!user) {
    throw HttpError.forbidden("No staff account for this phone. Ask an admin to add you.");
  }
  if (!user.isActive) {
    throw HttpError.forbidden("This staff account is disabled");
  }
  if (!isStaffUser(user.role)) {
    throw HttpError.forbidden("This phone is a customer account, not staff");
  }
}

// A password set on a number nobody has proven they own (password sign-up) is dropped
// the first time the real owner signs in with OTP, along with the unverified email a
// reset link could be sent to.
async function reclaimUnverifiedAccount(user: SessionUser): Promise<SessionUser> {
  logger.info({ userId: user.id }, "OTP sign-in reclaimed an unverified password account");
  return prisma.$transaction(async (tx) => {
    await revokeUserSessions(user.id, { db: tx });
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
    return tx.user.update({
      where: { id: user.id },
      data: { passwordHash: null, passwordUpdatedAt: null, email: null, emailVerifiedAt: null },
      include: userInclude,
    });
  });
}

// In-memory attempt counters, like the OTP limiter above. Each key allows `max`
// events per window, then locks until the window ends.
const ATTEMPT_WINDOW_MS = 15 * 60_000;
const attemptStore = new Map<string, { count: number; windowStart: number }>();

function isAttemptLocked(key: string, max: number): boolean {
  const entry = attemptStore.get(key);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > ATTEMPT_WINDOW_MS) {
    attemptStore.delete(key);
    return false;
  }
  return entry.count >= max;
}

function assertAttemptsAllowed(key: string, max: number) {
  if (!isAttemptLocked(key, max)) return;
  const entry = attemptStore.get(key)!;
  const waitMin = Math.ceil((ATTEMPT_WINDOW_MS - (Date.now() - entry.windowStart)) / 60_000);
  throw HttpError.tooManyRequests(`Too many attempts. Please try again in ${waitMin} min.`);
}

function recordAttempt(key: string) {
  const now = Date.now();
  const entry = attemptStore.get(key);
  if (!entry || now - entry.windowStart > ATTEMPT_WINDOW_MS) {
    attemptStore.set(key, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

const LOGIN_FAILURES_PER_PHONE = 5;
const LOGIN_FAILURES_PER_IP = 30;
const REGISTRATIONS_PER_IP = 10;
const RESET_REQUESTS_PER_PHONE = 3;
const PASSWORD_CHANGE_FAILURES = 5;
const RESET_TOKEN_TTL_MS = 30 * 60_000;

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
  const configured = isMsg91Configured();
  const isProd = env.NODE_ENV === "production";

  if (configured && !isIndianMobile(phone)) {
    throw HttpError.badRequest("OTP SMS is only available for Indian mobile numbers right now");
  }

  if (isProd && !configured) {
    throw HttpError.serviceUnavailable("OTP service is temporarily unavailable");
  }

  assertOtpRateLimit(phone);

  const otp = issueOtp(phone);
  const delivery = await sendOtpSms(phone, otp);

  if (!delivery.ok) {
    clearIssuedOtp(phone);
    throw HttpError.serviceUnavailable(delivery.error);
  }

  recordOtpSend(phone);

  if (delivery.skipped) {
    logger.info({ phone }, "OTP issued without SMS (MSG91 not configured)");
  }

  res.json({
    message: "OTP sent successfully",
    expiresInSeconds: 300,
    otp: isProd ? undefined : otp,
  });
});

authRouter.post("/verify-otp", async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid OTP request", parsed.error.flatten());
  }

  const { phone, otp, name, email, audience } = parsed.data;
  const normalizedPhone = normalizePhone(phone);
  const isAdminAudience = audience === "admin";

  if (!validateOtp(normalizedPhone, otp)) {
    throw HttpError.unauthorized("Invalid or expired OTP");
  }

  let user = await findUserByPhone(normalizedPhone);

  if (isAdminAudience) {
    assertAdminAudience(user);
  }

  if (user && !user.phoneVerifiedAt && user.passwordHash) {
    user = await reclaimUnverifiedAccount(user);
  }

  if (!user && !isAdminAudience) {
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
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
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
    if (!user) {
      throw HttpError.unauthorized("Invalid or expired OTP");
    }
    const emailConflict =
      email && !user.email ? await prisma.user.findUnique({ where: { email } }) : null;
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

  res.json(await issueSession(user, req));
});

const loginPasswordSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "Enter your password").max(256),
  audience: z.enum(["storefront", "admin"]).optional(),
});

const INVALID_LOGIN_MESSAGE = "Incorrect phone number or password";

authRouter.post("/login-password", async (req, res) => {
  const parsed = loginPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid sign-in request", parsed.error.flatten());
  }

  const { phone, password, audience } = parsed.data;
  const normalizedPhone = normalizePhone(phone);
  const phoneKey = `login-phone:${normalizedPhone}`;
  const ipKey = `login-ip:${req.ip ?? "unknown"}`;
  assertAttemptsAllowed(phoneKey, LOGIN_FAILURES_PER_PHONE);
  assertAttemptsAllowed(ipKey, LOGIN_FAILURES_PER_IP);

  const user = await findUserByPhone(normalizedPhone);
  let valid = false;
  if (user?.passwordHash) {
    valid = await verifyPassword(password, user.passwordHash);
  } else {
    await burnPasswordCheck(password);
  }

  if (!user || !valid) {
    recordAttempt(phoneKey);
    recordAttempt(ipKey);
    throw HttpError.unauthorized(INVALID_LOGIN_MESSAGE);
  }
  attemptStore.delete(phoneKey);

  if (audience === "admin") {
    assertAdminAudience(user);
  } else if (!user.isActive) {
    throw HttpError.forbidden("This account is disabled");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    include: userInclude,
  });

  res.json(await issueSession(updated, req));
});

const registerPasswordSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name"),
  phone: phoneSchema,
  password: passwordSchema,
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

// Only brand-new numbers can sign up with a password. An existing profile (including
// the guest profile created at checkout) may hold someone else's orders, and nothing
// here proves the caller owns the phone.
authRouter.post("/register-password", async (req, res) => {
  const parsed = registerPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid sign-up request", parsed.error.flatten());
  }

  const ipKey = `register-ip:${req.ip ?? "unknown"}`;
  assertAttemptsAllowed(ipKey, REGISTRATIONS_PER_IP);

  const { name, phone, password, email } = parsed.data;
  const normalizedPhone = normalizePhone(phone);
  const existsMessage =
    "An account already exists for this number. Sign in with OTP, or use Forgot password if you added an email.";

  if (await findUserByPhone(normalizedPhone)) {
    throw HttpError.conflict(existsMessage);
  }
  if (email && (await prisma.user.findUnique({ where: { email } }))) {
    throw HttpError.conflict("An account with this email already exists");
  }

  const role = await ensureCustomerRoleForAuth();
  let user: SessionUser;
  try {
    user = await prisma.user.create({
      data: {
        name,
        phone: normalizedPhone,
        email: email ?? null,
        roleId: role.id,
        passwordHash: await hashPassword(password),
        passwordUpdatedAt: new Date(),
        lastLoginAt: new Date(),
      },
      include: userInclude,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw HttpError.conflict(existsMessage);
    }
    throw err;
  }
  recordAttempt(ipKey);

  res.status(201).json(await issueSession(user, req));
});

const changePasswordSchema = z.object({
  currentPassword: z.string().max(256).optional(),
  newPassword: passwordSchema,
  refreshToken: z.string().trim().min(1).optional(),
});

authRouter.post("/password", requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid password change", parsed.error.flatten());
  }

  const userId = (req as AuthenticatedRequest).user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw HttpError.unauthorized("Invalid or expired session");
  }

  const { currentPassword, newPassword, refreshToken } = parsed.data;
  if (user.passwordHash) {
    const failKey = `change-password:${user.id}`;
    assertAttemptsAllowed(failKey, PASSWORD_CHANGE_FAILURES);
    if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
      recordAttempt(failKey);
      throw HttpError.badRequest("Current password is incorrect");
    }
    attemptStore.delete(failKey);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), passwordUpdatedAt: new Date() },
  });
  await revokeUserSessions(user.id, { exceptRefreshToken: refreshToken });

  res.json({ message: "Password updated" });
});

const forgotPasswordSchema = z.object({
  phone: phoneSchema,
  audience: z.enum(["storefront", "admin"]).optional(),
});

const FORGOT_PASSWORD_MESSAGE =
  "If this account has an email address, we've sent it a link to reset the password.";

authRouter.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid phone number", parsed.error.flatten());
  }

  const { phone, audience } = parsed.data;
  const normalizedPhone = normalizePhone(phone);
  const limitKey = `reset-phone:${normalizedPhone}`;

  // Same response in every case, so this can't be used to probe which numbers exist.
  const respond = () => res.json({ message: FORGOT_PASSWORD_MESSAGE });

  if (isAttemptLocked(limitKey, RESET_REQUESTS_PER_PHONE)) return respond();
  recordAttempt(limitKey);

  const user = await findUserByPhone(normalizedPhone);
  const isAdmin = audience === "admin";
  if (!user || !user.isActive || !user.email || (isAdmin && !isStaffUser(user.role))) {
    return respond();
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    }),
  ]);

  const origin = isAdmin ? env.ADMIN_ORIGIN : env.CLIENT_ORIGIN;
  const { subject, html } = renderPasswordReset({
    name: user.name,
    link: `${origin}/reset-password?token=${rawToken}`,
    expiresInMinutes: RESET_TOKEN_TTL_MS / 60_000,
  });
  void sendEmail({ to: user.email, subject, html });

  respond();
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1),
  password: passwordSchema,
});

authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid reset request", parsed.error.flatten());
  }

  const invalid = () => HttpError.badRequest("This reset link is invalid or has expired");
  const { token, password } = parsed.data;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) throw invalid();
  if (!record.user.isActive) throw invalid();

  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) throw invalid();
    await tx.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        passwordUpdatedAt: new Date(),
        emailVerifiedAt: record.user.emailVerifiedAt ?? new Date(),
      },
    });
    await tx.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null },
    });
    await revokeUserSessions(record.userId, { db: tx });
  });

  res.json({ message: "Password updated. You can now sign in." });
});

// The same refresh token is returned rather than rotated: several open admin tabs
// refresh concurrently, and rotation would make them revoke each other.
authRouter.post("/refresh", async (req, res) => {
  const parsed = refreshTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.unauthorized("Invalid or expired session");
  }

  const { refreshToken } = parsed.data;
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: { include: userInclude } },
  });

  if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
    throw HttpError.unauthorized("Invalid or expired session");
  }
  const { user } = record;
  if (!user.isActive) {
    throw HttpError.unauthorized("Invalid or expired session");
  }

  if (isStaffUser(user.role)) {
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { expiresAt: refreshExpiryFor(user.role) },
    });
  }

  res.json({
    user: serializeUser(user),
    accessToken: signAccessToken(user.id, user.phone),
    refreshToken,
    tokenType: "Bearer",
  });
});

authRouter.post("/logout", async (req, res) => {
  const parsed = refreshTokenSchema.safeParse(req.body);
  if (parsed.success) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(parsed.data.refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.json({ message: "Logged out" });
});
