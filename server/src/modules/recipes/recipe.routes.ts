import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/httpError.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { imageFromUpload, rateLimitSuggest } from "../ai/ai.service.js";
import {
  pageJson,
  pageParams,
  RECIPE_UNITS,
  requireRecipeWrite,
} from "./recipe.shared.js";
import { importRecipesFromCsv } from "./recipe.csv.js";
import { parseRecipe } from "./recipe.parse.js";
import { renderRecipePdf } from "./recipe.pdf.js";
import {
  archiveRecipe,
  cloneVersion,
  createRecipe,
  getRecipe,
  listRecipes,
  loadVersionsForPrint,
  markVersionsPrinted,
  setCurrentVersion,
  updateRecipe,
} from "./recipe.service.js";

export const adminRecipeRouter = Router();

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES },
});

const unitSchema = z.enum(RECIPE_UNITS);

const ingredientSchema = z.object({
  name: z.string().trim().max(160).optional(),
  qty: z.coerce.number().positive(),
  unit: unitSchema,
  note: z.string().trim().max(160).optional().nullable(),
  buyItemId: z.string().min(1).optional().nullable(),
  componentRecipeId: z.string().min(1).optional().nullable(),
});

const usageSchema = z.object({
  axis1: z.string().trim().min(1).max(40),
  axis2: z.string().trim().max(40).optional().nullable(),
  qty: z.coerce.number().positive(),
  unit: unitSchema,
});

const versionSchema = z.object({
  yieldQty: z.coerce.number().positive().optional().nullable(),
  yieldUnit: unitSchema.optional().nullable(),
  yieldNote: z.string().trim().max(160).optional().nullable(),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(z.string().trim().max(2000)).default([]),
  usage: z.array(usageSchema).default([]),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  categoryId: z.string().min(1),
  version: versionSchema,
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  categoryId: z.string().min(1).optional(),
  version: versionSchema.optional(),
});

adminRecipeRouter.get("/", async (req, res) => {
  const { page, pageSize, skip } = pageParams(req.query);
  const printedRaw = typeof req.query.printed === "string" ? req.query.printed : "";
  const printed = printedRaw === "yes" || printedRaw === "no" ? printedRaw : undefined;
  const result = await listRecipes({
    q: typeof req.query.q === "string" ? req.query.q : undefined,
    category: typeof req.query.category === "string" ? req.query.category : undefined,
    printed,
    page,
    pageSize,
    skip,
  });
  res.json({
    ...pageJson(result.items, result.total, page, pageSize),
    categories: result.categories,
  });
});

adminRecipeRouter.post("/parse", receiptUpload.single("image"), async (req, res) => {
  const staff = requireRecipeWrite(req as AuthenticatedRequest);
  rateLimitSuggest(staff.id);
  if (!req.file) throw HttpError.badRequest("Add a photo or screenshot of the recipe.");
  const context =
    typeof req.body?.context === "string" ? req.body.context.trim().slice(0, 400) : null;
  const image = imageFromUpload(req.file);
  res.json(await parseRecipe({ image, context }));
});

adminRecipeRouter.post("/import", receiptUpload.single("file"), async (req, res) => {
  requireRecipeWrite(req as AuthenticatedRequest);
  if (!req.file) throw HttpError.badRequest("Add a recipes CSV.");
  const text = req.file.buffer.toString("utf8");
  res.json(await importRecipesFromCsv(text));
});

adminRecipeRouter.post("/print", async (req, res) => {
  requireRecipeWrite(req as AuthenticatedRequest);
  const parsed = z
    .object({
      recipeIds: z.array(z.string().min(1)).optional(),
      versionIds: z.array(z.string().min(1)).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Pick recipes to print.");
  const versions = await loadVersionsForPrint(parsed.data);
  const pdf = await renderRecipePdf(versions);
  await markVersionsPrinted(versions.map((v) => v.id));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="keyafe-recipes-${versions.length}.pdf"`,
  );
  res.send(pdf);
});

adminRecipeRouter.get("/:id", async (req, res) => {
  res.json(await getRecipe(req.params.id ?? ""));
});

adminRecipeRouter.post("/", async (req, res) => {
  requireRecipeWrite(req as AuthenticatedRequest);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Invalid recipe", parsed.error.flatten());
  const created = await createRecipe(parsed.data);
  res.status(201).json(created);
});

adminRecipeRouter.patch("/:id", async (req, res) => {
  requireRecipeWrite(req as AuthenticatedRequest);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Invalid recipe", parsed.error.flatten());
  res.json(await updateRecipe(req.params.id ?? "", parsed.data));
});

adminRecipeRouter.post("/:id/versions", async (req, res) => {
  requireRecipeWrite(req as AuthenticatedRequest);
  const label =
    typeof req.body?.label === "string" ? req.body.label.trim().slice(0, 40) : undefined;
  res.status(201).json(await cloneVersion(req.params.id ?? "", label));
});

adminRecipeRouter.post("/:id/current", async (req, res) => {
  requireRecipeWrite(req as AuthenticatedRequest);
  const versionId = typeof req.body?.versionId === "string" ? req.body.versionId : "";
  if (!versionId) throw HttpError.badRequest("Pick a version.");
  res.json(await setCurrentVersion(req.params.id ?? "", versionId));
});

adminRecipeRouter.post("/:id/archive", async (req, res) => {
  requireRecipeWrite(req as AuthenticatedRequest);
  res.json(await archiveRecipe(req.params.id ?? ""));
});
