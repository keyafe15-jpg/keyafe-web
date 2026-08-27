import { Router } from "express";
import { prisma } from "../../config/db.js";
import { computeSameDayStatus } from "./store.service.js";

export const storeRouter = Router();

storeRouter.get("/same-day-status", async (_req, res) => {
  const status = await computeSameDayStatus();
  res.setHeader("Cache-Control", "no-store");
  res.json(status);
});

storeRouter.get("/same-day-categories", async (_req, res) => {
  const categories = await prisma.sameDayCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      imageUrl: true,
      sortOrder: true,
    },
  });
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(categories);
});
