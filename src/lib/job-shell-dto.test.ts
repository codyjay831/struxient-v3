import { describe, expect, it } from "vitest";
import { toJobShellApiDto } from "./job-shell-dto";
import type { JobShellReadModel } from "@/server/slice1/reads/job-shell";

describe("toJobShellApiDto", () => {
  it("maps payment gates with targetCount and satisfiedAt ISO", () => {
    const satisfiedAt = new Date("2026-04-22T12:00:00.000Z");
    const m: JobShellReadModel = {
      job: {
        id: "job_1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        flowGroupId: "fg_1",
        tenantId: "t_1",
      },
      flowGroup: { id: "fg_1", name: "FG", customerId: "c_1" },
      customer: { id: "c_1", name: "Customer" },
      flows: [],
      paymentGates: [
        {
          id: "gate_a",
          status: "UNSATISFIED",
          title: "Deposit",
          satisfiedAt: null,
          targets: [
            { taskId: "rt_1", taskKind: "RUNTIME" },
            { taskId: "sk_1", taskKind: "SKELETON" },
          ],
        },
        {
          id: "gate_b",
          status: "SATISFIED",
          title: "Final",
          satisfiedAt,
          targets: [{ taskId: "rt_2", taskKind: "RUNTIME" }],
        },
      ],
      activeOperationalHolds: [
        {
          id: "hold_1",
          runtimeTaskId: null,
          holdType: "OPERATIONAL_CUSTOM",
          reason: "Weather",
        },
      ],
    };

    const dto = toJobShellApiDto(m);
    expect(dto.paymentGates).toEqual([
      {
        id: "gate_a",
        status: "UNSATISFIED",
        title: "Deposit",
        targetCount: 2,
        satisfiedAt: null,
      },
      {
        id: "gate_b",
        status: "SATISFIED",
        title: "Final",
        targetCount: 1,
        satisfiedAt: satisfiedAt.toISOString(),
      },
    ]);
    expect(dto.activeOperationalHolds).toHaveLength(1);
    expect(dto.activeOperationalHolds[0].id).toBe("hold_1");
  });
});
