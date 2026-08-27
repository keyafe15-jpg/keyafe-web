import { env } from "../../config/env.js";
import { LocalDiskStorage } from "./local.js";
import type { StorageProvider } from "./types.js";

// Add r2 / s3 / cloudinary implementations here and switch on env.STORAGE_PROVIDER.
function createStorage(): StorageProvider {
  switch (env.STORAGE_PROVIDER) {
    case "local":
      return new LocalDiskStorage(env.UPLOAD_DIR, env.PUBLIC_BASE_URL);
    case "r2":
    case "s3":
    case "cloudinary":
      throw new Error(
        `Storage provider "${env.STORAGE_PROVIDER}" not implemented yet`,
      );
  }
}

export const storage = createStorage();

// Convenience export — modules that need local-specific APIs (like `saveDirect`)
// can narrow the type. Others should use the StorageProvider interface only.
export function getLocalStorage(): LocalDiskStorage {
  if (!(storage instanceof LocalDiskStorage)) {
    throw new Error(
      "Local-only feature invoked but STORAGE_PROVIDER is not 'local'",
    );
  }
  return storage;
}
