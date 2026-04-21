import fs from "fs/promises";
import path from "path";
import { generateStorageKey, StorageProvider } from "./storage-provider";

const STORAGE_ROOT = process.env.FILE_STORAGE_PATH || "./storage";

export class DiskStorageProvider implements StorageProvider {
  private async ensureDir() {
    try {
      await fs.access(STORAGE_ROOT);
    } catch {
      await fs.mkdir(STORAGE_ROOT, { recursive: true });
    }
  }

  async upload(file: Buffer, contentType: string, originalName: string): Promise<string> {
    await this.ensureDir();
    const key = generateStorageKey(originalName);
    const metaKey = `${key}.meta.json`;
    
    await fs.writeFile(path.join(STORAGE_ROOT, key), file);
    await fs.writeFile(path.join(STORAGE_ROOT, metaKey), JSON.stringify({ 
      contentType, 
      fileName: originalName,
      uploadedAt: new Date().toISOString()
    }));
    
    return key;
  }

  async download(storageKey: string): Promise<{ buffer: Buffer; contentType: string; fileName: string } | null> {
    const filePath = path.join(STORAGE_ROOT, storageKey);
    const metaPath = `${filePath}.meta.json`;
    
    try {
      const buffer = await fs.readFile(filePath);
      const meta = JSON.parse(await fs.readFile(metaPath, "utf-8")) as { 
        contentType: string; 
        fileName: string 
      };
      
      return { buffer, contentType: meta.contentType, fileName: meta.fileName };
    } catch (e) {
      console.error(`DiskStorageProvider: Failed to download ${storageKey}`, e);
      return null;
    }
  }
}
