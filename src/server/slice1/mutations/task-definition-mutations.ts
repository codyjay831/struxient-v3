import { Prisma, type PrismaClient, type TaskDefinitionStatus } from "@prisma/client";
import { InvariantViolationError } from "../errors";
import {
  parseCompletionRequirements,
  type CompletionRequirement,
} from "@/lib/task-definition-authored-requirements";
import {
  buildRequirementsContext,
  parseConditionalRules,
  type ConditionalRule,
} from "@/lib/task-definition-conditional-rules";
import {
  getTaskDefinitionDetailForTenant,
  type TaskDefinitionDetailDto,
} from "../reads/task-definition-reads";

const TASK_KEY_REGEX = /^[a-z0-9][a-z0-9._-]{1,79}$/;
const MAX_DISPLAY_NAME_LENGTH = 200;
const MAX_INSTRUCTIONS_LENGTH = 4000;

export type CreateTaskDefinitionInput = {
  tenantId: string;
  taskKey: string;
  displayName: string;
  instructions?: string | null;
  completionRequirements?: unknown;
  conditionalRules?: unknown;
};

export type UpdateTaskDefinitionInput = {
  tenantId: string;
  taskDefinitionId: string;
  /** Optional partial update — only provided fields are touched. */
  displayName?: string;
  instructions?: string | null;
  completionRequirements?: unknown;
  conditionalRules?: unknown;
};

export type SetTaskDefinitionStatusInput = {
  tenantId: string;
  taskDefinitionId: string;
  nextStatus: TaskDefinitionStatus;
};

function assertTaskKey(taskKey: string): string {
  const k = taskKey.trim();
  if (!TASK_KEY_REGEX.test(k)) {
    throw new InvariantViolationError(
      "TASK_DEFINITION_TASK_KEY_INVALID",
      "taskKey must be 2-80 chars: lowercase alphanumeric plus '.', '-', '_', starting with a letter or digit.",
      { taskKey: k },
    );
  }
  return k;
}

function assertDisplayName(displayName: string): string {
  const d = displayName.trim();
  if (!d) {
    throw new InvariantViolationError(
      "TASK_DEFINITION_DISPLAY_NAME_INVALID",
      "displayName must be non-empty after trim.",
    );
  }
  if (d.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new InvariantViolationError(
      "TASK_DEFINITION_DISPLAY_NAME_INVALID",
      `displayName must be at most ${MAX_DISPLAY_NAME_LENGTH} characters.`,
    );
  }
  return d;
}

function normalizeInstructions(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  if (!t) return null;
  if (t.length > MAX_INSTRUCTIONS_LENGTH) {
    throw new InvariantViolationError(
      "TASK_DEFINITION_INSTRUCTIONS_TOO_LONG",
      `instructions must be at most ${MAX_INSTRUCTIONS_LENGTH} characters.`,
    );
  }
  return t;
}

function validateRequirements(raw: unknown): CompletionRequirement[] {
  const r = parseCompletionRequirements(raw);
  if (!r.ok) {
    throw new InvariantViolationError(
      "TASK_DEFINITION_REQUIREMENTS_INVALID",
      "completionRequirements is not a valid authored shape.",
      { issues: r.errors },
    );
  }
  return r.value;
}

function validateConditionalRules(
  raw: unknown,
  requirements: readonly CompletionRequirement[],
): ConditionalRule[] {
  const ctx = buildRequirementsContext(requirements);
  const r = parseConditionalRules(raw, ctx);
  if (!r.ok) {
    throw new InvariantViolationError(
      "TASK_DEFINITION_CONDITIONAL_RULES_INVALID",
      "conditionalRules is not a valid authored shape.",
      { issues: r.errors },
    );
  }
  return r.value;
}

function assertEditableStatus(currentStatus: TaskDefinitionStatus): void {
  if (currentStatus !== "DRAFT") {
    throw new InvariantViolationError(
      "TASK_DEFINITION_NOT_DRAFT",
      "TaskDefinition content can only be edited while in DRAFT. Move it back to DRAFT or create a new key.",
      { currentStatus },
    );
  }
}

export async function createTaskDefinitionForTenant(
  prisma: PrismaClient,
  input: CreateTaskDefinitionInput,
): Promise<TaskDefinitionDetailDto> {
  const taskKey = assertTaskKey(input.taskKey);
  const displayName = assertDisplayName(input.displayName);
  const instructions = normalizeInstructions(input.instructions);
  const requirements = validateRequirements(input.completionRequirements ?? []);
  const conditionalRules = validateConditionalRules(input.conditionalRules ?? [], requirements);

  try {
    const created = await prisma.taskDefinition.create({
      data: {
        tenantId: input.tenantId,
        taskKey,
        displayName,
        instructions,
        completionRequirementsJson: requirements as unknown as Prisma.InputJsonValue,
        conditionalRulesJson: conditionalRules as unknown as Prisma.InputJsonValue,
        status: "DRAFT",
      },
      select: { id: true },
    });
    const detail = await getTaskDefinitionDetailForTenant(prisma, {
      tenantId: input.tenantId,
      taskDefinitionId: created.id,
    });
    if (!detail) {
      // Not expected; row was just created in same tenant.
      throw new InvariantViolationError(
        "TASK_DEFINITION_NOT_FOUND",
        "Created TaskDefinition could not be re-read in tenant scope.",
        { taskDefinitionId: created.id },
      );
    }
    return detail;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new InvariantViolationError(
        "TASK_DEFINITION_TASK_KEY_TAKEN",
        `taskKey "${taskKey}" already exists for this tenant.`,
        { taskKey },
      );
    }
    throw e;
  }
}

async function loadEditableTaskDefinition(
  prisma: PrismaClient,
  tenantId: string,
  taskDefinitionId: string,
): Promise<{
  id: string;
  status: TaskDefinitionStatus;
  completionRequirementsJson: unknown;
  conditionalRulesJson: unknown;
}> {
  const row = await prisma.taskDefinition.findFirst({
    where: { id: taskDefinitionId, tenantId },
    select: {
      id: true,
      status: true,
      completionRequirementsJson: true,
      conditionalRulesJson: true,
    },
  });
  if (!row) {
    throw new InvariantViolationError(
      "TASK_DEFINITION_NOT_FOUND",
      "TaskDefinition not found in this tenant.",
      { taskDefinitionId },
    );
  }
  return row;
}

export async function updateTaskDefinitionForTenant(
  prisma: PrismaClient,
  input: UpdateTaskDefinitionInput,
): Promise<TaskDefinitionDetailDto> {
  const row = await loadEditableTaskDefinition(prisma, input.tenantId, input.taskDefinitionId);
  assertEditableStatus(row.status);

  const data: Prisma.TaskDefinitionUpdateInput = {};

  if (input.displayName !== undefined) {
    data.displayName = assertDisplayName(input.displayName);
  }
  if (input.instructions !== undefined) {
    data.instructions = normalizeInstructions(input.instructions);
  }

  // Resolve effective requirements + rules. Whenever EITHER changes we re-validate
  // the rules against the post-update requirements set so we never persist a rule
  // pointing at a label that no longer exists (silent dead rule guard).
  const reqsTouched = input.completionRequirements !== undefined;
  const rulesTouched = input.conditionalRules !== undefined;

  if (reqsTouched || rulesTouched) {
    const effectiveRequirements: CompletionRequirement[] = reqsTouched
      ? validateRequirements(input.completionRequirements)
      : (() => {
          // Existing stored requirements should already be valid; surface a structured
          // error here too if a legacy row is malformed and the author hasn't touched it.
          return validateRequirements(row.completionRequirementsJson);
        })();
    const effectiveRules: ConditionalRule[] = rulesTouched
      ? validateConditionalRules(input.conditionalRules, effectiveRequirements)
      : validateConditionalRules(row.conditionalRulesJson, effectiveRequirements);

    if (reqsTouched) {
      data.completionRequirementsJson = effectiveRequirements as unknown as Prisma.InputJsonValue;
    }
    if (rulesTouched) {
      data.conditionalRulesJson = effectiveRules as unknown as Prisma.InputJsonValue;
    } else if (reqsTouched) {
      // Requirements changed; persist the (re-validated, unchanged) rules to keep the
      // round-trip clean. They were rejected above if any reference was broken.
      data.conditionalRulesJson = effectiveRules as unknown as Prisma.InputJsonValue;
    }
  }

  if (Object.keys(data).length === 0) {
    const current = await getTaskDefinitionDetailForTenant(prisma, {
      tenantId: input.tenantId,
      taskDefinitionId: row.id,
    });
    if (!current) {
      throw new InvariantViolationError(
        "TASK_DEFINITION_NOT_FOUND",
        "TaskDefinition not found in this tenant.",
        { taskDefinitionId: row.id },
      );
    }
    return current;
  }

  await prisma.taskDefinition.update({
    where: { id: row.id },
    data,
    select: { id: true },
  });

  const detail = await getTaskDefinitionDetailForTenant(prisma, {
    tenantId: input.tenantId,
    taskDefinitionId: row.id,
  });
  if (!detail) {
    throw new InvariantViolationError(
      "TASK_DEFINITION_NOT_FOUND",
      "TaskDefinition vanished mid-update (unexpected).",
      { taskDefinitionId: row.id },
    );
  }
  return detail;
}

/**
 * Status transitions allowed:
 *   DRAFT     -> PUBLISHED  (publish curated authored truth)
 *   PUBLISHED -> DRAFT      (unpublish to edit; existing snapshots on RuntimeTask are unaffected)
 *   PUBLISHED -> ARCHIVED   (retire from authoring catalog)
 *   DRAFT     -> ARCHIVED   (retire a never-published draft)
 *   ARCHIVED  -> *          (terminal — re-key required)
 */
function isAllowedStatusTransition(from: TaskDefinitionStatus, to: TaskDefinitionStatus): boolean {
  if (from === to) return true; // idempotent no-op
  if (from === "DRAFT" && (to === "PUBLISHED" || to === "ARCHIVED")) return true;
  if (from === "PUBLISHED" && (to === "DRAFT" || to === "ARCHIVED")) return true;
  return false;
}

export async function setTaskDefinitionStatusForTenant(
  prisma: PrismaClient,
  input: SetTaskDefinitionStatusInput,
): Promise<TaskDefinitionDetailDto> {
  const row = await loadEditableTaskDefinition(prisma, input.tenantId, input.taskDefinitionId);
  if (!isAllowedStatusTransition(row.status, input.nextStatus)) {
    throw new InvariantViolationError(
      "TASK_DEFINITION_INVALID_STATUS_TRANSITION",
      `Cannot transition TaskDefinition from ${row.status} to ${input.nextStatus}.`,
      { from: row.status, to: input.nextStatus },
    );
  }
  if (row.status !== input.nextStatus) {
    await prisma.taskDefinition.update({
      where: { id: row.id },
      data: { status: input.nextStatus },
      select: { id: true },
    });
  }
  const detail = await getTaskDefinitionDetailForTenant(prisma, {
    tenantId: input.tenantId,
    taskDefinitionId: row.id,
  });
  if (!detail) {
    throw new InvariantViolationError(
      "TASK_DEFINITION_NOT_FOUND",
      "TaskDefinition not found after status update.",
      { taskDefinitionId: row.id },
    );
  }
  return detail;
}
