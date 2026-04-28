import { describe, expect, it } from "vitest";
import {
  buildEmbeddedPayload,
  draftToBody,
  emptyDraft,
  finalizeEmbeddedDraftForSubmit,
  itemToDraft,
  lineKeysForPacketCollision,
  type NewItemDraft,
} from "./quote-local-packet-item-authoring";
import type { QuoteLocalPacketItemDto } from "@/server/slice1/reads/quote-local-packet-reads";

function embeddedItem(overrides: Partial<QuoteLocalPacketItemDto>): QuoteLocalPacketItemDto {
  return {
    id: "item-1",
    lineKey: "my-line",
    sortOrder: 3,
    tierCode: null,
    lineKind: "EMBEDDED",
    embeddedPayloadJson: { title: "T", instructions: "Do the thing" },
    taskDefinitionId: null,
    taskDefinition: null,
    targetNodeKey: "node-a",
    createdAtIso: "",
    updatedAtIso: "",
    ...overrides,
  };
}

describe("draftToBody / buildEmbeddedPayload", () => {
  it("maps embedded simple fields to API body", () => {
    const draft: NewItemDraft = {
      ...emptyDraft(1),
      lineKey: "tear-off-1",
      sortOrder: 1,
      lineKind: "EMBEDDED",
      embeddedTitle: "Tear off",
      embeddedInstructions: "Remove shingles",
      targetNodeKey: "STAGE_SITE",
      tierCode: "",
      embeddedTaskKind: "",
      taskDefinitionId: "",
    };
    const body = draftToBody(draft);
    expect(body).toEqual({
      lineKey: "tear-off-1",
      sortOrder: 1,
      tierCode: null,
      lineKind: "EMBEDDED",
      embeddedPayloadJson: {
        title: "Tear off",
        instructions: "Remove shingles",
      },
      taskDefinitionId: null,
      targetNodeKey: "STAGE_SITE",
    });
  });

  it("omits taskKind when blank", () => {
    const draft: NewItemDraft = {
      ...emptyDraft(0),
      lineKey: "k",
      lineKind: "EMBEDDED",
      embeddedTitle: "Title",
      embeddedTaskKind: "",
      embeddedInstructions: "",
      targetNodeKey: "STAGE_X",
    };
    const payload = buildEmbeddedPayload(draft);
    expect(payload).toEqual({ title: "Title" });
    expect("taskKind" in (payload ?? {})).toBe(false);
  });

  it("includes taskKind when advanced field set", () => {
    const draft: NewItemDraft = {
      ...emptyDraft(0),
      lineKey: "k",
      lineKind: "EMBEDDED",
      embeddedTitle: "Title",
      embeddedTaskKind: "INSPECT",
      embeddedInstructions: "",
      targetNodeKey: "STAGE_X",
    };
    expect(buildEmbeddedPayload(draft)).toMatchObject({ title: "Title", taskKind: "INSPECT" });
  });

  it("maps library item to null embedded and taskDefinitionId", () => {
    const draft: NewItemDraft = {
      ...emptyDraft(0),
      lineKey: "lib-1",
      lineKind: "LIBRARY",
      taskDefinitionId: "td-99",
      targetNodeKey: "STAGE_Y",
      embeddedTitle: "ignored",
    };
    const body = draftToBody(draft);
    expect(body.lineKind).toBe("LIBRARY");
    expect(body.embeddedPayloadJson).toBeNull();
    expect(body.taskDefinitionId).toBe("td-99");
  });

  it("itemToDraft round-trips embedded title and instructions", () => {
    const d = itemToDraft(embeddedItem({}));
    expect(d.embeddedTitle).toBe("T");
    expect(d.embeddedInstructions).toBe("Do the thing");
    expect(d.lineKind).toBe("EMBEDDED");
  });
});

describe("finalizeEmbeddedDraftForSubmit", () => {
  it("auto-fills lineKey from task name when blank", () => {
    const draft: NewItemDraft = {
      ...emptyDraft(0),
      lineKind: "EMBEDDED",
      lineKey: "",
      embeddedTitle: "Tear off roof",
      embeddedInstructions: "",
      targetNodeKey: "STAGE_A",
    };
    const out = finalizeEmbeddedDraftForSubmit(draft, []);
    expect(out.lineKey).toBe("tear-off-roof");
  });

  it("respects internal key override", () => {
    const draft: NewItemDraft = {
      ...emptyDraft(0),
      lineKind: "EMBEDDED",
      lineKey: "custom-key",
      embeddedTitle: "Other",
      targetNodeKey: "STAGE_A",
    };
    const out = finalizeEmbeddedDraftForSubmit(draft, ["tear-off-roof"]);
    expect(out.lineKey).toBe("custom-key");
  });
});

describe("lineKeysForPacketCollision", () => {
  it("excludes one item id", () => {
    const items = [
      embeddedItem({ id: "a", lineKey: "x" }),
      embeddedItem({ id: "b", lineKey: "y" }),
    ];
    expect(lineKeysForPacketCollision(items, "a")).toEqual(["y"]);
  });
});
