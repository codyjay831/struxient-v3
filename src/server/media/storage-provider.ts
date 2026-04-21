/**
 * Minimal storage provider interface for durable media.
 */
export interface StorageProvider {
  /**
   * Store a file and return its durable storage key.
   */
  upload(file: Buffer, contentType: string, originalName: string): Promise<string>;

  /**
   * Retrieve a file's content and metadata.
   */
  download(storageKey: string): Promise<{ buffer: Buffer; contentType: string; fileName: string } | null>;
}

export function generateStorageKey(fileName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const cleanName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${timestamp}-${random}-${cleanName}`;
}
