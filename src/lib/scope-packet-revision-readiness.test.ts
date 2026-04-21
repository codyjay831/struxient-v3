import { describe, expect, it } from "vitest";
import {
  evaluateScopePacketRevisionReadiness,
  TARGET_NODE_KEY_BACKFILL_SENTINEL,
  type ScopePacketRevisionReadinessLine,
} from "./scope-packet-revision-readiness";
import type { TaskDefinitionStatus } from "@prisma/client";

function embeddedLine(
  overrides: Partial<ScopePacketRevisionReadinessLine> = {},
): ScopePacketRevisionReadinessLine {
  return {
    id: "line_e",
    lineKey: "line-key",
    lineKind: "EMBEDDED",
    targetNodeKey: "node-x",
    embeddedPayloadJson: { title: "ok", taskKind: "LABOR" },
    taskDefinitionId: null,
    taskDefinition: null,
    ...overrides,
  };
}

function libraryLine(
  overrides: Partial<ScopePacketRevisionReadinessLine> = {},
  taskDefStatus: TaskDefinitionStatus = "PUBLISHED",
): ScopePacketRevisionReadinessLine {
  return {
    id: "line_l",
    lineKey: "lib-line-key",
    lineKind: "LIBRARY",
    targetNodeKey: "node-y",
    embeddedPayloadJson: {},
    taskDefinitionId: "td_1",
    taskDefinition: { id: "td_1", status: taskDefStatus },
    ...overrides,
  };
}

describe("evaluateScopePacketRevisionReadiness — clean / ready", () => {
  it("EMBEDDED-only revision with valid payload + targetNodeKey is ready", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [
        embeddedLine({ id: "l1", lineKey: "k1" }),
        embeddedLine({ id: "l2", lineKey: "k2", embeddedPayloadJson: ["a", "b"] }),
      ],
    });
    expect(result.isReady).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("Mixed LIBRARY (PUBLISHED def) + EMBEDDED revision is ready", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [
        libraryLine({ id: "l1", lineKey: "lib-1" }, "PUBLISHED"),
        embeddedLine({ id: "l2", lineKey: "emb-1" }),
      ],
    });
    expect(result.isReady).toBe(true);
    expect(result.blockers).toEqual([]);
  });
});

describe("evaluateScopePacketRevisionReadiness — EMPTY_REVISION", () => {
  it("flags an empty revision and short-circuits (no per-line blockers)", () => {
    const result = evaluateScopePacketRevisionReadiness({ packetTaskLines: [] });
    expect(result.isReady).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0].code).toBe("EMPTY_REVISION");
    expect(result.blockers[0].lineId).toBeUndefined();
    expect(result.blockers[0].lineKey).toBeUndefined();
  });
});

describe("evaluateScopePacketRevisionReadiness — targetNodeKey gates", () => {
  it("flags MISSING_TARGET_NODE_KEY for empty string", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [embeddedLine({ id: "l1", lineKey: "k1", targetNodeKey: "" })],
    });
    expect(result.isReady).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toMatchObject({
      code: "MISSING_TARGET_NODE_KEY",
      lineId: "l1",
      lineKey: "k1",
    });
  });

  it("flags TARGET_NODE_KEY_SENTINEL for the migration backfill marker", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [
        embeddedLine({
          id: "l1",
          lineKey: "k1",
          targetNodeKey: TARGET_NODE_KEY_BACKFILL_SENTINEL,
        }),
      ],
    });
    expect(result.isReady).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toMatchObject({
      code: "TARGET_NODE_KEY_SENTINEL",
      lineId: "l1",
      lineKey: "k1",
    });
  });

  it("MISSING and SENTINEL are mutually exclusive on the same row (not double-flagged)", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [embeddedLine({ id: "l1", lineKey: "k1", targetNodeKey: "" })],
    });
    expect(
      result.blockers.filter(
        (b) => b.code === "MISSING_TARGET_NODE_KEY" || b.code === "TARGET_NODE_KEY_SENTINEL",
      ),
    ).toHaveLength(1);
  });
});

describe("evaluateScopePacketRevisionReadiness — LIBRARY task-definition gates", () => {
  it("flags LIBRARY_ROW_TASK_DEFINITION_MISSING when taskDefinitionId is null", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [
        libraryLine({
          id: "l1",
          lineKey: "lib-null",
          taskDefinitionId: null,
          taskDefinition: null,
        }),
      ],
    });
    expect(result.isReady).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toMatchObject({
      code: "LIBRARY_ROW_TASK_DEFINITION_MISSING",
      lineId: "l1",
      lineKey: "lib-null",
      taskDefinitionId: null,
    });
  });

  it("flags LIBRARY_ROW_TASK_DEFINITION_MISSING when relation row was orphaned (id set, relation null)", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [
        libraryLine({
          id: "l1",
          lineKey: "lib-orphan",
          taskDefinitionId: "td_gone",
          taskDefinition: null,
        }),
      ],
    });
    expect(result.isReady).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toMatchObject({
      code: "LIBRARY_ROW_TASK_DEFINITION_MISSING",
      taskDefinitionId: "td_gone",
    });
  });

  it("flags LIBRARY_ROW_TASK_DEFINITION_NOT_PUBLISHED for DRAFT TaskDefinition", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [
        libraryLine({ id: "l1", lineKey: "lib-draft" }, "DRAFT"),
      ],
    });
    expect(result.isReady).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toMatchObject({
      code: "LIBRARY_ROW_TASK_DEFINITION_NOT_PUBLISHED",
      lineId: "l1",
      lineKey: "lib-draft",
      taskDefinitionId: "td_1",
      taskDefinitionStatus: "DRAFT",
    });
  });

  it("flags LIBRARY_ROW_TASK_DEFINITION_NOT_PUBLISHED for ARCHIVED TaskDefinition", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [libraryLine({ id: "l1", lineKey: "lib-arch" }, "ARCHIVED")],
    });
    expect(result.blockers[0]).toMatchObject({
      code: "LIBRARY_ROW_TASK_DEFINITION_NOT_PUBLISHED",
      taskDefinitionStatus: "ARCHIVED",
    });
  });

  it("LIBRARY_ROW_* blockers do not apply to EMBEDDED rows even when taskDefinition is null", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [
        embeddedLine({
          id: "l1",
          lineKey: "emb-no-def",
          taskDefinitionId: null,
          taskDefinition: null,
        }),
      ],
    });
    expect(result.isReady).toBe(true);
    expect(result.blockers).toEqual([]);
  });
});

describe("evaluateScopePacketRevisionReadiness — EMBEDDED_ROW_PAYLOAD_EMPTY", () => {
  it("flags EMBEDDED row with `{}` payload (the promotion-mapping null→{} normalization case)", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [embeddedLine({ id: "l1", lineKey: "emb-empty", embeddedPayloadJson: {} })],
    });
    expect(result.isReady).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toMatchObject({
      code: "EMBEDDED_ROW_PAYLOAD_EMPTY",
      lineId: "l1",
      lineKey: "emb-empty",
    });
  });

  it("flags EMBEDDED row with empty array payload", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [embeddedLine({ embeddedPayloadJson: [] })],
    });
    expect(result.blockers[0]?.code).toBe("EMBEDDED_ROW_PAYLOAD_EMPTY");
  });

  it("flags EMBEDDED row with null payload (defensive — schema is NOT NULL but predicate is read-shape-agnostic)", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [embeddedLine({ embeddedPayloadJson: null })],
    });
    expect(result.blockers[0]?.code).toBe("EMBEDDED_ROW_PAYLOAD_EMPTY");
  });

  it("does NOT flag LIBRARY row with `{}` payload (LIBRARY rows do not require inline payload)", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [libraryLine({ embeddedPayloadJson: {} }, "PUBLISHED")],
    });
    expect(result.isReady).toBe(true);
    expect(result.blockers).toEqual([]);
  });
});

describe("evaluateScopePacketRevisionReadiness — multi-blocker accumulation + ordering", () => {
  it("returns blockers in input order; multiple lines accumulate independently", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [
        embeddedLine({ id: "l1", lineKey: "k1", targetNodeKey: "" }),
        libraryLine({ id: "l2", lineKey: "k2" }, "DRAFT"),
        embeddedLine({ id: "l3", lineKey: "k3", embeddedPayloadJson: {} }),
      ],
    });
    expect(result.isReady).toBe(false);
    expect(result.blockers.map((b) => b.code)).toEqual([
      "MISSING_TARGET_NODE_KEY",
      "LIBRARY_ROW_TASK_DEFINITION_NOT_PUBLISHED",
      "EMBEDDED_ROW_PAYLOAD_EMPTY",
    ]);
    expect(result.blockers.map((b) => b.lineKey)).toEqual(["k1", "k2", "k3"]);
  });

  it("a single line can raise more than one blocker (sentinel + LIBRARY-not-published)", () => {
    const result = evaluateScopePacketRevisionReadiness({
      packetTaskLines: [
        libraryLine(
          {
            id: "l1",
            lineKey: "k1",
            targetNodeKey: TARGET_NODE_KEY_BACKFILL_SENTINEL,
          },
          "DRAFT",
        ),
      ],
    });
    expect(result.blockers.map((b) => b.code)).toEqual([
      "TARGET_NODE_KEY_SENTINEL",
      "LIBRARY_ROW_TASK_DEFINITION_NOT_PUBLISHED",
    ]);
  });
});
