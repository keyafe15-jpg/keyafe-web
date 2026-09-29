import crypto from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../config/db.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Signs the user out everywhere, optionally keeping the session that made the request. */
export async function revokeUserSessions(
  userId: string,
  opts: { exceptRefreshToken?: string; db?: DbClient } = {},
): Promise<void> {
  const db = opts.db ?? prisma;
  await db.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(opts.exceptRefreshToken
        ? { tokenHash: { not: hashToken(opts.exceptRefreshToken) } }
        : {}),
    },
    data: { revokedAt: new Date() },
  });
}
