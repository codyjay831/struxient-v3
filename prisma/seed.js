/**
 * Smoke seed + invariant checks for Slice 1 schema.
 * Run: DATABASE_URL=... npx prisma db seed
 *
 * Writes STRUXIENT_* dev ids to .env.local (gitignored), and mirrors DATABASE_URL there by default
 * so `next dev` sees the same DB as Prisma CLI. Opt out: STRUXIENT_SEED_SKIP_DATABASE_URL_MIRROR=1
 * Skip all .env.local writes: STRUXIENT_SEED_SKIP_DEV_ENV=1 — restart `next dev` after seed.
 */
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * @param {Record<string, string>} vars
 */
function upsertDevEnvLocal(vars) {
  if (process.env.STRUXIENT_SEED_SKIP_DEV_ENV === "1" || process.env.STRUXIENT_SEED_SKIP_DEV_ENV === "true") {
    console.log("[struxient-dev] Skipping .env.local (STRUXIENT_SEED_SKIP_DEV_ENV set)");
    return;
  }

  const filePath = path.join(process.cwd(), ".env.local");
  let lines = [];
  try {
    lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  } catch {
    // file may not exist yet
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

  const banner = "# --- struxient: prisma/seed.js (safe to regenerate) ---";
  const newLines = [
    ...kept,
    "",
    banner,
    ...Object.entries(vars).map(([k, v]) => `${k}=${JSON.stringify(v)}`),
    "",
  ];
  fs.writeFileSync(filePath, newLines.join("\n"), "utf8");
  const writtenKeys = Object.keys(vars).join(", ");
  console.log("[struxient-dev] Updated .env.local (" + writtenKeys + ") — restart `npm run dev` if it is already running");
}

async function main() {
  const tenant = await prisma.tenant.create({
    data: { name: "SeedCo", autoActivateOnSign: false },
  });
  const devPassword = process.env.STRUXIENT_SEED_DEV_PASSWORD?.trim() || "struxient-dev";
  const passwordHash = await bcrypt.hash(devPassword, 10);
  const user = await prisma.user.create({
    data: { tenantId: tenant.id, email: "seed@example.com", passwordHash },
  });
  await prisma.user.create({
    data: { tenantId: tenant.id, email: "readonly@example.com", passwordHash, role: "READ_ONLY" },
  });
  await prisma.user.create({
    data: { tenantId: tenant.id, email: "field@example.com", passwordHash, role: "FIELD_WORKER" },
  });

  const tenantOther = await prisma.tenant.create({
    data: { name: "SmokeOtherTenant", autoActivateOnSign: false },
  });
  const customerOther = await prisma.customer.create({
    data: { tenantId: tenantOther.id, name: "OtherCo Customer" },
  });
  await prisma.flowGroup.create({
    data: { tenantId: tenantOther.id, customerId: customerOther.id, name: "Other FG" },
  });
  await prisma.user.create({
    data: { tenantId: tenantOther.id, email: "other@example.com", passwordHash },
  });

  const customer = await prisma.customer.create({
    data: { tenantId: tenant.id, name: "Acme Site" },
  });
  const flowGroup = await prisma.flowGroup.create({
    data: { tenantId: tenant.id, customerId: customer.id, name: "Site A" },
  });

  const scopePacket = await prisma.scopePacket.create({
    data: { tenantId: tenant.id, packetKey: "roof-v1", displayName: "Roof" },
  });
  const revision = await prisma.scopePacketRevision.create({
    data: {
      scopePacketId: scopePacket.id,
      revisionNumber: 1,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  await prisma.packetTaskLine.create({
    data: {
      scopePacketRevisionId: revision.id,
      lineKey: "t1",
      sortOrder: 0,
      lineKind: "EMBEDDED",
      targetNodeKey: "install",
      embeddedPayloadJson: {
        targetNodeKey: "install",
        title: "Catalog task",
        taskKind: "LABOR",
      },
    },
  });

  const wfTemplate = await prisma.workflowTemplate.create({
    data: { tenantId: tenant.id, templateKey: "standard", displayName: "Standard" },
  });
  const wfVersion = await prisma.workflowVersion.create({
    data: {
      workflowTemplateId: wfTemplate.id,
      versionNumber: 1,
      status: "PUBLISHED",
      publishedAt: new Date(),
      snapshotJson: {
        nodes: [{ id: "install", tasks: [{ id: "sk-site-prep", title: "Site prep (skeleton)" }] }],
      },
    },
  });

  const quote = await prisma.quote.create({
    data: {
      tenantId: tenant.id,
      customerId: customer.id,
      flowGroupId: flowGroup.id,
      quoteNumber: "Q-SEED-1",
    },
  });
  const qv = await prisma.quoteVersion.create({
    data: {
      quoteId: quote.id,
      versionNumber: 1,
      status: "DRAFT",
      createdById: user.id,
      pinnedWorkflowVersionId: wfVersion.id,
    },
  });
  const proposalGroup = await prisma.proposalGroup.create({
    data: { quoteVersionId: qv.id, name: "Main", sortOrder: 0 },
  });

  await prisma.quoteLineItem.create({
    data: {
      quoteVersionId: qv.id,
      proposalGroupId: proposalGroup.id,
      sortOrder: 1,
      scopePacketRevisionId: revision.id,
      quantity: 1,
      executionMode: "MANIFEST",
      title: "Catalog-manifest line",
    },
  });

  const localPacket = await prisma.quoteLocalPacket.create({
    data: {
      tenantId: tenant.id,
      quoteVersionId: qv.id,
      displayName: "Local scope",
      originType: "MANUAL_LOCAL",
      createdById: user.id,
    },
  });
  await prisma.quoteLocalPacketItem.create({
    data: {
      quoteLocalPacketId: localPacket.id,
      lineKey: "x1",
      sortOrder: 0,
      lineKind: "EMBEDDED",
      targetNodeKey: "install",
    },
  });
  await prisma.quoteLineItem.create({
    data: {
      quoteVersionId: qv.id,
      proposalGroupId: proposalGroup.id,
      sortOrder: 2,
      quoteLocalPacketId: localPacket.id,
      quantity: 1,
      executionMode: "MANIFEST",
      title: "Local-manifest line",
    },
  });

  await prisma.preJobTask.create({
    data: {
      tenantId: tenant.id,
      flowGroupId: flowGroup.id,
      quoteVersionId: qv.id,
      taskType: "SITE_SURVEY",
      sourceType: "MANUAL",
      title: "Survey lot",
      createdById: user.id,
      status: "OPEN",
    },
  });

  await prisma.quoteLineItem.create({
    data: {
      quoteVersionId: qv.id,
      proposalGroupId: proposalGroup.id,
      sortOrder: 10,
      quantity: 2,
      executionMode: "SOLD_SCOPE",
      title: "Allowance line (no packet pin)",
    },
  });

  let caught = false;
  try {
    await prisma.quoteLineItem.create({
      data: {
        quoteVersionId: qv.id,
        proposalGroupId: proposalGroup.id,
        sortOrder: 3,
        quantity: 1,
        executionMode: "MANIFEST",
        title: "invalid — no pin",
      },
    });
  } catch {
    caught = true;
  }
  if (!caught) {
    throw new Error("Expected DB to reject MANIFEST line with no scope pin");
  }

  caught = false;
  try {
    await prisma.quoteLineItem.create({
      data: {
        quoteVersionId: qv.id,
        proposalGroupId: proposalGroup.id,
        sortOrder: 4,
        scopePacketRevisionId: revision.id,
        quoteLocalPacketId: localPacket.id,
        quantity: 1,
        executionMode: "MANIFEST",
        title: "invalid — dual pin",
      },
    });
  } catch {
    caught = true;
  }
  if (!caught) {
    throw new Error("Expected DB to reject MANIFEST line with dual scope pins");
  }

  caught = false;
  try {
    await prisma.quoteLineItem.create({
      data: {
        quoteVersionId: qv.id,
        proposalGroupId: proposalGroup.id,
        sortOrder: 5,
        quantity: 0,
        executionMode: "SOLD_SCOPE",
        title: "invalid qty",
      },
    });
  } catch {
    caught = true;
  }
  if (!caught) {
    throw new Error("Expected DB to reject quantity <= 0");
  }

  const devEnvVars = {
    STRUXIENT_DEV_TENANT_ID: tenant.id,
    STRUXIENT_DEV_QUOTE_VERSION_ID: qv.id,
    STRUXIENT_DEV_USER_ID: user.id,
  };
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (
    dbUrl &&
    process.env.STRUXIENT_SEED_SKIP_DATABASE_URL_MIRROR !== "1" &&
    process.env.STRUXIENT_SEED_SKIP_DATABASE_URL_MIRROR !== "true"
  ) {
    devEnvVars.DATABASE_URL = dbUrl;
  }
  upsertDevEnvLocal(devEnvVars);

  function writeIntegrationFixture() {
    const dir = path.join(process.cwd(), "scripts", "integration");
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, "fixture.json");
    const payload = {
      basePassword: devPassword,
      tenantAId: tenant.id,
      tenantBId: tenantOther.id,
      quoteVersionId: qv.id,
      proposalGroupId: proposalGroup.id,
      /** Tenant A: PUBLISHED workflow version id (for integration pin + send/activate chain). */
      seedPublishedWorkflowVersionId: wfVersion.id,
      /** Tenant A: PUBLISHED catalog scope revision id (for POST …/line-items MANIFEST in integration smoke). */
      seedPublishedScopePacketRevisionId: revision.id,
      emails: {
        office: "seed@example.com",
        readOnly: "readonly@example.com",
        field: "field@example.com",
        tenantBOffice: "other@example.com",
      },
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    console.log("[struxient-dev] Wrote scripts/integration/fixture.json (for npm run test:integration)");
  }
  writeIntegrationFixture();

  console.log("Seed OK: manifest pins (catalog + local), PreJobTask, SOLD_SCOPE without pin, XOR + quantity checks passed");
  console.log("[struxient-dev] STRUXIENT_DEV_TENANT_ID=" + tenant.id);
  console.log("[struxient-dev] STRUXIENT_DEV_QUOTE_VERSION_ID=" + qv.id);
  console.log("[struxient-dev] STRUXIENT_DEV_USER_ID=" + user.id);
  console.log("[struxient-dev] Visit /dev/quote-scope (redirects) or GET /api/quote-versions/" + qv.id + "/scope");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
