import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";

export const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "error" },
    { emit: "event", level: "warn" },
  ],
});

prisma.$on("error", (e) => logger.error({ target: e.target }, e.message));
prisma.$on("warn", (e) => logger.warn({ target: e.target }, e.message));

export async function connectDb(): Promise<void> {
  await prisma.$connect();
  logger.info("Postgres connected");
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
  logger.info("Postgres disconnected");
}
