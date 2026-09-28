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
      contentType: file.type,
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
        "Content-Type": file.type,
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
