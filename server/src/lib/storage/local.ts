import fs from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";
import { customAlphabet } from "nanoid";
import { env } from "../../config/env.js";
import type {
  PresignInput,
  PresignResult,
  StorageProvider,
  UploadPurpose,
} from "./types.js";

const nano = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function todayFolder() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildKey(purpose: UploadPurpose, contentType: string) {
  const ext = EXTENSION_BY_MIME[contentType] ?? "bin";
  return `${purpose}/${todayFolder()}/${nano()}.${ext}`;
}

// JWT payload used to authorise a single direct-upload request.
// Kept intentionally small — 5-min TTL.
export interface UploadToken {
  key: string;
  contentType: string;
  maxBytes: number;
}

const TOKEN_TTL_SECONDS = 5 * 60;

export class LocalDiskStorage implements StorageProvider {
  private readonly baseDir: string;
  private readonly publicBase: string;

  constructor(baseDir: string, publicBase: string) {
    this.baseDir = path.resolve(baseDir);
    this.publicBase = publicBase.replace(/\/$/, "");
  }

  async ensureRoot() {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  async presignUpload(input: PresignInput): Promise<PresignResult> {
    const key = buildKey(input.purpose, input.contentType);

    const token = jwt.sign(
      {
        key,
        contentType: input.contentType,
        maxBytes: env.UPLOAD_MAX_BYTES,
      } satisfies UploadToken,
      env.UPLOAD_TOKEN_SECRET,
      { expiresIn: TOKEN_TTL_SECONDS },
    );

    return {
      uploadUrl: `${this.publicBase}/api/uploads/direct`,
      method: "POST",
      publicUrl: this.getPublicUrl(key),
      key,
      fields: { token },
      expiresIn: TOKEN_TTL_SECONDS,
    };
  }

  async saveDirect(
    token: string,
    buffer: Buffer,
    receivedContentType: string,
  ): Promise<{ publicUrl: string; key: string }> {
    let decoded: UploadToken;
    try {
      decoded = jwt.verify(token, env.UPLOAD_TOKEN_SECRET) as UploadToken;
    } catch {
      throw new Error("Invalid or expired upload token");
    }

    if (decoded.contentType !== receivedContentType) {
      throw new Error("Content-type does not match presigned token");
    }
    if (buffer.length > decoded.maxBytes) {
      throw new Error("File exceeds maximum allowed size");
    }

    const target = path.join(this.baseDir, decoded.key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);

    return { publicUrl: this.getPublicUrl(decoded.key), key: decoded.key };
  }

  async deleteByKey(key: string): Promise<void> {
    const target = path.join(this.baseDir, key);
    await fs.rm(target, { force: true });
  }

  getPublicUrl(key: string): string {
    return `${this.publicBase}/uploads/${key}`;
  }

  getBaseDir(): string {
    return this.baseDir;
  }
}
