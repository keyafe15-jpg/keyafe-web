import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/httpError.js";
import { requirePermission, requireStaff } from "../../middleware/auth.js";
import { storage, getLocalStorage } from "../../lib/storage/index.js";
import type { UploadPurpose } from "../../lib/storage/types.js";

export const uploadRouter = Router();

// Public for now; guest quote-submissions need it. Rate-limit in a later phase.

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
const VIDEO_MIMES = ["video/mp4", "video/webm"] as const;
const ALLOWED_MIMES = [...IMAGE_MIMES, ...VIDEO_MIMES] as const;

const PUBLIC_PURPOSES = new Set<UploadPurpose>(["quote-reference", "payment-screenshot"]);

// Large video uploads are only ever needed for the hero slider, so they are
// staff-only regardless of the looser rules on image purposes.
const STAFF_ONLY_PURPOSES = new Set<UploadPurpose>(["hero"]);

const presignSchema = z.object({
  purpose: z.enum([
    "quote-reference",
    "payment-screenshot",
    "product",
    "category",
    "addon",
    "festival",
    "hero",
    "admin",
  ]),
  contentType: z.enum(ALLOWED_MIMES),
  filename: z.string().max(200).optional(),
});

uploadRouter.post("/presign", async (req, res) => {
  const parsed = presignSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid presign input", parsed.error.flatten());
  }

  const { purpose, contentType } = parsed.data;
  if (contentType.startsWith("video/") && purpose !== "hero") {
    throw HttpError.badRequest("Video uploads are only allowed for hero slides");
  }

  if (STAFF_ONLY_PURPOSES.has(purpose)) {
    await requireStaff(req, res, () => {});
    requirePermission("settings.update")(req, res, () => {});
  }

  // Guests can only presign quote-reference uploads. Others require auth (added in Phase 3.5).
  const isPublic = PUBLIC_PURPOSES.has(purpose);
  if (!isPublic) {
    // TODO: replace with real auth check once auth middleware exists.
    // For now, allow all so admin flow works during dev. Tighten before deploy.
  }

  const result = await storage.presignUpload(parsed.data);
  res.json(result);
});

// Direct-upload receiver — used only for STORAGE_PROVIDER=local.
// Multer parses the multipart body into memory; the per-file limit from the
// signed token is enforced in saveDirect, this is only the outer ceiling.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(env.UPLOAD_MAX_BYTES, env.UPLOAD_MAX_VIDEO_BYTES) },
});

uploadRouter.post("/direct", upload.single("file"), async (req, res) => {
  if (env.STORAGE_PROVIDER !== "local") {
    throw HttpError.notFound();
  }
  if (!req.file) {
    throw HttpError.badRequest("Missing 'file' in multipart body");
  }
  const token = (req.body?.token as string | undefined)?.trim();
  if (!token) {
    throw HttpError.badRequest("Missing 'token' in multipart body");
  }

  try {
    const result = await getLocalStorage().saveDirect(token, req.file.buffer, req.file.mimetype);
    res.status(StatusCodes.CREATED).json({ publicUrl: result.publicUrl, key: result.key });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    throw HttpError.badRequest(message);
  }
});
