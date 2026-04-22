import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { CustomerDocumentCategory } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { createCustomerDocumentForTenant } from "@/server/slice1/mutations/customer-document-mutations";
import { listCustomerDocumentsForTenant } from "@/server/slice1/reads/customer-document-reads";

type RouteContext = { params: Promise<{ customerId: string }> };

function parseCategory(raw: unknown): CustomerDocumentCategory | undefined {
  if (typeof raw !== "string") return undefined;
  const u = raw.trim().toUpperCase();
  const allowed = new Set<string>(Object.values(CustomerDocumentCategory));
  if (allowed.has(u)) return u as CustomerDocumentCategory;
  return undefined;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { customerId } = await context.params;

  try {
    const items = await listCustomerDocumentsForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      customerId,
    });
    if (items === null) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Customer not found for tenant." } },
        { status: 404 },
      );
    }
    return NextResponse.json({
      data: { documents: items },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

/** Multipart upload: `file` (required), optional `caption`, optional `category` (DOCUMENT|IMAGE|OTHER). */
export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { customerId } = await context.params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_FORM", message: "Expected multipart form data." } },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: { code: "NO_FILE", message: "Non-empty file field is required." } },
      { status: 400 },
    );
  }

  const captionRaw = form.get("caption");
  const caption = typeof captionRaw === "string" ? captionRaw : undefined;
  const category = parseCategory(form.get("category"));

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await createCustomerDocumentForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      customerId,
      actorUserId: authGate.principal.userId,
      buffer,
      contentType: file.type || "application/octet-stream",
      originalFileName: file.name || "upload",
      caption,
      category: category ?? null,
    });

    if (!result.ok) {
      if (result.kind === "file_too_large") {
        return NextResponse.json(
          {
            error: {
              code: "FILE_TOO_LARGE",
              message: `File exceeds tenant upload limit (${result.maxBytesEffective} bytes).`,
              maxBytesEffective: result.maxBytesEffective,
            },
          },
          { status: 413 },
        );
      }
      const map: Record<
        Exclude<(typeof result)["kind"], "file_too_large">,
        { status: number; code: string; message: string }
      > = {
        customer_not_found: { status: 404, code: "NOT_FOUND", message: "Customer not found for tenant." },
        invalid_actor: { status: 403, code: "INVALID_ACTOR", message: "Actor not valid for tenant." },
        content_type_blocked: {
          status: 415,
          code: "CONTENT_TYPE_BLOCKED",
          message: "This file type is not allowed for customer documents.",
        },
        invalid_file_name: { status: 400, code: "INVALID_FILE_NAME", message: "File name could not be sanitized." },
        caption_too_long: { status: 400, code: "CAPTION_TOO_LONG", message: "Caption is too long." },
        upload_failed: { status: 500, code: "UPLOAD_FAILED", message: "Storage or database write failed." },
      };
      const err = map[result.kind];
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    }

    return NextResponse.json(
      { data: { document: result.document }, meta: apiAuthMeta(authGate.principal) },
      { status: 201 },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
