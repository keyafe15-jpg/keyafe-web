import { Router } from "express";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let dbStatus: "connected" | "disconnected" = "disconnected";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  res.json({
    status: "ok",
    version: env.APP_VERSION ?? null,
    uptime: process.uptime(),
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
});
