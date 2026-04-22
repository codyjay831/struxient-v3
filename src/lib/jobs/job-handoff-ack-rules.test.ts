import { describe, expect, it } from "vitest";
import { canAcknowledgeJobHandoff } from "./job-handoff-ack-rules";

describe("canAcknowledgeJobHandoff", () => {
  it("requires field capability and SENT status", () => {
    expect(
      canAcknowledgeJobHandoff({
        status: "DRAFT",
        assignedUserIds: [],
        principalUserId: "u1",
        hasFieldExecuteCapability: true,
      }),
    ).toBe(false);
    expect(
      canAcknowledgeJobHandoff({
        status: "SENT",
        assignedUserIds: [],
        principalUserId: "u1",
        hasFieldExecuteCapability: false,
      }),
    ).toBe(false);
  });

  it("allows any field principal when assignee list is empty", () => {
    expect(
      canAcknowledgeJobHandoff({
        status: "SENT",
        assignedUserIds: [],
        principalUserId: "u1",
        hasFieldExecuteCapability: true,
      }),
    ).toBe(true);
  });

  it("requires principal to be listed when assignees are set", () => {
    expect(
      canAcknowledgeJobHandoff({
        status: "SENT",
        assignedUserIds: ["a", "b"],
        principalUserId: "b",
        hasFieldExecuteCapability: true,
      }),
    ).toBe(true);
    expect(
      canAcknowledgeJobHandoff({
        status: "SENT",
        assignedUserIds: ["a", "b"],
        principalUserId: "c",
        hasFieldExecuteCapability: true,
      }),
    ).toBe(false);
  });
});
