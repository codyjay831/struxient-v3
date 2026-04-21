import { StorageProvider } from "./storage-provider";
import { DiskStorageProvider } from "./disk-storage-provider";
import { S3StorageProvider } from "./s3-storage-provider";

let instance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!instance) {
    const providerType = process.env.STRUXIENT_STORAGE_PROVIDER || "DISK";

    if (providerType === "S3") {
      instance = new S3StorageProvider();
    } else {
      // Default to DISK for local development
      instance = new DiskStorageProvider();
    }
  }
  return instance;
}
