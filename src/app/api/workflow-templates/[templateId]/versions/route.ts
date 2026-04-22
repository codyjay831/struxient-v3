import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import {
  createWorkflowVersionDraftForTenant,
  forkWorkflowVersionDraftFromSourceForTenant,
} from "@/server/slice1";

type RouteContext = { params: Promise<{ templateId: string }> };

/**
 * POST /api/workflow-templates/[templateId]/versions
 *
 * - Default body `{}`: creates the next **DRAFT** with an empty `nodes` array.
 * - With `{ "forkFromWorkflowVersionId": "<id>" }`: creates the next **DRAFT** by deep-cloning
 *   `snapshotJson` from that **PUBLISHED** or **SUPERSEDED** version on the same template.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { templateId } = await context.params;

  let forkFromWorkflowVersionId: string | undefined;
  try {
    const raw = await request.json().catch(() => ({}));
    if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
      const v = (raw as { forkFromWorkflowVersionId?: unknown }).forkFromWorkflowVersionId;
      if (typeof v === "string" && v.trim() !== "") {
        forkFromWorkflowVersionId = v.trim();
      }
    }
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be JSON." } },
      { status: 400 },
    );
  }

  try {
    if (forkFromWorkflowVersionId != null) {
      const result = await forkWorkflowVersionDraftFromSourceForTenant(getPrisma(), {
        tenantId: authGate.principal.tenantId,
        workflowTemplateId: templateId,
        sourceWorkflowVersionId: forkFromWorkflowVersionId,
      });
      if (result === "not_found") {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Workflow template or fork source version not found for tenant.",
            },
          },
          { status: 404 },
        );
      }
      return NextResponse.json(
        {
          data: { workflowVersion: result, fork: { fromWorkflowVersionId: result.forkedFromWorkflowVersionId } },
          meta: apiAuthMeta(authGate.principal),
        },
        { status: 201 },
      );
    }

    const result = await createWorkflowVersionDraftForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      workflowTemplateId: templateId,
    });
    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Workflow template not found for tenant." } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        data: { workflowVersion: result },
        meta: apiAuthMeta(authGate.principal),
      },
      { status: 201 },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
