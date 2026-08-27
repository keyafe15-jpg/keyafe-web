import { createApp } from "./app.js";
import { connectDb, disconnectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { storage } from "./lib/storage/index.js";
import { LocalDiskStorage } from "./lib/storage/local.js";

async function main(): Promise<void> {
  if (storage instanceof LocalDiskStorage) {
    await storage.ensureRoot();
    logger.info(`Local storage ready at ${storage.getBaseDir()}`);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Server listening on http://localhost:${env.PORT}`);
  });

  connectDb().catch((err) => {
    logger.error({ err }, "Failed to connect to Postgres — running without DB");
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb().catch(() => undefined);
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
