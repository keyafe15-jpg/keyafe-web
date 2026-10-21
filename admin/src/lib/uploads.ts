import { getAdminAccessToken } from "@/lib/api";

export type UploadPurpose =
  | "quote-reference"
  | "payment-screenshot"
  | "product"
  | "category"
  | "addon"
  | "festival"
  | "hero"
  | "admin";

interface PresignResult {
  uploadUrl: string;
  method: "PUT" | "POST";
  headers?: Record<string, string>;
  fields?: Record<string, string>;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

const API_BASE = "/api";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** iPhone camera rolls often send an empty type, or `image/jpg`. */
function uploadContentType(file: File): string {
  const raw = (file.type || "").toLowerCase();
  if (raw === "image/jpg") return "image/jpeg";
  if (IMAGE_TYPES.has(raw) || raw.startsWith("video/")) return raw;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  return "image/jpeg";
}

/** Images for any purpose; MP4/WebM video only for `hero`. */
export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
): Promise<{ publicUrl: string; key: string }> {
  const token = getAdminAccessToken();
  const presignRes = await fetch(`${API_BASE}/uploads/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      purpose,
      contentType: uploadContentType(file),
      filename: file.name,
    }),
  });
  if (!presignRes.ok) {
    const body = await presignRes.text();
    throw new Error(`Presign failed: ${body}`);
  }
  const presign = (await presignRes.json()) as PresignResult;

  if (presign.method === "POST") {
    const fd = new FormData();
    for (const [k, v] of Object.entries(presign.fields ?? {})) {
      fd.append(k, v);
    }
    fd.append("file", file);
    const uploadRes = await fetch(presign.uploadUrl, {
      method: "POST",
      body: fd,
      headers: presign.headers,
    });
    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
  } else {
    const uploadRes = await fetch(presign.uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": uploadContentType(file),
        ...(presign.headers ?? {}),
      },
    });
    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
  }

  return { publicUrl: presign.publicUrl, key: presign.key };
}

export const uploadImage = uploadFile;

export async function uploadImages(
  files: File[],
  purpose: UploadPurpose,
): Promise<{ publicUrl: string; key: string }[]> {
  return Promise.all(files.map((f) => uploadFile(f, purpose)));
}
