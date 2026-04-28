import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Banned in primary office quote workspace framing (advanced/support may still use technical terms). */
const BANNED_IN_PRIMARY = [
  "Commercial Pipeline",
  "Execution bridge",
  "Revision history",
  "Revision management",
  "Proposed Execution Flow",
  "Activate Execution",
  "runtime tasks",
  "workflow pin",
  "snapshot",
] as const;

function stripDetailsBlocks(src: string): string {
  let out = src;
  for (;;) {
    const open = out.indexOf("<details");
    if (open === -1) break;
    const close = out.indexOf("</details>", open);
    if (close === -1) break;
    out = `${out.slice(0, open)}${out.slice(close + "</details>".length)}`;
  }
  return out;
}

function readWorkspacePrimaryBlob(): string {
  const root = path.resolve(__dirname, "../..");
  const rels = [
    "app/(office)/quotes/[quoteId]/page.tsx",
    "lib/workspace/quote-workspace-next-action.ts",
    "components/quotes/workspace/quote-workspace-next-action-card.tsx",
    "components/quotes/workspace/quote-workspace-pipeline-step.tsx",
    "components/quotes/workspace/quote-workspace-head-readiness.tsx",
    "components/quotes/workspace/quote-workspace-execution-bridge.tsx",
    "components/quotes/workspace/quote-workspace-version-history.tsx",
    "components/quotes/workspace/quote-workspace-actions.tsx",
    "components/quotes/workspace/quote-workspace-activate-signed.tsx",
    "components/quotes/workspace/quote-workspace-proposed-execution-flow.tsx",
  ];
  const composePath = path.join(root, "components/quotes/workspace/quote-workspace-compose-send-panel.tsx");
  const signPath = path.join(root, "components/quotes/workspace/quote-workspace-sign-sent.tsx");

  let acc = "";
  for (const rel of rels) {
    acc += readFileSync(path.join(root, rel), "utf8");
  }
  acc += stripDetailsBlocks(readFileSync(composePath, "utf8"));
  acc += stripDetailsBlocks(readFileSync(signPath, "utf8"));

  return acc;
}

describe("quote workspace primary copy", () => {
  it("office-facing workspace sources avoid deprecated primary-flow labels", () => {
    const blob = readWorkspacePrimaryBlob();
    for (const phrase of BANNED_IN_PRIMARY) {
      expect(blob.includes(phrase), `unexpected primary phrase "${phrase}"`).toBe(false);
    }
    expect(/\bnode\b/i.test(blob)).toBe(false);
  });
});
