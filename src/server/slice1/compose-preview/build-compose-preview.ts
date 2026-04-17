import type { PrismaClient } from "@prisma/client";
import { getQuoteVersionScopeReadModel } from "../reads/quote-version-scope";
import { runComposeFromReadModel } from "./compose-engine";

export type ComposePreviewRequestBody = {
  clientStalenessToken?: string | null;
  acknowledgedWarningCodes?: string[];
};

export type ComposePreviewValidationItem = {
  code: string;
  message: string;
  lineItemId?: string;
  planTaskId?: string;
  details?: Record<string, unknown>;
};

export type ComposePreviewPlanRowDto = {
  planTaskId: string;
  lineItemId: string;
  scopeSource: "LIBRARY_PACKET" | "QUOTE_LOCAL_PACKET" | "COMMERCIAL_SOLD";
  scopePacketRevisionId?: string;
  packetLineKey?: string;
  quoteLocalPacketId?: string;
  localLineKey?: string;
  quantityIndex: number;
  targetNodeKey: string;
  title: string;
  taskKind: string;
  sortKey: string;
  tierCode?: string | null;
};

export type ComposePreviewPackageSlotDto = {
  packageTaskId: string;
  nodeId: string;
  source: "SOLD_SCOPE";
  planTaskIds: string[];
  skeletonTaskId: null;
  displayTitle: string;
};

export type ComposePreviewResponseDto = {
  quoteVersionId: string;
  stalenessToken: string | null;
  staleness: "fresh" | "stale";
  errors: ComposePreviewValidationItem[];
  warnings: ComposePreviewValidationItem[];
  stats: {
    lineItemCount: number;
    planTaskCount: number;
    packageTaskCount: number;
    skeletonSlotCount: number;
    soldSlotCount: number;
  };
  planPreview: { rows: ComposePreviewPlanRowDto[] };
  packagePreview: { slots: ComposePreviewPackageSlotDto[] };
};

export type BuildComposePreviewResult =
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_draft" }
  | { ok: true; data: ComposePreviewResponseDto };

function stalenessOf(
  client: string | null | undefined,
  server: string | null | undefined,
): "fresh" | "stale" {
  const c = client ?? null;
  const s = server ?? null;
  return c === s ? "fresh" : "stale";
}

/**
 * Draft-only compose preview (slice-1 stub): MANIFEST lines expand from catalog / quote-local packets;
 * SOLD_SCOPE lines are counted but produce no plan rows in this slice. Same planTaskId inputs as send.
 */
export async function buildComposePreviewResponse(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    quoteVersionId: string;
    request: ComposePreviewRequestBody;
  },
): Promise<BuildComposePreviewResult> {
  const model = await getQuoteVersionScopeReadModel(prisma, {
    tenantId: params.tenantId,
    quoteVersionId: params.quoteVersionId,
  });

  if (!model) {
    return { ok: false, kind: "not_found" };
  }

  if (model.status !== "DRAFT") {
    return { ok: false, kind: "not_draft" };
  }

  const serverToken = model.composePreviewStalenessToken ?? null;
  const staleness = stalenessOf(params.request.clientStalenessToken, serverToken);

  const { errors, warnings, planRows, packageSlots } = await runComposeFromReadModel(prisma, model);

  const lineItemCount = model.orderedLineItems.length;
  const planTaskCount = planRows.length;
  const packageTaskCount = packageSlots.length;

  const previewSlots: ComposePreviewPackageSlotDto[] = packageSlots.map((s) => {
    const { lineItemId: _omit, ...slot } = s;
    void _omit;
    return slot;
  });

  const data: ComposePreviewResponseDto = {
    quoteVersionId: model.id,
    stalenessToken: serverToken,
    staleness,
    errors,
    warnings,
    stats: {
      lineItemCount,
      planTaskCount,
      packageTaskCount,
      skeletonSlotCount: 0,
      soldSlotCount: packageTaskCount,
    },
    planPreview: { rows: planRows },
    packagePreview: { slots: previewSlots },
  };

  void params.request.acknowledgedWarningCodes;

  return { ok: true, data };
}
