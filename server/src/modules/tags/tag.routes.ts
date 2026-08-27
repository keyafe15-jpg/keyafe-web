import { Router } from "express";
import { prisma } from "../../config/db.js";

export const tagRouter = Router();

tagRouter.get("/", async (_req, res) => {
  const tags = await prisma.tag.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      colorHex: true,
    },
  });
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(tags);
});
