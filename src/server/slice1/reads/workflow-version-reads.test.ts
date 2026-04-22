import { describe, expect, it } from "vitest";
import { toWorkflowVersionDiscoveryDto } from "./workflow-version-reads";

describe("toWorkflowVersionDiscoveryDto", () => {
  const baseTemplate = { id: "tmpl-1", displayName: "T", templateKey: "tkey" };

  it("maps PUBLISHED with timestamp to ISO publishedAt", () => {
    const d = new Date("2026-04-22T12:00:00.000Z");
    expect(
      toWorkflowVersionDiscoveryDto({
        id: "wv-1",
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: d,
        workflowTemplate: baseTemplate,
      }),
    ).toEqual({
      id: "wv-1",
      workflowTemplateId: "tmpl-1",
      templateDisplayName: "T",
      templateKey: "tkey",
      versionNumber: 1,
      status: "PUBLISHED",
      publishedAt: "2026-04-22T12:00:00.000Z",
    });
  });

  it("maps honest DRAFT with null publishedAt", () => {
    expect(
      toWorkflowVersionDiscoveryDto({
        id: "wv-draft",
        versionNumber: 2,
        status: "DRAFT",
        publishedAt: null,
        workflowTemplate: baseTemplate,
      }),
    ).toMatchObject({
      id: "wv-draft",
      status: "DRAFT",
      publishedAt: null,
    });
  });

  it("maps SUPERSEDED with historical publishedAt", () => {
    const d = new Date("2026-01-01T00:00:00.000Z");
    expect(
      toWorkflowVersionDiscoveryDto({
        id: "wv-old",
        versionNumber: 1,
        status: "SUPERSEDED",
        publishedAt: d,
        workflowTemplate: baseTemplate,
      }),
    ).toMatchObject({
      status: "SUPERSEDED",
      publishedAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
