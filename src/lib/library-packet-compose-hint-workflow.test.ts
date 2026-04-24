import { describe, expect, it } from "vitest";
import { formatLibraryPacketComposeHintWorkflowLabel } from "./library-packet-compose-hint-workflow";

describe("formatLibraryPacketComposeHintWorkflowLabel", () => {
  it("joins display name, version, and template key", () => {
    expect(
      formatLibraryPacketComposeHintWorkflowLabel({
        templateDisplayName: "Residential install",
        templateKey: "res_install",
        versionNumber: 3,
      }),
    ).toBe("Residential install · v3 · res_install");
  });
});
