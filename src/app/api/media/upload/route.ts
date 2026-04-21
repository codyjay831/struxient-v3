import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { getStorageProvider } from "@/server/media/get-storage-provider";

export async function POST(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("field_execute");
  if (!authGate.ok) return authGate.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: { code: "NO_FILE", message: "No file uploaded" } }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = await getStorageProvider().upload(buffer, file.type, file.name);

    return NextResponse.json({ 
      data: { 
        storageKey, 
        fileName: file.name, 
        fileSize: file.size, 
        contentType: file.type 
      } 
    });
  } catch (e) {
    console.error("Media Upload Error:", e);
    return NextResponse.json({ error: { code: "UPLOAD_FAILED", message: "Failed to upload media" } }, { status: 500 });
  }
}
