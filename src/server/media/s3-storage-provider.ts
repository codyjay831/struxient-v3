import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand 
} from "@aws-sdk/client-s3";
import { generateStorageKey, StorageProvider } from "./storage-provider";

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.STRUXIENT_S3_BUCKET || "";
    if (!this.bucket) {
      console.warn("S3StorageProvider: STRUXIENT_S3_BUCKET is not set.");
    }

    this.client = new S3Client({
      region: process.env.STRUXIENT_S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.STRUXIENT_S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.STRUXIENT_S3_SECRET_ACCESS_KEY || "",
      },
      endpoint: process.env.STRUXIENT_S3_ENDPOINT, // Optional for S3-compatible (Minio, DigitalOcean, etc)
      forcePathStyle: !!process.env.STRUXIENT_S3_FORCE_PATH_STYLE,
    });
  }

  async upload(file: Buffer, contentType: string, originalName: string): Promise<string> {
    const key = generateStorageKey(originalName);
    
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
      Metadata: {
        "original-name": originalName,
      }
    }));
    
    return key;
  }

  async download(storageKey: string): Promise<{ buffer: Buffer; contentType: string; fileName: string } | null> {
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }));

      if (!response.Body) return null;

      // S3 response bodies are streams. We need to convert them to Buffers.
      const bytes = await response.Body.transformToByteArray();
      const buffer = Buffer.from(bytes);

      return {
        buffer,
        contentType: response.ContentType || "application/octet-stream",
        fileName: response.Metadata?.["original-name"] || storageKey.split("-").slice(2).join("-"),
      };
    } catch (e) {
      console.error(`S3StorageProvider: Failed to download ${storageKey}`, e);
      return null;
    }
  }
}
