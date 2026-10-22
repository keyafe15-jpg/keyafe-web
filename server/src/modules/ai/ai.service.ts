import { env } from "../../config/env.js";
import { HttpError } from "../../utils/httpError.js";
import { logger } from "../../utils/logger.js";
import {
  buildCopyPrompt,
  PHOTO_KINDS,
  type SuggestContext,
  type SuggestKind,
} from "./prompts/copy.js";

export type SuggestBundle = {
  names: string[];
  shortDescription?: string;
  description?: string;
  metaTitle?: string[];
  metaDescription?: string;
};

export type SuggestImage = {
  mime: string;
  data: Buffer;
};

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = env.UPLOAD_MAX_BYTES;

function photoTooLargeMessage() {
  const mb = Math.max(1, Math.round(MAX_IMAGE_BYTES / (1024 * 1024)));
  return `Photo must be under ${mb} MB.`;
}

export function rateLimitSuggest(staffId: string): void {
  const now = Date.now();
  const prev = (hits.get(staffId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (prev.length >= MAX_PER_WINDOW) {
    throw HttpError.tooManyRequests("Wait a minute before suggesting again.");
  }
  prev.push(now);
  hits.set(staffId, prev);
}

function uniqueStrings(values: unknown, max: number): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter(Boolean))].slice(
    0,
    max,
  );
}

function parseBundle(text: string): SuggestBundle {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fence?.[1] ?? trimmed).trim();
  const parsed: unknown = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return { names: uniqueStrings(parsed, 5) };
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Gemini did not return an object");
  }
  const obj = parsed as Record<string, unknown>;
  const names = uniqueStrings(obj.names, 5);
  const metaTitle = uniqueStrings(obj.metaTitle, 5);
  const shortDescription =
    typeof obj.shortDescription === "string" ? obj.shortDescription.trim() : undefined;
  const description = typeof obj.description === "string" ? obj.description.trim() : undefined;
  const metaDescription =
    typeof obj.metaDescription === "string" ? obj.metaDescription.trim() : undefined;
  return {
    names,
    shortDescription: shortDescription || undefined,
    description: description || undefined,
    metaTitle: metaTitle.length ? metaTitle : undefined,
    metaDescription: metaDescription || undefined,
  };
}

function isSafeImageUrl(url: string): boolean {
  const base = env.PUBLIC_BASE_URL.replace(/\/$/, "");
  if (url.startsWith("/uploads/")) return true;
  try {
    return new URL(url).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

export async function loadImageFromUrl(imageUrl: string): Promise<SuggestImage> {
  const trimmed = imageUrl.trim();
  const resolved = trimmed.startsWith("/")
    ? `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}${trimmed}`
    : trimmed;
  if (!isSafeImageUrl(trimmed) && !isSafeImageUrl(resolved)) {
    throw HttpError.badRequest("Image URL is not allowed.");
  }
  let res: Response;
  try {
    res = await fetch(resolved);
  } catch (err) {
    logger.warn({ err }, "Suggest image fetch failed");
    throw HttpError.badRequest("Could not read the image.");
  }
  if (!res.ok) throw HttpError.badRequest("Could not read the image.");
  const mime = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw HttpError.badRequest("Use a JPEG, PNG, or WebP photo.");
  }
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length === 0 || data.length > MAX_IMAGE_BYTES) {
    throw HttpError.badRequest(photoTooLargeMessage());
  }
  return { mime, data };
}

export function imageFromUpload(file: { mimetype: string; buffer: Buffer }): SuggestImage {
  const mime = file.mimetype.toLowerCase() === "image/jpg" ? "image/jpeg" : file.mimetype.toLowerCase();
  if (mime === "image/heic" || mime === "image/heif") {
    throw HttpError.badRequest("HEIC photos are not supported. Use JPEG, PNG, or WebP.");
  }
  if (!ALLOWED_MIME.has(mime)) {
    throw HttpError.badRequest("Use a JPEG, PNG, or WebP photo.");
  }
  if (file.buffer.length === 0 || file.buffer.length > MAX_IMAGE_BYTES) {
    throw HttpError.badRequest(photoTooLargeMessage());
  }
  return { mime, data: file.buffer };
}

export function requirePhoto(kind: SuggestKind, image: SuggestImage | null): SuggestImage | null {
  if (PHOTO_KINDS.has(kind) && !image) {
    throw HttpError.badRequest("Add a photo before suggesting.");
  }
  return image;
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

export async function suggestCopy(
  ctx: SuggestContext,
  image: SuggestImage | null,
): Promise<SuggestBundle> {
  const key = env.GEMINI_API_KEY?.trim();
  if (!key) {
    logger.warn("GEMINI_API_KEY is not set");
    throw HttpError.badGateway("AI suggestions are not configured.");
  }

  const parts: Array<Record<string, unknown>> = [{ text: buildCopyPrompt(ctx, Boolean(image)) }];
  if (image) {
    parts.push({
      inline_data: {
        mime_type: image.mime,
        data: image.data.toString("base64"),
      },
    });
  }

  const model = env.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 900,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: "minimal" },
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    logger.warn({ err }, "Gemini request failed");
    throw HttpError.badGateway("AI suggestions are unavailable right now.");
  } finally {
    clearTimeout(timer);
  }

  const body = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) {
    logger.warn({ status: res.status, error: body.error }, "Gemini HTTP error");
    if (res.status === 403) {
      throw HttpError.badGateway(
        "Gemini denied this API key’s project. In AI Studio check the project isn’t Restricted, finish age/phone/2-Step verification, then create a new key — or add billing.",
      );
    }
    if (res.status === 404) {
      throw HttpError.badGateway(
        "Gemini model not found. Set GEMINI_MODEL to a current Flash-Lite id (e.g. gemini-3.5-flash-lite).",
      );
    }
    throw HttpError.badGateway("AI suggestions are unavailable right now.");
  }
  if (body.promptFeedback?.blockReason) {
    logger.warn({ block: body.promptFeedback.blockReason }, "Gemini blocked prompt");
    throw HttpError.badGateway("AI suggestions are unavailable right now.");
  }

  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    logger.warn({ finish: body.candidates?.[0]?.finishReason }, "Gemini empty response");
    throw HttpError.badGateway("AI suggestions are unavailable right now.");
  }

  let bundle: SuggestBundle;
  try {
    bundle = parseBundle(text);
  } catch (err) {
    logger.warn({ err, text: text.slice(0, 200) }, "Gemini parse failed");
    throw HttpError.badGateway("AI suggestions are unavailable right now.");
  }

  if (bundle.names.length === 0 && !bundle.description && !bundle.shortDescription) {
    throw HttpError.badGateway("AI suggestions are unavailable right now.");
  }
  return bundle;
}
