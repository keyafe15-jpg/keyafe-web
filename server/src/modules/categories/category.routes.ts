import { Router } from "express";
import { getCategoryTree } from "./category.service.js";

export const categoryRouter = Router();

categoryRouter.get("/", async (_req, res) => {
  const tree = await getCategoryTree();
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(tree);
});
