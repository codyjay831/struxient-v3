import type { CustomerDocumentCategory, PrismaClient } from "@prisma/client";
import {
  DEFAULT_CUSTOMER_DOCUMENT_MAX_BYTES,
  effectiveCustomerDocumentMaxBytes,
  inferCustomerDocumentCategory,
  isAllowedOfficeCustomerDocumentContentType,
  sanitizeCustomerDocumentDisplayName,
} from "@/lib/files/customer-document-policy";
import { getStorageProvider } from "@/server/media/get-storage-provider";
import type { CustomerDocumentSummaryDto } from "../reads/customer-document-reads";

const MAX_CAPTION_CHARS = 2_000;

export type CreateCustomerDocumentResult =
  | { ok: true; document: CustomerDocumentSummaryDto }
  | {
      ok: false;
      kind:
        | "customer_not_found"
        | "invalid_actor"
        | "content_type_blocked"
        | "invalid_file_name"
        | "caption_too_long"
        | "upload_failed";
    }
  | { ok: false; kind: "file_too_large"; maxBytesEffective: number };

export type ArchiveCustomerDocumentResult =
  | { ok: true; id: string }
  | { ok: false; kind: "not_found" | "already_archived" | "invalid_actor" };

function labelFromUser(u: { email: string; displayName: string | null }): string {
  return u.displayName?.trim() || u.email;
}

/**
 * Upload bytes to storage and persist a **CustomerDocument** row + audit (Epic 06).
 * Does not use the generic `/api/media/upload` path (field-gated); office customer anchor only.
 */
export async function createCustomerDocumentForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    customerId: string;
    actorUserId: string;
    buffer: Buffer;
    contentType: string;
    originalFileName: string;
    caption?: string | null;
    category?: CustomerDocumentCategory | null;
  },
): Promise<CreateCustomerDocumentResult> {
  const actorId = params.actorUserId.trim();
  if (!actorId) {
    return { ok: false, kind: "invalid_actor" };
  }

  const [parent, tenant] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: params.customerId, tenantId: params.tenantId },
      select: { id: true },
    }),
    prisma.tenant.findFirst({
      where: { id: params.tenantId },
      select: { customerDocumentMaxBytes: true },
    }),
  ]);
  if (!parent) {
    return { ok: false, kind: "customer_not_found" };
  }

  const actorRow = await prisma.user.findFirst({
    where: { id: actorId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!actorRow) {
    return { ok: false, kind: "invalid_actor" };
  }

  const maxBytesEffective = effectiveCustomerDocumentMaxBytes(
    tenant?.customerDocumentMaxBytes ?? DEFAULT_CUSTOMER_DOCUMENT_MAX_BYTES,
  );
  if (params.buffer.length > maxBytesEffective) {
    return { ok: false, kind: "file_too_large", maxBytesEffective };
  }

  if (!isAllowedOfficeCustomerDocumentContentType(params.contentType)) {
    return { ok: false, kind: "content_type_blocked" };
  }

  const fileName = sanitizeCustomerDocumentDisplayName(params.originalFileName);
  if (!fileName || fileName === "." || fileName === "..") {
    return { ok: false, kind: "invalid_file_name" };
  }

  const cap = params.caption != null ? String(params.caption).trim() : "";
  if (cap.length > MAX_CAPTION_CHARS) {
    return { ok: false, kind: "caption_too_long" };
  }

  let storageKey: string;
  try {
    storageKey = await getStorageProvider().upload(params.buffer, params.contentType, fileName);
  } catch {
    return { ok: false, kind: "upload_failed" };
  }

  const category =
    params.category ?? inferCustomerDocumentCategory(params.contentType);

  try {
    const row = await prisma.$transaction(async (tx) => {
      const doc = await tx.customerDocument.create({
        data: {
          tenantId: params.tenantId,
          customerId: params.customerId,
          storageKey,
          fileName,
          contentType: params.contentType.split(";")[0]?.trim() || "application/octet-stream",
          sizeBytes: params.buffer.length,
          category,
          caption: cap.length > 0 ? cap : null,
          uploadedById: actorRow.id,
        },
        select: {
          id: true,
          storageKey: true,
          fileName: true,
          contentType: true,
          sizeBytes: true,
          category: true,
          caption: true,
          status: true,
          createdAt: true,
          uploadedById: true,
          uploadedBy: { select: { email: true, displayName: true } },
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId: params.tenantId,
          eventType: "CUSTOMER_DOCUMENT_UPLOADED",
          actorId: actorRow.id,
          targetCustomerId: params.customerId,
          payloadJson: {
            customerId: params.customerId,
            customerDocumentId: doc.id,
            storageKey,
            fileName,
            sizeBytes: params.buffer.length,
            category,
          },
        },
      });

      return doc;
    });

    return {
      ok: true,
      document: {
        id: row.id,
        storageKey: row.storageKey,
        fileName: row.fileName,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        category: row.category,
        caption: row.caption,
        status: row.status,
        createdAtIso: row.createdAt.toISOString(),
        uploadedById: row.uploadedById,
        uploadedByLabel: labelFromUser(row.uploadedBy),
      },
    };
  } catch {
    return { ok: false, kind: "upload_failed" };
  }
}

export async function archiveCustomerDocumentForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    customerId: string;
    documentId: string;
    actorUserId: string;
  },
): Promise<ArchiveCustomerDocumentResult> {
  const actorId = params.actorUserId.trim();
  if (!actorId) return { ok: false, kind: "invalid_actor" };

  return prisma.$transaction(async (tx) => {
    const doc = await tx.customerDocument.findFirst({
      where: {
        id: params.documentId,
        tenantId: params.tenantId,
        customerId: params.customerId,
      },
      select: { id: true, status: true },
    });
    if (!doc) return { ok: false, kind: "not_found" } as const;
    if (doc.status !== "ACTIVE") {
      return { ok: false, kind: "already_archived" } as const;
    }

    const actor = await tx.user.findFirst({
      where: { id: actorId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!actor) return { ok: false, kind: "invalid_actor" } as const;

    await tx.customerDocument.update({
      where: { id: doc.id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: "CUSTOMER_DOCUMENT_ARCHIVED",
        actorId: actor.id,
        targetCustomerId: params.customerId,
        payloadJson: {
          customerId: params.customerId,
          customerDocumentId: doc.id,
        },
      },
    });

    return { ok: true, id: doc.id } as const;
  });
}
