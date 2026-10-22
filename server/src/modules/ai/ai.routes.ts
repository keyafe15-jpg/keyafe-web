import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { HttpError } from "../../utils/httpError.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { PHOTO_KINDS, SUGGEST_KINDS } from "./prompts/copy.js";
import {
  imageFromUpload,
  loadImageFromUrl,
  rateLimitSuggest,
  requirePhoto,
  suggestCopy,
  type SuggestImage,
} from "./ai.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

const bodySchema = z.object({
  kind: z.enum(SUGGEST_KINDS),
  name: z.string().trim().max(200).optional(),
  shortDescription: z.string().trim().max(400).optional(),
  description: z.string().trim().max(2000).optional(),
  flavour: z.string().trim().max(120).optional(),
  size: z.string().trim().max(80).optional(),
  group: z.string().trim().max(120).optional(),
  extra: z.string().trim().max(4000).optional(),
  imageUrl: z.string().trim().max(500).optional(),
});

export const adminSuggestRouter = Router();

adminSuggestRouter.post("/", upload.single("image"), async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid suggest request", parsed.error.flatten());
  }

  const staffId = (req as AuthenticatedRequest).staff?.id;
  if (!staffId) throw HttpError.unauthorized();
  rateLimitSuggest(staffId);

  let image: SuggestImage | null = null;
  if (req.file) {
    image = imageFromUpload(req.file);
  } else if (parsed.data.imageUrl) {
    image = await loadImageFromUrl(parsed.data.imageUrl);
  }
  if (PHOTO_KINDS.has(parsed.data.kind)) {
    requirePhoto(parsed.data.kind, image);
  }

  const { imageUrl: _ignored, ...ctx } = parsed.data;
  const bundle = await suggestCopy(ctx, image);
  res.json(bundle);
});
