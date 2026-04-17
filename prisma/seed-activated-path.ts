/**
 * Dev smoke: DRAFT → send → sign → activate for the seeded quote version.
 * Reuses slice1 mutations (same logic as HTTP routes).
 *
 * Prereq: `npm run db:seed` (or set STRUXIENT_DEV_TENANT_ID / STRUXIENT_DEV_QUOTE_VERSION_ID).
 * Loads `.env` then `.env.local` (local wins). Writes STRUXIENT_DEV_FLOW_ID / STRUXIENT_DEV_JOB_ID /
 * STRUXIENT_DEV_USER_ID unless STRUXIENT_SEED_SKIP_DEV_ENV=1 (same opt-out as prisma/seed.js).
 *
 * Send idempotency key: STRUXIENT_DEV_SEND_CLIENT_REQUEST_ID or default `struxient-seed-activated-path`.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { sendQuoteVersionForTenant } from "../src/server/slice1/mutations/send-quote-version";
import { signQuoteVersionForTenant } from "../src/server/slice1/mutations/sign-quote-version";
import { activateQuoteVersionForTenant } from "../src/server/slice1/mutations/activate-quote-version";

const DEFAULT_SEND_KEY = "struxient-seed-activated-path";

function applyEnvFile(relativePath: string, overrideExisting: boolean) {
  const filePath = path.join(process.cwd(), relativePath);
  let text: string;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (overrideExisting || process.env[key] === undefined) {
      process.env[key] = v;
    }
  }
}

function upsertDevEnvLocal(vars: Record<string, string>) {
  if (process.env.STRUXIENT_SEED_SKIP_DEV_ENV === "1" || process.env.STRUXIENT_SEED_SKIP_DEV_ENV === "true") {
    console.log("[seed-activated-path] Skipping .env.local (STRUXIENT_SEED_SKIP_DEV_ENV set)");
    return;
  }

  const filePath = path.join(process.cwd(), ".env.local");
  let lines: string[] = [];
  try {
    lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  } catch {
    // file may not exist
  }

  const keys = new Set(Object.keys(vars));
  const kept = lines.filter((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return true;
    const eq = t.indexOf("=");
    if (eq <= 0) return true;
    const key = t.slice(0, eq).trim();
    return !keys.has(key);
  });
  while (kept.length && kept[kept.length - 1] === "") kept.pop();

  const banner = "# --- struxient: prisma/seed-activated-path.ts ---";
  const newLines = [
    ...kept,
    "",
    banner,
    ...Object.entries(vars).map(([k, v]) => `${k}=${JSON.stringify(v)}`),
    "",
  ];
  fs.writeFileSync(filePath, newLines.join("\n"), "utf8");
  console.log(
    `[seed-activated-path] Updated .env.local (${Object.keys(vars).join(", ")}) — restart \`npm run dev\` if running`,
  );
}

async function main() {
  applyEnvFile(".env", false);
  applyEnvFile(".env.local", true);

  const tenantId = process.env.STRUXIENT_DEV_TENANT_ID?.trim();
  const quoteVersionId = process.env.STRUXIENT_DEV_QUOTE_VERSION_ID?.trim();
  if (!tenantId || !quoteVersionId) {
    console.error(
      "Missing STRUXIENT_DEV_TENANT_ID or STRUXIENT_DEV_QUOTE_VERSION_ID. Run `npm run db:seed` first or set them in .env / .env.local.",
    );
    process.exit(1);
  }

  const sendKey =
    process.env.STRUXIENT_DEV_SEND_CLIENT_REQUEST_ID?.trim() || DEFAULT_SEND_KEY;

  const prisma = new PrismaClient();

  try {
    async function loadQvHeadline() {
      const row = await prisma.quoteVersion.findFirst({
        where: { id: quoteVersionId, quote: { tenantId } },
        select: { id: true, status: true, createdById: true },
      });
      return row;
    }

    const qvRow = await loadQvHeadline();
    if (!qvRow) {
      console.error("Quote version not found for tenant.");
      process.exit(1);
    }

    const existingAct = await prisma.activation.findUnique({
      where: { quoteVersionId },
      select: { flowId: true, jobId: true },
    });
    if (existingAct) {
      upsertDevEnvLocal({
        STRUXIENT_DEV_FLOW_ID: existingAct.flowId,
        STRUXIENT_DEV_JOB_ID: existingAct.jobId,
        STRUXIENT_DEV_USER_ID: qvRow.createdById,
      });
      console.log(
        `[seed-activated-path] Already activated: flow=${existingAct.flowId} job=${existingAct.jobId}`,
      );
      return;
    }

    let status = qvRow.status;

    if (status === "DRAFT") {
      const tokRow = await prisma.quoteVersion.findFirst({
        where: { id: quoteVersionId, quote: { tenantId } },
        select: { composePreviewStalenessToken: true },
      });
      const clientStalenessToken = tokRow?.composePreviewStalenessToken ?? null;

      const sendRes = await sendQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId,
        sentByUserId: qvRow.createdById,
        request: {
          clientStalenessToken,
          sendClientRequestId: sendKey,
        },
      });
      if (!sendRes.ok) {
        console.error("[seed-activated-path] send failed:", sendRes);
        process.exit(1);
      }
      console.log(
        `[seed-activated-path] send OK (idempotentReplay=${sendRes.data.idempotentReplay})`,
      );
    }

    const afterSend = await loadQvHeadline();
    if (!afterSend) {
      console.error("[seed-activated-path] Quote version disappeared after send.");
      process.exit(1);
    }
    status = afterSend.status;

    if (status === "SENT") {
      const signRes = await signQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId,
        recordedByUserId: afterSend.createdById,
      });
      if (!signRes.ok) {
        console.error("[seed-activated-path] sign failed:", signRes);
        process.exit(1);
      }
      console.log(
        `[seed-activated-path] sign OK job=${signRes.data.jobId} (idempotentReplay=${signRes.data.idempotentReplay})`,
      );
      if (signRes.data.activation) {
        console.log(
          `[seed-activated-path] auto-activate OK flow=${signRes.data.activation.flowId}`,
        );
      }
    }

    const afterSign = await prisma.activation.findUnique({
      where: { quoteVersionId },
      select: { flowId: true, jobId: true },
    });
    if (!afterSign) {
      const actRes = await activateQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId,
        activatedByUserId: afterSend.createdById,
      });
      if (!actRes.ok) {
        console.error("[seed-activated-path] activate failed:", actRes);
        process.exit(1);
      }
      console.log(
        `[seed-activated-path] activate OK flow=${actRes.data.flowId} job=${actRes.data.jobId} (idempotentReplay=${actRes.data.idempotentReplay})`,
      );
    }

    const finalAct = await prisma.activation.findUnique({
      where: { quoteVersionId },
      select: { flowId: true, jobId: true },
    });
    if (!finalAct) {
      console.error("[seed-activated-path] Internal error: activation row missing after pipeline.");
      process.exit(1);
    }

    upsertDevEnvLocal({
      STRUXIENT_DEV_FLOW_ID: finalAct.flowId,
      STRUXIENT_DEV_JOB_ID: finalAct.jobId,
      STRUXIENT_DEV_USER_ID: qvRow.createdById,
    });
    console.log(
      `[seed-activated-path] Done. flow=${finalAct.flowId} job=${finalAct.jobId} — open /dev/flow`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
