import { describe, expect, it } from "vitest";
import { validateCompletionProofAgainstContract } from "./completion-proof-contract-validation";

describe("validateCompletionProofAgainstContract", () => {
  it("matches runtime-style baseline + conditional errors", () => {
    const reqs = [{ kind: "result", required: true }];
    const rules = [
      { trigger: { kind: "result", value: "FAIL" }, require: { kind: "note", message: "Need note" } },
    ];
    expect(validateCompletionProofAgainstContract(reqs, rules, {}).length).toBeGreaterThan(0);
    expect(
      validateCompletionProofAgainstContract(reqs, rules, { overallResult: "FAIL", note: "x" }).length,
    ).toBe(0);
  });
});
