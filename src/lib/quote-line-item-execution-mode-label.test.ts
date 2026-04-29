import { describe, expect, it } from "vitest";
import { formatExecutionModeLabel } from "./quote-line-item-execution-mode-label";

describe("formatExecutionModeLabel", () => {
  it("renders SOLD_SCOPE as 'Estimate-only'", () => {
    expect(formatExecutionModeLabel("SOLD_SCOPE")).toBe("Estimate-only");
  });

  it("renders MANIFEST as 'Includes crew work'", () => {
    expect(formatExecutionModeLabel("MANIFEST")).toBe("Includes crew work");
  });

  it("falls back to the raw input for unknown enum values", () => {
    // Forward-compatibility: a future enum value (or a corrupted row) should
    // surface as the raw string rather than silently re-mapping.
    expect(formatExecutionModeLabel("FUTURE_MODE")).toBe("FUTURE_MODE");
    expect(formatExecutionModeLabel("")).toBe("");
  });
});
