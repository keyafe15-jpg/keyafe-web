// Provider-agnostic storage contract.
// Every backend (local disk, R2, S3, Cloudinary) implements this shape so
// app code never has to change when we switch providers.

export type UploadPurpose =
  | "quote-reference"
  | "payment-screenshot"
  | "product"
  | "category"
  | "festival"
  | "admin";

export interface PresignInput {
  purpose: UploadPurpose;
  contentType: string;
  filename?: string;
}

export interface PresignResult {
  // Where the client uploads to.
  uploadUrl: string;

  // HTTP method the client must use.
  method: "PUT" | "POST";

  // Extra headers (e.g., signed x-amz-*).
  headers?: Record<string, string>;

  // Extra multipart form fields (S3 POST policy pattern).
  fields?: Record<string, string>;

  // Where the file will be available after upload succeeds.
  publicUrl: string;

  // Internal storage key (opaque to client, used server-side for deletes/audit).
  key: string;

  // How long the upload URL stays valid, in seconds.
  expiresIn: number;
}

export interface StorageProvider {
  presignUpload(input: PresignInput): Promise<PresignResult>;
  deleteByKey(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}
