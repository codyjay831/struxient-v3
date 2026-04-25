import { describe, expect, it } from "vitest";
import { formatExecutionModeLabel } from "./quote-line-item-execution-mode-label";

describe("formatExecutionModeLabel", () => {
  it("renders SOLD_SCOPE as 'Quote-only'", () => {
    expect(formatExecutionModeLabel("SOLD_SCOPE")).toBe("Quote-only");
  });

  it("renders MANIFEST as 'Field work'", () => {
    expect(formatExecutionModeLabel("MANIFEST")).toBe("Field work");
  });

  it("falls back to the raw input for unknown enum values", () => {
    // Forward-compatibility: a future enum value (or a corrupted row) should
    // surface as the raw string rather than silently re-mapping.
    expect(formatExecutionModeLabel("FUTURE_MODE")).toBe("FUTURE_MODE");
    expect(formatExecutionModeLabel("")).toBe("");
  });
});
