import { summarizeTierPartialExclusion } from "@/lib/compose-tier-filter-diagnostics";
import type { QuoteVersionScopeDb, QuoteVersionScopeReadModel } from "../reads/quote-version-scope";
import {
  computePackageTaskId,
  computePlanTaskIdCommercialSold,
  computePlanTaskIdLibrary,
  computePlanTaskIdLocal,
} from "./plan-task-id";

export type ComposeValidationItem = {
  code: string;
  message: string;
  lineItemId?: string;
  planTaskId?: string;
  details?: Record<string, unknown>;
};

export type ComposePlanRowDto = {
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

export type ComposePackageSlotDto = {
  packageTaskId: string;
  nodeId: string;
  source: "SOLD_SCOPE";
  planTaskIds: string[];
  skeletonTaskId: null;
  displayTitle: string;
  lineItemId: string;
  completionRequirementsJson?: any;
  conditionalRulesJson?: any;
  instructions?: string | null;
};

export type ComposeEngineResult = {
  errors: ComposeValidationItem[];
  warnings: ComposeValidationItem[];
  planRows: ComposePlanRowDto[];
  packageSlots: ComposePackageSlotDto[];
};

function parseWorkflowNodes(snapshotJson: unknown): { nodeIds: Set<string> } | null {
  if (snapshotJson === null || typeof snapshotJson !== "object" || Array.isArray(snapshotJson)) {
    return null;
  }
  const nodes = (snapshotJson as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) {
    return null;
  }
  const nodeIds = new Set<string>();
  for (const n of nodes) {
    if (n !== null && typeof n === "object" && !Array.isArray(n) && typeof (n as { id?: unknown }).id === "string") {
      nodeIds.add((n as { id: string }).id);
    }
  }
  return { nodeIds };
}

function readEmbeddedScopeFields(embedded: unknown): {
  targetNodeKey?: string;
  title?: string;
  taskKind?: string;
  completionRequirementsJson?: any;
  conditionalRulesJson?: any;
  instructions?: string | null;
} {
  if (embedded === null || typeof embedded !== "object" || Array.isArray(embedded)) {
    return {};
  }
  const o = embedded as Record<string, unknown>;
  const targetNodeKey = typeof o.targetNodeKey === "string" ? o.targetNodeKey : undefined;
  const title = typeof o.title === "string" ? o.title : undefined;
  const taskKind = typeof o.taskKind === "string" ? o.taskKind : undefined;
  const completionRequirementsJson = o.completionRequirementsJson;
  const conditionalRulesJson = o.conditionalRulesJson;
  const instructions = typeof o.instructions === "string" ? o.instructions : undefined;
  return { targetNodeKey, title, taskKind, completionRequirementsJson, conditionalRulesJson, instructions };
}

function tierFilterInclude(lineTier: string | null, packetLineTier: string | null): boolean {
  if (packetLineTier == null || packetLineTier === "") {
    return true;
  }
  if (lineTier == null || lineTier === "") {
    return false;
  }
  return packetLineTier === lineTier;
}

/**
 * Shared compose expansion for preview and send: MANIFEST → library/local packets; SOLD_SCOPE → COMMERCIAL_SOLD plan rows.
 */
export async function runComposeFromReadModel(
  prisma: QuoteVersionScopeDb,
  model: QuoteVersionScopeReadModel,
): Promise<ComposeEngineResult> {
  const errors: ComposeValidationItem[] = [];
  const warnings: ComposeValidationItem[] = [];
  const planRows: ComposePlanRowDto[] = [];
  const packageSlots: ComposePackageSlotDto[] = [];

  const lineItemCount = model.orderedLineItems.length;

  if (lineItemCount === 0) {
    errors.push({
      code: "NO_LINE_ITEMS",
      message: "Quote version has no line items to compose.",
    });
  }

  const groupById = new Map(model.proposalGroups.map((g) => [g.id, g]));

  let wf:
    | { id: string; status: string; publishedAt: Date | null; snapshotJson: unknown }
    | null
    | undefined;

  if (!model.pinnedWorkflowVersionId) {
    errors.push({
      code: "WORKFLOW_NOT_PINNED",
      message: "Quote version has no pinnedWorkflowVersionId.",
    });
  } else {
    wf = await prisma.workflowVersion.findFirst({
      where: {
        id: model.pinnedWorkflowVersionId,
        workflowTemplate: { tenantId: model.quote.tenantId },
      },
      select: { id: true, status: true, publishedAt: true, snapshotJson: true },
    });
    if (!wf) {
      errors.push({
        code: "WORKFLOW_NOT_PINNED",
        message: "Pinned workflow version is missing or not accessible for this tenant.",
      });
    } else if (wf.status !== "PUBLISHED" || wf.publishedAt == null) {
      errors.push({
        code: "WORKFLOW_NOT_PUBLISHED",
        message:
          "Pinned workflow version must be PUBLISHED with a publish timestamp for compose (not DRAFT, SUPERSEDED, or missing publishedAt).",
        details: { workflowVersionId: wf.id, status: wf.status, hasPublishedAt: wf.publishedAt != null },
      });
    }
  }

  const structuralBlock =
    errors.some((e) =>
      ["NO_LINE_ITEMS", "WORKFLOW_NOT_PINNED", "WORKFLOW_NOT_PUBLISHED"].includes(e.code),
    );

  let nodeIds = new Set<string>();
  if (!structuralBlock && wf) {
    const parsed = parseWorkflowNodes(wf.snapshotJson);
    if (!parsed) {
      errors.push({
        code: "SNAPSHOT_SCHEMA_INVALID",
        message: "WorkflowVersion.snapshotJson must be an object with a nodes array.",
      });
    } else {
      nodeIds = parsed.nodeIds;
    }
  }

  const blocked =
    structuralBlock ||
    errors.some((e) => e.code === "SNAPSHOT_SCHEMA_INVALID");

  if (!blocked) {
    const manifestLines = model.orderedLineItems.filter((l) => l.executionMode === "MANIFEST");

    const revisionIds = [
      ...new Set(
        manifestLines.map((l) => l.scopePacketRevisionId).filter((id): id is string => id != null),
      ),
    ];
    const localPacketIds = [
      ...new Set(
        manifestLines.map((l) => l.quoteLocalPacketId).filter((id): id is string => id != null),
      ),
    ];

    const packetLines =
      revisionIds.length > 0
        ? await prisma.packetTaskLine.findMany({
            where: { scopePacketRevisionId: { in: revisionIds } },
            include: { taskDefinition: { select: { completionRequirementsJson: true, conditionalRulesJson: true, instructions: true } } },
            orderBy: [{ scopePacketRevisionId: "asc" }, { sortOrder: "asc" }, { lineKey: "asc" }],
          })
        : [];

    const localItems =
      localPacketIds.length > 0
        ? await prisma.quoteLocalPacketItem.findMany({
            where: { quoteLocalPacketId: { in: localPacketIds } },
            include: { taskDefinition: { select: { completionRequirementsJson: true, conditionalRulesJson: true, instructions: true } } },
            orderBy: [{ quoteLocalPacketId: "asc" }, { sortOrder: "asc" }, { lineKey: "asc" }],
          })
        : [];

    const linesByRevision = new Map<string, typeof packetLines>();
    for (const pl of packetLines) {
      const list = linesByRevision.get(pl.scopePacketRevisionId) ?? [];
      list.push(pl);
      linesByRevision.set(pl.scopePacketRevisionId, list);
    }

    const itemsByPacket = new Map<string, typeof localItems>();
    for (const li of localItems) {
      const list = itemsByPacket.get(li.quoteLocalPacketId) ?? [];
      list.push(li);
      itemsByPacket.set(li.quoteLocalPacketId, list);
    }

    for (const line of manifestLines) {
      const group = groupById.get(line.proposalGroupId);
      if (!group) {
        continue;
      }

      if (line.scopePacketRevisionId) {
        const candidates = linesByRevision.get(line.scopePacketRevisionId) ?? [];
        const filtered = candidates.filter((pl) => tierFilterInclude(line.tierCode, pl.tierCode));
        if (filtered.length === 0) {
          errors.push({
            code: "EXPANSION_EMPTY",
            message: "After tier filter, catalog packet yields no task lines for this manifest line.",
            lineItemId: line.id,
            details: { scopePacketRevisionId: line.scopePacketRevisionId },
          });
          continue;
        }
        const partialExclusion = summarizeTierPartialExclusion({ candidates, filtered });
        if (partialExclusion) {
          warnings.push({
            code: "PACKET_ITEMS_FILTERED_BY_TIER",
            message:
              "Tier filter excluded some catalog packet task lines for this manifest line; verify line tierCode matches packet authoring.",
            lineItemId: line.id,
            details: {
              scopePacketRevisionId: line.scopePacketRevisionId,
              lineTierCode: line.tierCode,
              includedCount: partialExclusion.includedCount,
              excludedCount: partialExclusion.excludedCount,
              sampleExcludedTierCodes: partialExclusion.sampleExcludedTierCodes,
            },
          });
        }

        for (const pl of filtered) {
          const embedded = readEmbeddedScopeFields(pl.embeddedPayloadJson);
          // Prefer top-level PacketTaskLine.targetNodeKey (canon amendment for the
          // interim promotion slice). Fall back to embeddedPayloadJson.targetNodeKey
          // for legacy rows that pre-date the column. The migration sentinel
          // ('__missing__') is treated as missing so behavior matches pre-migration
          // for rows that never carried a target.
          const topLevelTarget =
            typeof pl.targetNodeKey === "string" && pl.targetNodeKey !== "" && pl.targetNodeKey !== "__missing__"
              ? pl.targetNodeKey
              : undefined;
          const targetNodeKey = topLevelTarget ?? embedded.targetNodeKey;
          if (!targetNodeKey) {
            errors.push({
              code: "PACKAGE_BIND_FAILED",
              message:
                "Packet task line is missing targetNodeKey (top-level column and embeddedPayloadJson fallback both empty).",
              lineItemId: line.id,
              details: { packetLineKey: pl.lineKey },
            });
            continue;
          }
          if (!nodeIds.has(targetNodeKey)) {
            errors.push({
              code: "PACKAGE_BIND_FAILED",
              message: `targetNodeKey "${targetNodeKey}" is not present on pinned workflow snapshot nodes.`,
              lineItemId: line.id,
              details: { packetLineKey: pl.lineKey, targetNodeKey },
            });
            continue;
          }

          const title = embedded.title ?? pl.lineKey;
          const taskKind = embedded.taskKind ?? "UNKNOWN";
          const requirements = pl.taskDefinition?.completionRequirementsJson ?? embedded.completionRequirementsJson;
          const conditionalRules = pl.taskDefinition?.conditionalRulesJson ?? embedded.conditionalRulesJson;
          const instructions = pl.taskDefinition?.instructions ?? embedded.instructions;

          for (let quantityIndex = 0; quantityIndex < line.quantity; quantityIndex++) {
            const planTaskId = computePlanTaskIdLibrary({
              quoteVersionId: model.id,
              lineItemId: line.id,
              scopePacketRevisionId: line.scopePacketRevisionId,
              packetLineKey: pl.lineKey,
              quantityIndex,
              targetNodeKey,
            });
            const sortKey = `${group.sortOrder}|${group.id}|${line.sortOrder}|${line.id}|${pl.lineKey}|${quantityIndex}`;
            planRows.push({
              planTaskId,
              lineItemId: line.id,
              scopeSource: "LIBRARY_PACKET",
              scopePacketRevisionId: line.scopePacketRevisionId,
              packetLineKey: pl.lineKey,
              quantityIndex,
              targetNodeKey,
              title,
              taskKind,
              sortKey,
              tierCode: line.tierCode,
            });
            packageSlots.push({
              packageTaskId: computePackageTaskId({
                quoteVersionId: model.id,
                nodeId: targetNodeKey,
                planTaskId,
              }),
              nodeId: targetNodeKey,
              source: "SOLD_SCOPE",
              planTaskIds: [planTaskId],
              skeletonTaskId: null,
              displayTitle: title,
              lineItemId: line.id,
              completionRequirementsJson: requirements,
              conditionalRulesJson: conditionalRules,
              instructions,
            });
          }
        }
      } else if (line.quoteLocalPacketId) {
        const candidates = itemsByPacket.get(line.quoteLocalPacketId) ?? [];
        const filtered = candidates.filter((li) => tierFilterInclude(line.tierCode, li.tierCode));
        if (filtered.length === 0) {
          errors.push({
            code: "EXPANSION_EMPTY",
            message: "After tier filter, quote-local packet yields no items for this manifest line.",
            lineItemId: line.id,
            details: { quoteLocalPacketId: line.quoteLocalPacketId },
          });
          continue;
        }
        const partialExclusion = summarizeTierPartialExclusion({ candidates, filtered });
        if (partialExclusion) {
          warnings.push({
            code: "PACKET_ITEMS_FILTERED_BY_TIER",
            message:
              "Tier filter excluded some quote-local packet items for this manifest line; verify line tierCode matches packet authoring.",
            lineItemId: line.id,
            details: {
              quoteLocalPacketId: line.quoteLocalPacketId,
              lineTierCode: line.tierCode,
              includedCount: partialExclusion.includedCount,
              excludedCount: partialExclusion.excludedCount,
              sampleExcludedTierCodes: partialExclusion.sampleExcludedTierCodes,
            },
          });
        }

        for (const li of filtered) {
          const targetNodeKey = li.targetNodeKey;
          const embedded = readEmbeddedScopeFields(li.embeddedPayloadJson);
          if (!nodeIds.has(targetNodeKey)) {
            errors.push({
              code: "PACKAGE_BIND_FAILED",
              message: `targetNodeKey "${targetNodeKey}" is not present on pinned workflow snapshot nodes.`,
              lineItemId: line.id,
              details: { localLineKey: li.lineKey, targetNodeKey },
            });
            continue;
          }

          const title = embedded.title ?? li.lineKey;
          const taskKind = embedded.taskKind ?? "UNKNOWN";
          const requirements = li.taskDefinition?.completionRequirementsJson ?? embedded.completionRequirementsJson;
          const conditionalRules = li.taskDefinition?.conditionalRulesJson ?? embedded.conditionalRulesJson;
          const instructions = li.taskDefinition?.instructions ?? embedded.instructions;

          for (let quantityIndex = 0; quantityIndex < line.quantity; quantityIndex++) {
            const planTaskId = computePlanTaskIdLocal({
              quoteVersionId: model.id,
              lineItemId: line.id,
              quoteLocalPacketId: line.quoteLocalPacketId,
              localLineKey: li.lineKey,
              quantityIndex,
              targetNodeKey,
            });
            const sortKey = `${group.sortOrder}|${group.id}|${line.sortOrder}|${line.id}|${li.lineKey}|${quantityIndex}`;
            planRows.push({
              planTaskId,
              lineItemId: line.id,
              scopeSource: "QUOTE_LOCAL_PACKET",
              quoteLocalPacketId: line.quoteLocalPacketId,
              localLineKey: li.lineKey,
              quantityIndex,
              targetNodeKey,
              title,
              taskKind,
              sortKey,
              tierCode: line.tierCode,
            });
            packageSlots.push({
              packageTaskId: computePackageTaskId({
                quoteVersionId: model.id,
                nodeId: targetNodeKey,
                planTaskId,
              }),
              nodeId: targetNodeKey,
              source: "SOLD_SCOPE",
              planTaskIds: [planTaskId],
              skeletonTaskId: null,
              displayTitle: title,
              lineItemId: line.id,
              completionRequirementsJson: requirements,
              conditionalRulesJson: conditionalRules,
              instructions,
            });
          }
        }
      }
    }

    const soldLines = model.orderedLineItems.filter((l) => l.executionMode === "SOLD_SCOPE");
    if (soldLines.length > 0) {
      const sortedNodeIds = [...nodeIds].sort((a, b) => a.localeCompare(b));
      const defaultNodeId = sortedNodeIds[0];
      if (defaultNodeId === undefined) {
        errors.push({
          code: "PACKAGE_BIND_FAILED",
          message:
            "SOLD_SCOPE commercial lines need at least one node on the pinned workflow snapshot to bind placement.",
        });
      } else {
        for (const line of soldLines) {
          const group = groupById.get(line.proposalGroupId);
          if (!group) {
            continue;
          }
          warnings.push({
            code: "COMMERCIAL_SOLD_DEFAULT_NODE_PLACEMENT",
            message:
              "SOLD_SCOPE line uses first workflow node (lexicographic id) as placement placeholder until line-level target is specified.",
            lineItemId: line.id,
            details: { targetNodeKey: defaultNodeId },
          });
          for (let quantityIndex = 0; quantityIndex < line.quantity; quantityIndex++) {
            const planTaskId = computePlanTaskIdCommercialSold({
              quoteVersionId: model.id,
              lineItemId: line.id,
              quantityIndex,
              targetNodeKey: defaultNodeId,
            });
            const sortKey = `${group.sortOrder}|${group.id}|${line.sortOrder}|${line.id}|sold|${quantityIndex}`;
            const title = line.title.trim() || "Commercial line";
            planRows.push({
              planTaskId,
              lineItemId: line.id,
              scopeSource: "COMMERCIAL_SOLD",
              quantityIndex,
              targetNodeKey: defaultNodeId,
              title,
              taskKind: "COMMERCIAL_SOLD",
              sortKey,
              tierCode: line.tierCode,
            });
            packageSlots.push({
              packageTaskId: computePackageTaskId({
                quoteVersionId: model.id,
                nodeId: defaultNodeId,
                planTaskId,
              }),
              nodeId: defaultNodeId,
              source: "SOLD_SCOPE",
              planTaskIds: [planTaskId],
              skeletonTaskId: null,
              displayTitle: title,
              lineItemId: line.id,
            });
          }
        }
      }
    }
  }

  return { errors, warnings, planRows, packageSlots };
}
