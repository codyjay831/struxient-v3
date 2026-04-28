import type { QuoteLocalPacketItemDto } from "@/server/slice1/reads/quote-local-packet-reads";
import { lineKeyFromTaskName } from "@/lib/line-key-from-task-name";

export type NewItemDraft = {
  lineKey: string;
  sortOrder: number;
  tierCode: string;
  lineKind: "EMBEDDED" | "LIBRARY";
  embeddedTitle: string;
  embeddedTaskKind: string;
  embeddedInstructions: string;
  taskDefinitionId: string;
  targetNodeKey: string;
};

export function emptyDraft(sortOrder = 0): NewItemDraft {
  return {
    lineKey: "",
    sortOrder,
    tierCode: "",
    lineKind: "EMBEDDED",
    embeddedTitle: "",
    embeddedTaskKind: "",
    embeddedInstructions: "",
    taskDefinitionId: "",
    targetNodeKey: "",
  };
}

export function itemToDraft(item: QuoteLocalPacketItemDto): NewItemDraft {
  const embedded = (item.embeddedPayloadJson ?? null) as Record<string, unknown> | null;
  return {
    lineKey: item.lineKey,
    sortOrder: item.sortOrder,
    tierCode: item.tierCode ?? "",
    lineKind: item.lineKind,
    embeddedTitle: typeof embedded?.title === "string" ? embedded.title : "",
    embeddedTaskKind: typeof embedded?.taskKind === "string" ? embedded.taskKind : "",
    embeddedInstructions:
      typeof embedded?.instructions === "string" ? embedded.instructions : "",
    taskDefinitionId: item.taskDefinitionId ?? "",
    targetNodeKey: item.targetNodeKey,
  };
}

export function buildEmbeddedPayload(draft: NewItemDraft): Record<string, unknown> | null {
  if (draft.lineKind !== "EMBEDDED") return null;
  const out: Record<string, unknown> = {};
  if (draft.embeddedTitle.trim() !== "") out.title = draft.embeddedTitle.trim();
  if (draft.embeddedTaskKind.trim() !== "") out.taskKind = draft.embeddedTaskKind.trim();
  if (draft.embeddedInstructions.trim() !== "") out.instructions = draft.embeddedInstructions.trim();
  return out;
}

export type QuoteLocalPacketItemApiBody = {
  lineKey: string;
  sortOrder: number;
  tierCode: string | null;
  lineKind: "EMBEDDED" | "LIBRARY";
  embeddedPayloadJson: Record<string, unknown> | null;
  taskDefinitionId: string | null;
  targetNodeKey: string;
};

export function readEmbeddedTitle(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
  const t = (payload as Record<string, unknown>).title;
  return typeof t === "string" ? t : null;
}

export function readEmbeddedInstructions(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
  const t = (payload as Record<string, unknown>).instructions;
  return typeof t === "string" ? t : null;
}

export function readCompletionRequirementCount(payload: unknown): number {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return 0;
  const cr = (payload as Record<string, unknown>).completionRequirementsJson;
  return Array.isArray(cr) ? cr.length : 0;
}

/** Other items' line keys on the same packet (exclude one item when editing). */
export function lineKeysForPacketCollision(
  items: QuoteLocalPacketItemDto[],
  excludeItemId?: string,
): string[] {
  return items
    .filter((i) => (excludeItemId ? i.id !== excludeItemId : true))
    .map((i) => i.lineKey);
}

/** Fills `lineKey` from task name when blank; keeps EMBEDDED kind. */
export function finalizeEmbeddedDraftForSubmit(
  draft: NewItemDraft,
  collisionLineKeys: string[],
): NewItemDraft {
  const next: NewItemDraft = { ...draft, lineKind: "EMBEDDED" };
  const trimmedTitle = next.embeddedTitle.trim();
  const keySet = new Set(collisionLineKeys.filter((k) => k.trim().length > 0));
  let lk = next.lineKey.trim();
  if (lk.length === 0) {
    lk = lineKeyFromTaskName(trimmedTitle.length > 0 ? trimmedTitle : "task", keySet);
  }
  return { ...next, lineKey: lk };
}

export function draftToBody(draft: NewItemDraft): QuoteLocalPacketItemApiBody {
  const embedded = draft.lineKind === "EMBEDDED" ? buildEmbeddedPayload(draft) : null;
  return {
    lineKey: draft.lineKey.trim(),
    sortOrder: draft.sortOrder,
    tierCode: draft.tierCode.trim() === "" ? null : draft.tierCode,
    lineKind: draft.lineKind,
    embeddedPayloadJson: embedded,
    taskDefinitionId:
      draft.lineKind === "LIBRARY" ? draft.taskDefinitionId.trim() || null : null,
    targetNodeKey: draft.targetNodeKey.trim(),
  };
}
