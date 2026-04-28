import { describe, expect, it } from "vitest";
import { lineKeyFromTaskName, QUOTE_LOCAL_PACKET_ITEM_MAX_LINE_KEY } from "./line-key-from-task-name";

describe("lineKeyFromTaskName", () => {
  it("slugifies spaces and lowercases", () => {
    expect(lineKeyFromTaskName("Roof Tear Off", new Set())).toBe("roof-tear-off");
  });

  it("strips invalid characters", () => {
    expect(lineKeyFromTaskName("Job #1 — inspect!", new Set())).toBe("job-1-inspect");
  });

  it("uses -2 when base collides", () => {
    const existing = new Set(["roof"]);
    expect(lineKeyFromTaskName("roof", existing)).toBe("roof-2");
  });

  it("uses -3 when -2 collides", () => {
    const existing = new Set(["roof", "roof-2"]);
    expect(lineKeyFromTaskName("roof", existing)).toBe("roof-3");
  });

  it("falls back to task when name yields empty slug", () => {
    expect(lineKeyFromTaskName("@@@", new Set())).toBe("task");
  });

  it("falls back with collision on empty slug", () => {
    expect(lineKeyFromTaskName("@@@", new Set(["task"]))).toBe("task-2");
  });

  it("clamps to max length", () => {
    const long = "a".repeat(200);
    const key = lineKeyFromTaskName(long, new Set());
    expect(key.length).toBeLessThanOrEqual(QUOTE_LOCAL_PACKET_ITEM_MAX_LINE_KEY);
    expect(key).toMatch(/^[a-z0-9_.:-]+$/);
  });

  it("keeps suffix within max length when stem is long", () => {
    const stem = "x".repeat(QUOTE_LOCAL_PACKET_ITEM_MAX_LINE_KEY);
    const key = lineKeyFromTaskName(stem, new Set([stem.slice(0, 80)]));
    expect(key.length).toBeLessThanOrEqual(QUOTE_LOCAL_PACKET_ITEM_MAX_LINE_KEY);
    expect(key.endsWith("-2")).toBe(true);
  });
});
