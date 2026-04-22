import { Prisma, type PrismaClient } from "@prisma/client";
import { InvariantViolationError } from "../errors";

export type CreateWorkflowTemplateInput = {
  tenantId: string;
  templateKey: string;
  displayName: string;
};

export type CreateWorkflowTemplateResultDto = {
  id: string;
  tenantId: string;
  templateKey: string;
  displayName: string;
};

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/**
 * Creates a tenant-scoped `WorkflowTemplate`. `templateKey` is unique per tenant.
 */
export async function createWorkflowTemplateForTenant(
  prisma: PrismaClient,
  input: CreateWorkflowTemplateInput,
): Promise<CreateWorkflowTemplateResultDto> {
  const templateKey = input.templateKey.trim();
  const displayName = input.displayName.trim();
  if (templateKey === "") {
    throw new InvariantViolationError(
      "WORKFLOW_TEMPLATE_INVALID_KEY",
      "templateKey must be a non-empty string.",
      {},
    );
  }
  if (displayName === "") {
    throw new InvariantViolationError(
      "WORKFLOW_TEMPLATE_INVALID_DISPLAY_NAME",
      "displayName must be a non-empty string.",
      {},
    );
  }
  if (templateKey.length > 128 || displayName.length > 256) {
    throw new InvariantViolationError(
      "WORKFLOW_TEMPLATE_INVALID_FIELD_LENGTH",
      "templateKey or displayName exceeds maximum length.",
      { templateKeyLen: templateKey.length, displayNameLen: displayName.length },
    );
  }

  try {
    const row = await prisma.workflowTemplate.create({
      data: {
        tenantId: input.tenantId,
        templateKey,
        displayName,
      },
      select: { id: true, tenantId: true, templateKey: true, displayName: true },
    });
    return row;
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new InvariantViolationError(
        "WORKFLOW_TEMPLATE_KEY_TAKEN",
        "A workflow template with this templateKey already exists for the tenant.",
        { templateKey },
      );
    }
    throw e;
  }
}
