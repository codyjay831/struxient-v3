import { describe, expect, it } from "vitest";
import { filterTaskDefinitionSummariesByQuery } from "./task-definition-picker-filter";
import type { TaskDefinitionSummaryDto } from "@/server/slice1/reads/task-definition-reads";

function summary(over: Partial<TaskDefinitionSummaryDto>): TaskDefinitionSummaryDto {
  return {
    id: "td_default",
    taskKey: "default-key",
    displayName: "Default Display",
    status: "PUBLISHED",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    requirementsCount: 0,
    conditionalRulesCount: 0,
    packetTaskLineRefCount: 0,
    quoteLocalPacketItemRefCount: 0,
    ...over,
  };
}

const fixtures: TaskDefinitionSummaryDto[] = [
  summary({ id: "td_1", taskKey: "inspect-roof", displayName: "Roof Inspection" }),
  summary({ id: "td_2", taskKey: "install-vent", displayName: "Vent Installation" }),
  summary({ id: "td_3", taskKey: "cleanup-debris", displayName: "Site Cleanup" }),
];

describe("filterTaskDefinitionSummariesByQuery", () => {
  it("returns all items when the query is empty/whitespace", () => {
    expect(filterTaskDefinitionSummariesByQuery(fixtures, "")).toEqual(fixtures);
    expect(filterTaskDefinitionSummariesByQuery(fixtures, "   ")).toEqual(fixtures);
  });

  it("filters by taskKey case-insensitively", () => {
    const result = filterTaskDefinitionSummariesByQuery(fixtures, "INSPECT");
    expect(result.map((r) => r.id)).toEqual(["td_1"]);
  });

  it("filters by displayName case-insensitively", () => {
    const result = filterTaskDefinitionSummariesByQuery(fixtures, "cleanup");
    expect(result.map((r) => r.id)).toEqual(["td_3"]);
  });

  it("matches across both taskKey and displayName", () => {
    const result = filterTaskDefinitionSummariesByQuery(fixtures, "vent");
    expect(result.map((r) => r.id)).toEqual(["td_2"]);
  });

  it("returns empty array when nothing matches", () => {
    expect(filterTaskDefinitionSummariesByQuery(fixtures, "no-such-thing")).toEqual([]);
  });

  it("trims surrounding whitespace before matching", () => {
    const result = filterTaskDefinitionSummariesByQuery(fixtures, "  install  ");
    expect(result.map((r) => r.id)).toEqual(["td_2"]);
  });

  it("returns substring matches anywhere in the field", () => {
    const result = filterTaskDefinitionSummariesByQuery(fixtures, "tion");
    expect(result.map((r) => r.id).sort()).toEqual(["td_1", "td_2"]);
  });

  it("returns empty when input list is empty regardless of query", () => {
    expect(filterTaskDefinitionSummariesByQuery([], "anything")).toEqual([]);
    expect(filterTaskDefinitionSummariesByQuery([], "")).toEqual([]);
  });
});
