// Provider-agnostic upload helper. Same code path works whether the server is
// running local disk, R2, S3, or Cloudinary — the server tells us how to upload.

export type UploadPurpose =
  | "quote-reference"
  | "product"
  | "category"
  | "festival"
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

export async function uploadImage(
  file: File,
  purpose: UploadPurpose,
): Promise<{ publicUrl: string; key: string }> {
  const presignRes = await fetch(`${API_BASE}/uploads/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    // PUT — used by presigned R2/S3 URLs.
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

export async function uploadImages(
  files: File[],
  purpose: UploadPurpose,
): Promise<{ publicUrl: string; key: string }[]> {
  return Promise.all(files.map((f) => uploadImage(f, purpose)));
}
