/**
 * Demo seed — Execution Canon v5 visual verification scenarios.
 *
 * Run: npm run db:seed:demo
 *
 * Tenant `demo-co` is wiped (data only; tenant + users preserved) and rebuilt
 * with **3 trade contexts** mapped 1:1 to the 5 canon situations:
 *
 *   1. Maple Family Residence       — Solar + 200 A panel  → HAPPY PATH + PAYMENT GATE
 *   2. Riverside Apartments Bldg 3  — Commercial PV         → COMPLETED PENDING REVIEW
 *   3. Hilltop Residence            — Reroof + chimney CO   → CHANGE ORDER / SUPERSEDED
 *   4. Oakwood Office Complex       — Commercial roof rep.  → BLOCKED BY OPERATIONAL HOLD
 *   5. Sunset Plaza Tenant Spaces   — EV chargers + panel   → PRE-JOB ONLY / NO ACTIVATION
 *
 * Everything goes through the real send → sign → activate pipeline (auto-activate
 * on sign), with optional post-activation extensions (operational hold, change
 * order apply, runtime start/complete) via slice1 mutations. RuntimeTasks come
 * from the frozen `executionPackageSnapshot` — never hand-built.
 *
 * Loads `.env` then `.env.local` (local wins) so `DATABASE_URL` matches `next dev`.
 */
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

import { sendQuoteVersionForTenant } from "../src/server/slice1/mutations/send-quote-version";
import { signQuoteVersionForTenant } from "../src/server/slice1/mutations/sign-quote-version";
import { createOperationalHoldForJob } from "../src/server/slice1/mutations/hold-mutations";
import { createChangeOrderForJob } from "../src/server/slice1/mutations/create-change-order";
import { applyChangeOrderForJob } from "../src/server/slice1/mutations/apply-change-order";
import { createQuoteLineItemForTenant } from "../src/server/slice1/mutations/quote-line-item-mutations";
import {
  startRuntimeTaskForTenant,
  completeRuntimeTaskForTenant,
} from "../src/server/slice1/mutations/runtime-task-execution";

const TENANT_ID = "demo-co";
const TENANT_NAME = "Demo Co";
const OFFICE_USER_ID = "demo-user-office";
const FIELD_USER_ID = "demo-user-field";
const OFFICE_USER_EMAIL = "office@demo.test";
const FIELD_USER_EMAIL = "field@demo.test";

function applyEnvFile(relativePath: string, overrideExisting: boolean): void {
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

// ─────────────────────────────────────────────────────────────────────────────
// Wipe + tenant/users
// ─────────────────────────────────────────────────────────────────────────────

async function wipeDemoTenant(prisma: PrismaClient): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID }, select: { id: true } });
  if (!tenant) return;

  await prisma.completionProofAttachment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.completionProof.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.taskExecution.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.hold.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.paymentGateTarget.deleteMany({
    where: { paymentGate: { tenantId: TENANT_ID } },
  });
  await prisma.paymentGate.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.runtimeTask.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.activation.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.changeOrder.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.flow.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.jobHandoff.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.preJobTask.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.quoteSignature.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.auditEvent.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.quoteLocalPacketItem.deleteMany({
    where: { quoteLocalPacket: { tenantId: TENANT_ID } },
  });
  await prisma.quoteLocalPacket.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.quoteVersion.deleteMany({ where: { quote: { tenantId: TENANT_ID } } });
  await prisma.job.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.quote.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.flowGroup.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.customerNote.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.customerDocument.deleteMany({ where: { tenantId: TENANT_ID } });
  // CustomerContactMethod cascades from CustomerContact (Cascade onDelete).
  await prisma.customerContact.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.customer.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.lead.deleteMany({ where: { tenantId: TENANT_ID } });
  // LineItemPreset has `onDelete: SetNull` on its packet FK, but wipe presets
  // before scope packets so we never observe an intermediate "preset with
  // nulled packet id" state during a re-seed.
  await prisma.lineItemPreset.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.packetTaskLine.deleteMany({
    where: { scopePacketRevision: { scopePacket: { tenantId: TENANT_ID } } },
  });
  await prisma.scopePacketRevision.deleteMany({
    where: { scopePacket: { tenantId: TENANT_ID } },
  });
  await prisma.scopePacket.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.workflowVersion.deleteMany({
    where: { workflowTemplate: { tenantId: TENANT_ID } },
  });
  await prisma.workflowTemplate.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.taskDefinition.deleteMany({ where: { tenantId: TENANT_ID } });
}

async function ensureDemoTenantAndUsers(prisma: PrismaClient): Promise<void> {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    create: { id: TENANT_ID, name: TENANT_NAME, autoActivateOnSign: true },
    update: { name: TENANT_NAME, autoActivateOnSign: true },
  });

  const devPassword = process.env.STRUXIENT_DEMO_PASSWORD?.trim() || "struxient-demo";
  const passwordHash = await bcrypt.hash(devPassword, 10);

  await prisma.user.upsert({
    where: { id: OFFICE_USER_ID },
    create: {
      id: OFFICE_USER_ID,
      tenantId: TENANT_ID,
      email: OFFICE_USER_EMAIL,
      displayName: "Demo Office",
      role: "OFFICE_ADMIN",
      passwordHash,
    },
    update: {
      tenantId: TENANT_ID,
      email: OFFICE_USER_EMAIL,
      displayName: "Demo Office",
      role: "OFFICE_ADMIN",
      passwordHash,
    },
  });
  await prisma.user.upsert({
    where: { id: FIELD_USER_ID },
    create: {
      id: FIELD_USER_ID,
      tenantId: TENANT_ID,
      email: FIELD_USER_EMAIL,
      displayName: "Demo Field",
      role: "FIELD_WORKER",
      passwordHash,
    },
    update: {
      tenantId: TENANT_ID,
      email: FIELD_USER_EMAIL,
      displayName: "Demo Field",
      role: "FIELD_WORKER",
      passwordHash,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskDefinitions — authored instructions + completion contracts
// ─────────────────────────────────────────────────────────────────────────────

type TaskDefId =
  | "td-site-verify"
  | "td-pv-mount"
  | "td-pv-modules"
  | "td-pv-commission"
  | "td-panel-swap"
  | "td-tear-off"
  | "td-deck-prep"
  | "td-shingle-install"
  | "td-flash-chimney"
  | "td-ev-charger-install";

type TaskDefSpec = {
  taskKey: TaskDefId;
  displayName: string;
  instructions: string;
  completionRequirementsJson: unknown[];
  conditionalRulesJson?: unknown[];
};

const TASK_DEF_SPECS: TaskDefSpec[] = [
  {
    taskKey: "td-site-verify",
    displayName: "Pre-installation site verification",
    instructions:
      "Confirm structural fitness for the new load. Check existing service capacity. Photograph each elevation and the existing service panel.",
    completionRequirementsJson: [
      { kind: "checklist", label: "Roof / structure visually sound", required: true },
      { kind: "checklist", label: "Service panel rated for additional load", required: true },
      { kind: "checklist", label: "No obvious safety hazards on site", required: true },
      { kind: "attachment", required: true },
    ],
  },
  {
    taskKey: "td-pv-mount",
    displayName: "PV module mounting",
    instructions:
      "Install the rail system per stamped drawings. Torque all lag bolts to 30 ft-lb. Photograph flashing at every penetration before running modules.",
    completionRequirementsJson: [
      { kind: "checklist", label: "Rails installed per layout", required: true },
      { kind: "checklist", label: "Lag bolt torque verified", required: true },
      { kind: "checklist", label: "Roof penetrations sealed and flashed", required: true },
      { kind: "measurement", label: "Rails installed (count)", unit: "ea", required: false },
      { kind: "attachment", required: true },
    ],
  },
  {
    taskKey: "td-pv-modules",
    displayName: "Module install + stringing",
    instructions:
      "Install all PV modules per the stringing plan. Verify polarity at each string before connecting. Record the open-circuit voltage (Voc) for every string.",
    completionRequirementsJson: [
      { kind: "checklist", label: "All modules installed", required: true },
      { kind: "checklist", label: "Polarity verified at each string", required: true },
      { kind: "measurement", label: "String 1 Voc", unit: "V", required: true },
      { kind: "measurement", label: "String 2 Voc", unit: "V", required: false },
    ],
  },
  {
    taskKey: "td-pv-commission",
    displayName: "System commissioning",
    instructions:
      "Energize the system. Capture AC output at the inverter. Verify the monitoring portal is reporting telemetry. Mark PASS only when all readings are within spec.",
    completionRequirementsJson: [
      { kind: "checklist", label: "System energized", required: true },
      { kind: "checklist", label: "Monitoring portal online", required: true },
      { kind: "result", required: true },
      { kind: "attachment", required: true },
    ],
  },
  {
    taskKey: "td-panel-swap",
    displayName: "Service panel swap (200 A)",
    instructions:
      "Pull the existing panel. Install new 200 A panel and main breaker. Re-land every circuit, tag and label inside the new dead-front. Verify no double-taps.",
    completionRequirementsJson: [
      { kind: "checklist", label: "Old panel removed", required: true },
      { kind: "checklist", label: "New 200 A panel installed", required: true },
      { kind: "checklist", label: "All circuits labeled", required: true },
      { kind: "attachment", required: true },
    ],
  },
  {
    taskKey: "td-tear-off",
    displayName: "Tear off existing roof",
    instructions:
      "Remove all existing shingles down to deck. Inspect deck for rot, soft spots, or damaged sheathing. Note any issues found before deck prep begins.",
    completionRequirementsJson: [
      { kind: "checklist", label: "All shingles + underlayment removed", required: true },
      { kind: "checklist", label: "Deck inspected for damage", required: true },
      { kind: "note", required: false },
      { kind: "attachment", required: true },
    ],
    conditionalRulesJson: [
      {
        trigger: { kind: "checklist", label: "Deck inspected for damage", value: "no" },
        require: {
          kind: "note",
          message: "If the deck inspection failed, document the damage in a note before continuing.",
        },
      },
    ],
  },
  {
    taskKey: "td-deck-prep",
    displayName: "Deck repair + underlayment",
    instructions:
      "Replace any damaged decking flagged in the tear-off pass. Install ice & water shield at all eaves and valleys. Roll synthetic underlayment.",
    completionRequirementsJson: [
      { kind: "checklist", label: "Damaged decking replaced", required: true },
      { kind: "checklist", label: "Ice & water shield installed at eaves", required: true },
      { kind: "checklist", label: "Synthetic underlayment installed", required: true },
    ],
  },
  {
    taskKey: "td-shingle-install",
    displayName: "Shingle install (GAF Timberline HDZ)",
    instructions:
      "Install starter strip, field shingles, and ridge cap per GAF specification. Hand-seal in any wind-prone areas. Verify nail pattern.",
    completionRequirementsJson: [
      { kind: "checklist", label: "Starter strip installed", required: true },
      { kind: "checklist", label: "Field shingles installed", required: true },
      { kind: "checklist", label: "Ridge cap installed", required: true },
      { kind: "result", required: true },
    ],
  },
  {
    taskKey: "td-flash-chimney",
    displayName: "Chimney flashing repair",
    instructions:
      "Remove existing damaged flashing. Install new step flashing and counter-flashing. Seal all terminations with high-grade roofing sealant.",
    completionRequirementsJson: [
      { kind: "checklist", label: "Old flashing removed", required: true },
      { kind: "checklist", label: "New step + counter-flashing installed", required: true },
      { kind: "checklist", label: "All terminations sealed", required: true },
      { kind: "attachment", required: true },
    ],
  },
  {
    taskKey: "td-ev-charger-install",
    displayName: "Level 2 EV charger install + commission",
    instructions:
      "Mount the unit at the agreed location. Pull the dedicated circuit from the sub-panel. Energize and run a test charging session for at least 5 minutes.",
    completionRequirementsJson: [
      { kind: "checklist", label: "Unit mounted", required: true },
      { kind: "checklist", label: "Dedicated circuit landed", required: true },
      { kind: "checklist", label: "Test charging session passed", required: true },
      { kind: "result", required: true },
      { kind: "attachment", required: true },
    ],
  },
];

async function createTaskDefinitions(prisma: PrismaClient): Promise<Map<TaskDefId, string>> {
  const out = new Map<TaskDefId, string>();
  for (const spec of TASK_DEF_SPECS) {
    const row = await prisma.taskDefinition.create({
      data: {
        tenantId: TENANT_ID,
        taskKey: spec.taskKey,
        displayName: spec.displayName,
        status: "PUBLISHED",
        instructions: spec.instructions,
        completionRequirementsJson: spec.completionRequirementsJson as never,
        conditionalRulesJson: (spec.conditionalRulesJson ?? null) as never,
      },
      select: { id: true },
    });
    out.set(spec.taskKey, row.id);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow templates — one per trade
// ─────────────────────────────────────────────────────────────────────────────

type WorkflowKey = "solar" | "roofing" | "ev";

type WorkflowSpec = {
  templateKey: string;
  displayName: string;
  nodeIds: string[];
};

const WORKFLOW_SPECS: Record<WorkflowKey, WorkflowSpec> = {
  solar: {
    templateKey: "demo-solar-pv",
    displayName: "Solar PV + Service Upgrade",
    nodeIds: [
      "pre-work",
      "permitting",
      "install",
      "final-inspection",
    ],
  },
  roofing: {
    templateKey: "demo-roofing",
    displayName: "Roofing Project",
    nodeIds: [
      "pre-work",
      "permitting",
      "install",
      "closeout",
    ],
  },
  ev: {
    templateKey: "demo-ev-panel",
    displayName: "EV / Panel Upgrade",
    nodeIds: [
      "pre-work",
      "permitting",
      "install",
      "final-inspection",
    ],
  },
};

async function createWorkflowTemplates(
  prisma: PrismaClient,
): Promise<Record<WorkflowKey, string>> {
  const out = {} as Record<WorkflowKey, string>;
  for (const [k, spec] of Object.entries(WORKFLOW_SPECS) as [WorkflowKey, WorkflowSpec][]) {
    const tpl = await prisma.workflowTemplate.create({
      data: {
        tenantId: TENANT_ID,
        templateKey: spec.templateKey,
        displayName: spec.displayName,
      },
    });
    const ver = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: tpl.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: {
          nodes: spec.nodeIds.map((id) => ({ id, type: "TASK" })),
        },
      },
      select: { id: true },
    });
    out[k] = ver.id;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog packets — published, with PacketTaskLines bound to TaskDefinitions
// ─────────────────────────────────────────────────────────────────────────────

type PacketKey =
  | "pkt-solar-8kw"
  | "pkt-panel-200a"
  | "pkt-reroof-30sq"
  | "pkt-chimney-flash"
  | "pkt-roof-builtup-repair"
  | "pkt-ev-charger-install"
  // Slice E catalog expansion — HVAC, Gutters, General/permit, maintenance.
  | "pkt-hvac-condenser-3t"
  | "pkt-gutter-replacement"
  | "pkt-permit-residential"
  | "pkt-roof-annual-inspection";

type PacketLineSpec = {
  /** Use a numeric prefix so lex(lineKey) matches sort/pipeline order. */
  lineKey: string;
  sortOrder: number;
  targetNodeKey: string;
  taskKind: string;
  /** Embedded title (always carried); compose engine prefers TaskDefinition fields when present. */
  embeddedTitle: string;
  taskDefinitionKey?: TaskDefId;
};

type PacketSpec = {
  packetKey: PacketKey;
  displayName: string;
  lines: PacketLineSpec[];
};

const PACKET_SPECS: PacketSpec[] = [
  {
    packetKey: "pkt-solar-8kw",
    displayName: "Solar Install Standard 8.4 kW",
    lines: [
      {
        lineKey: "pl-01-survey",
        sortOrder: 0,
        targetNodeKey: "pre-work",
        taskKind: "INSPECTION",
        embeddedTitle: "Pre-install site verification",
        taskDefinitionKey: "td-site-verify",
      },
      {
        lineKey: "pl-02-mount",
        sortOrder: 1,
        targetNodeKey: "install",
        taskKind: "INSTALL",
        embeddedTitle: "PV module mounting",
        taskDefinitionKey: "td-pv-mount",
      },
      {
        lineKey: "pl-03-modules",
        sortOrder: 2,
        targetNodeKey: "install",
        taskKind: "INSTALL",
        embeddedTitle: "Module install + stringing",
        taskDefinitionKey: "td-pv-modules",
      },
      {
        lineKey: "pl-04-commission",
        sortOrder: 3,
        targetNodeKey: "final-inspection",
        taskKind: "COMMISSION",
        embeddedTitle: "System commissioning",
        taskDefinitionKey: "td-pv-commission",
      },
    ],
  },
  {
    packetKey: "pkt-panel-200a",
    displayName: "Service Panel Upgrade — 200 A",
    lines: [
      {
        lineKey: "pl-01-panel-swap",
        sortOrder: 0,
        targetNodeKey: "install",
        taskKind: "INSTALL",
        embeddedTitle: "Service panel swap (200 A)",
        taskDefinitionKey: "td-panel-swap",
      },
    ],
  },
  {
    packetKey: "pkt-reroof-30sq",
    displayName: "Standard Tear-Off + Reroof — 30 sq, GAF Timberline HDZ",
    lines: [
      {
        lineKey: "pl-01-tear-off",
        sortOrder: 0,
        targetNodeKey: "install",
        taskKind: "DEMO",
        embeddedTitle: "Tear off existing roof",
        taskDefinitionKey: "td-tear-off",
      },
      {
        lineKey: "pl-02-deck",
        sortOrder: 1,
        targetNodeKey: "install",
        taskKind: "PREP",
        embeddedTitle: "Deck repair + underlayment",
        taskDefinitionKey: "td-deck-prep",
      },
      {
        lineKey: "pl-03-install",
        sortOrder: 2,
        targetNodeKey: "install",
        taskKind: "INSTALL",
        embeddedTitle: "Shingle install (GAF Timberline HDZ)",
        taskDefinitionKey: "td-shingle-install",
      },
      {
        lineKey: "pl-04-cleanup",
        sortOrder: 3,
        targetNodeKey: "closeout",
        taskKind: "CLEANUP",
        embeddedTitle: "Magnetic sweep + haul-off",
      },
    ],
  },
  {
    packetKey: "pkt-chimney-flash",
    displayName: "Chimney Flashing Repair",
    lines: [
      {
        lineKey: "pl-01-flash",
        sortOrder: 0,
        targetNodeKey: "install",
        taskKind: "INSTALL",
        embeddedTitle: "Chimney flashing repair",
        taskDefinitionKey: "td-flash-chimney",
      },
    ],
  },
  {
    packetKey: "pkt-roof-builtup-repair",
    displayName: "Commercial Built-Up Roof Repair (BUR patch)",
    lines: [
      {
        lineKey: "pl-01-survey",
        sortOrder: 0,
        targetNodeKey: "pre-work",
        taskKind: "INSPECTION",
        embeddedTitle: "Pre-repair site verification",
        taskDefinitionKey: "td-site-verify",
      },
      {
        lineKey: "pl-02-cut-patch",
        sortOrder: 1,
        targetNodeKey: "install",
        taskKind: "REPAIR",
        embeddedTitle: "Cut + patch BUR membrane",
      },
      {
        lineKey: "pl-03-seal-test",
        sortOrder: 2,
        targetNodeKey: "closeout",
        taskKind: "VERIFY",
        embeddedTitle: "Water-test repaired area",
      },
    ],
  },
  {
    packetKey: "pkt-ev-charger-install",
    displayName: "Level 2 EV Charger Install (per unit)",
    lines: [
      {
        lineKey: "pl-01-charger",
        sortOrder: 0,
        targetNodeKey: "install",
        taskKind: "INSTALL",
        embeddedTitle: "Level 2 EV charger install + commission",
        taskDefinitionKey: "td-ev-charger-install",
      },
    ],
  },
  // ── Slice E: catalog expansion ────────────────────────────────────────────
  // Embedded-only PacketTaskLines (no TaskDefinition link) — these packets
  // exist so the demo catalog covers HVAC, Gutters, General/permit, and a
  // maintenance inspection. They use node keys already present on the seeded
  // workflow templates so the editor doesn't surface stage-not-on-snapshot
  // warnings when paired with the existing roofing / solar / ev workflows.
  {
    packetKey: "pkt-hvac-condenser-3t",
    displayName: "HVAC Condenser Changeout — 3 Ton (R-410A)",
    lines: [
      {
        lineKey: "pl-01-prep",
        sortOrder: 0,
        targetNodeKey: "pre-work",
        taskKind: "INSPECTION",
        embeddedTitle: "Pre-job equipment + clearance check",
      },
      {
        lineKey: "pl-02-recover",
        sortOrder: 1,
        targetNodeKey: "install",
        taskKind: "DEMO",
        embeddedTitle: "Recover refrigerant + remove existing condenser",
      },
      {
        lineKey: "pl-03-set-new",
        sortOrder: 2,
        targetNodeKey: "install",
        taskKind: "INSTALL",
        embeddedTitle: "Set new 3-ton condenser + line set + electrical reconnect",
      },
      {
        lineKey: "pl-04-commission",
        sortOrder: 3,
        targetNodeKey: "closeout",
        taskKind: "COMMISSION",
        embeddedTitle: "Pressure test + system commissioning + customer walk-through",
      },
    ],
  },
  {
    packetKey: "pkt-gutter-replacement",
    displayName: "Gutter Replacement — 5\" K-Style Aluminum (per linear foot)",
    lines: [
      {
        lineKey: "pl-01-tear-off",
        sortOrder: 0,
        targetNodeKey: "install",
        taskKind: "DEMO",
        embeddedTitle: "Tear off existing gutters + downspouts",
      },
      {
        lineKey: "pl-02-install",
        sortOrder: 1,
        targetNodeKey: "install",
        taskKind: "INSTALL",
        embeddedTitle: "Install new K-style gutters, hangers, and downspouts",
      },
      {
        lineKey: "pl-03-cleanup",
        sortOrder: 2,
        targetNodeKey: "closeout",
        taskKind: "CLEANUP",
        embeddedTitle: "Site cleanup + magnet sweep + haul-off",
      },
    ],
  },
  {
    packetKey: "pkt-permit-residential",
    displayName: "Residential Building Permit — Standard Pull",
    lines: [
      {
        lineKey: "pl-01-submit",
        sortOrder: 0,
        targetNodeKey: "permitting",
        taskKind: "ADMIN",
        embeddedTitle: "Submit permit application to local AHJ",
      },
      {
        lineKey: "pl-02-track",
        sortOrder: 1,
        targetNodeKey: "permitting",
        taskKind: "ADMIN",
        embeddedTitle: "Track permit status + post issued permit on-site",
      },
    ],
  },
  {
    packetKey: "pkt-roof-annual-inspection",
    displayName: "Annual Roof Inspection (5-Year Maintenance Plan)",
    lines: [
      {
        lineKey: "pl-01-inspect",
        sortOrder: 0,
        targetNodeKey: "pre-work",
        taskKind: "INSPECTION",
        embeddedTitle: "Annual roof inspection + photo report + customer summary",
      },
    ],
  },
];

async function createCatalogPackets(
  prisma: PrismaClient,
  taskDefIds: Map<TaskDefId, string>,
): Promise<Map<PacketKey, string>> {
  const revIds = new Map<PacketKey, string>();
  for (const spec of PACKET_SPECS) {
    const packet = await prisma.scopePacket.create({
      data: {
        tenantId: TENANT_ID,
        packetKey: spec.packetKey,
        displayName: spec.displayName,
      },
    });
    const revision = await prisma.scopePacketRevision.create({
      data: {
        scopePacketId: packet.id,
        revisionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    for (const line of spec.lines) {
      await prisma.packetTaskLine.create({
        data: {
          scopePacketRevisionId: revision.id,
          lineKey: line.lineKey,
          sortOrder: line.sortOrder,
          lineKind: "EMBEDDED",
          targetNodeKey: line.targetNodeKey,
          embeddedPayloadJson: {
            targetNodeKey: line.targetNodeKey,
            title: line.embeddedTitle,
            taskKind: line.taskKind,
          },
          taskDefinitionId: line.taskDefinitionKey ? taskDefIds.get(line.taskDefinitionKey) : null,
        },
      });
    }
    revIds.set(spec.packetKey, revision.id);
  }
  return revIds;
}

// ─────────────────────────────────────────────────────────────────────────────
// LineItemPresets — saved-line catalog (Slice E)
//
// Presets are commercial defaults only. They never participate in execution
// (no compose, no activation, no RuntimeTask side-effects). The mutation
// surface enforces:
//   - MANIFEST  → defaultScopePacketId required
//   - SOLD_SCOPE → defaultScopePacketId must be null
//
// We seed via direct `prisma.lineItemPreset.create` (matching the existing
// catalog-packet style); the `wipeDemoTenant` step deletes presets first so
// re-seeding is safe even if any field changes.
// ─────────────────────────────────────────────────────────────────────────────

type PresetSpec = {
  presetKey: string;
  displayName: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultQuantity: number;
  defaultUnitPriceCents: number;
  defaultExecutionMode: "MANIFEST" | "SOLD_SCOPE";
  /** Required for MANIFEST presets; must be null for SOLD_SCOPE. */
  packetKey: PacketKey | null;
  defaultPaymentBeforeWork?: boolean;
  defaultPaymentGateTitleOverride?: string;
};

const PRESET_SPECS: PresetSpec[] = [
  // ── Solar ────────────────────────────────────────────────────────────────
  {
    presetKey: "solar-8kw-standard",
    displayName: "Standard 8.4 kW Solar Install",
    defaultTitle: "8.4 kW residential solar PV — 24 modules + string inverter",
    defaultDescription:
      "Turn-key residential PV system: 24 × 350 W modules, string inverter, monitoring, rail mounting on composite shingle. Includes site verification, install, commissioning, and customer walk-through. Permit and utility interconnection billed separately.",
    defaultQuantity: 1,
    defaultUnitPriceCents: 24_500_00,
    defaultExecutionMode: "MANIFEST",
    packetKey: "pkt-solar-8kw",
  },
  // ── Electrical ───────────────────────────────────────────────────────────
  {
    presetKey: "service-panel-200a",
    displayName: "Service Panel Upgrade — 200 A",
    defaultTitle: "200 A residential service panel upgrade",
    defaultDescription:
      "Replace existing service panel with new 200 A main + breakers. Re-land and label all circuits. Includes meter coordination with utility. Does not include trenching or service entrance cable replacement.",
    defaultQuantity: 1,
    defaultUnitPriceCents: 3_200_00,
    defaultExecutionMode: "MANIFEST",
    packetKey: "pkt-panel-200a",
  },
  {
    presetKey: "ev-charger-l2-install",
    displayName: "Level 2 EV Charger Install (per unit)",
    defaultTitle: "Level 2 EV charger install — 240 V dedicated circuit",
    defaultDescription:
      "Install one customer-supplied Level 2 EV charger on a new dedicated 240 V circuit from the existing sub-panel (≤ 30 ft run). Mount, energize, and verify a successful test charging session.",
    defaultQuantity: 1,
    defaultUnitPriceCents: 1_450_00,
    defaultExecutionMode: "MANIFEST",
    packetKey: "pkt-ev-charger-install",
  },
  // ── Roofing ──────────────────────────────────────────────────────────────
  {
    presetKey: "reroof-30sq-architectural",
    displayName: "Reroof — 30 sq, GAF Timberline HDZ",
    defaultTitle: "Tear-off + reroof, 30 squares, GAF Timberline HDZ architectural shingles",
    defaultDescription:
      "Full tear-off down to deck, deck repair as needed, ice & water shield at eaves and valleys, synthetic underlayment, GAF Timberline HDZ shingles, ridge cap, and final cleanup with magnetic sweep. 50% deposit due before crew mobilizes.",
    defaultQuantity: 1,
    defaultUnitPriceCents: 14_900_00,
    defaultExecutionMode: "MANIFEST",
    packetKey: "pkt-reroof-30sq",
    defaultPaymentBeforeWork: true,
    defaultPaymentGateTitleOverride: "Reroof deposit (50%)",
  },
  {
    presetKey: "chimney-flashing-repair",
    displayName: "Chimney Flashing Repair",
    defaultTitle: "Remove and replace chimney step + counter-flashing",
    defaultDescription:
      "Remove damaged chimney flashing. Install new step flashing tucked under shingles and new counter-flashing cut into masonry. Seal all terminations with high-grade roofing sealant. Photo documentation provided.",
    defaultQuantity: 1,
    defaultUnitPriceCents: 850_00,
    defaultExecutionMode: "MANIFEST",
    packetKey: "pkt-chimney-flash",
  },
  {
    presetKey: "commercial-bur-roof-patch",
    displayName: "Commercial BUR Roof Patch",
    defaultTitle: "Built-up roof patch repair (per location)",
    defaultDescription:
      "Inspection + targeted cut-and-patch repair of damaged built-up roofing membrane. Includes water-test verification of repaired area. Priced per discrete patch location up to 4 ft × 4 ft.",
    defaultQuantity: 1,
    defaultUnitPriceCents: 2_400_00,
    defaultExecutionMode: "MANIFEST",
    packetKey: "pkt-roof-builtup-repair",
  },
  // ── HVAC ─────────────────────────────────────────────────────────────────
  {
    presetKey: "hvac-condenser-changeout-3t",
    displayName: "3-Ton AC Condenser Changeout",
    defaultTitle: "3-ton residential A/C condenser changeout — R-410A",
    defaultDescription:
      "Recover existing refrigerant, remove failed condenser, set new 3-ton 14 SEER2 condenser on existing pad, reconnect line set and electrical, pressure test, evacuate, charge, and commission. Excludes line set replacement and electrical work beyond reconnect.",
    defaultQuantity: 1,
    defaultUnitPriceCents: 4_800_00,
    defaultExecutionMode: "MANIFEST",
    packetKey: "pkt-hvac-condenser-3t",
  },
  // ── Gutters ──────────────────────────────────────────────────────────────
  {
    presetKey: "gutter-replacement-5in",
    displayName: "5\" K-Style Gutter Replacement (per linear foot)",
    defaultTitle: "5\" K-style aluminum gutter replacement, including downspouts",
    defaultDescription:
      "Tear off existing gutters and downspouts, install new 5\" K-style seamless aluminum gutters with hidden hangers and matching downspouts, splash blocks at grade. Site cleanup with magnet sweep included. Quantity is linear feet; defaults to a typical single-story residence.",
    defaultQuantity: 100,
    defaultUnitPriceCents: 8_50,
    defaultExecutionMode: "MANIFEST",
    packetKey: "pkt-gutter-replacement",
  },
  // ── General / permit / maintenance ───────────────────────────────────────
  {
    presetKey: "permit-residential-standard",
    displayName: "Standard Residential Permit Pull",
    defaultTitle: "Pull standard residential building permit (office-managed)",
    defaultDescription:
      "Office prepares and submits the permit application package to the local AHJ, tracks status, and posts the issued permit on-site before crew mobilization. Permit fees billed separately as a pass-through.",
    defaultQuantity: 1,
    defaultUnitPriceCents: 475_00,
    defaultExecutionMode: "MANIFEST",
    packetKey: "pkt-permit-residential",
    defaultPaymentBeforeWork: true,
    defaultPaymentGateTitleOverride: "Permit pull fee",
  },
  {
    presetKey: "annual-roof-inspection-y1",
    displayName: "Annual Roof Inspection (year 1 of 5)",
    defaultTitle: "Annual roof inspection + photo report — 5-year maintenance plan",
    defaultDescription:
      "Annual visual roof inspection with photo documentation and a written customer summary. Included with the 5-year maintenance plan; no additional charge in year 1.",
    defaultQuantity: 1,
    defaultUnitPriceCents: 0,
    defaultExecutionMode: "MANIFEST",
    packetKey: "pkt-roof-annual-inspection",
  },
  // ── Quote-only (SOLD_SCOPE) — admin / fee passthrough ────────────────────
  {
    presetKey: "permit-fee-passthrough",
    displayName: "Permit Fee — City Pass-through",
    defaultTitle: "Building permit fee (city pass-through)",
    defaultDescription:
      "Pass-through cost of the building permit fee charged by the AHJ. Quote-only line — appears on the proposal but does not create crew work. Update the unit price to match the actual permit invoice.",
    defaultQuantity: 1,
    defaultUnitPriceCents: 325_00,
    defaultExecutionMode: "SOLD_SCOPE",
    packetKey: null,
  },
  {
    presetKey: "travel-mobilization-out-of-region",
    displayName: "Travel & Mobilization (Out-of-Region)",
    defaultTitle: "Travel + mobilization charge for out-of-region jobs",
    defaultDescription:
      "Per-trip travel and mobilization charge applied to projects outside the standard service radius. Quote-only line — covers fuel, drive time, and per-diem; does not create crew work on its own.",
    defaultQuantity: 1,
    defaultUnitPriceCents: 250_00,
    defaultExecutionMode: "SOLD_SCOPE",
    packetKey: null,
  },
];

/**
 * Look up parent ScopePacket ids by key after `createCatalogPackets` has run.
 *
 * `createCatalogPackets` returns revision ids (which scenarios consume to pin
 * `scopePacketRevisionId` on quote line items); presets reference the parent
 * packet, never a revision, so we read the freshly-created parents back from
 * the database here. One small `findMany` keeps the catalog seed unchanged.
 */
async function loadScopePacketIdsByKey(
  prisma: PrismaClient,
): Promise<Map<PacketKey, string>> {
  const rows = await prisma.scopePacket.findMany({
    where: { tenantId: TENANT_ID },
    select: { id: true, packetKey: true },
  });
  const out = new Map<PacketKey, string>();
  for (const row of rows) {
    out.set(row.packetKey as PacketKey, row.id);
  }
  return out;
}

async function createLineItemPresets(
  prisma: PrismaClient,
  packetIdsByKey: Map<PacketKey, string>,
): Promise<number> {
  let created = 0;
  for (const spec of PRESET_SPECS) {
    let defaultScopePacketId: string | null = null;
    if (spec.defaultExecutionMode === "MANIFEST") {
      if (spec.packetKey == null) {
        throw new Error(
          `[demo-seed] Preset ${spec.presetKey} is MANIFEST but has no packetKey.`,
        );
      }
      const packetId = packetIdsByKey.get(spec.packetKey);
      if (packetId == null) {
        throw new Error(
          `[demo-seed] Preset ${spec.presetKey} references missing packet ${spec.packetKey}.`,
        );
      }
      defaultScopePacketId = packetId;
    }
    await prisma.lineItemPreset.create({
      data: {
        tenantId: TENANT_ID,
        presetKey: spec.presetKey,
        displayName: spec.displayName,
        defaultTitle: spec.defaultTitle,
        defaultDescription: spec.defaultDescription,
        defaultQuantity: spec.defaultQuantity,
        defaultUnitPriceCents: spec.defaultUnitPriceCents,
        defaultExecutionMode: spec.defaultExecutionMode,
        defaultPaymentBeforeWork: spec.defaultPaymentBeforeWork ?? null,
        defaultPaymentGateTitleOverride: spec.defaultPaymentGateTitleOverride ?? null,
        defaultScopePacketId,
      },
    });
    created += 1;
  }
  return created;
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer + draft quote helpers
// ─────────────────────────────────────────────────────────────────────────────

type CustomerSpec = {
  name: string;
  primaryEmail: string;
  primaryPhone: string;
  billingAddress: { line1: string; city: string; region: string; postal: string };
  contacts: {
    displayName: string;
    role: "BILLING" | "SITE" | "OWNER" | "OTHER";
    methods: { type: "EMAIL" | "PHONE" | "MOBILE"; value: string; isPrimary?: boolean }[];
    notes?: string;
  }[];
  noteBody: string;
};

async function createCustomerWithDetails(
  prisma: PrismaClient,
  spec: CustomerSpec,
): Promise<string> {
  const customer = await prisma.customer.create({
    data: {
      tenantId: TENANT_ID,
      name: spec.name,
      primaryEmail: spec.primaryEmail,
      primaryPhone: spec.primaryPhone,
      billingAddressJson: spec.billingAddress as never,
    },
    select: { id: true },
  });

  for (const c of spec.contacts) {
    await prisma.customerContact.create({
      data: {
        tenantId: TENANT_ID,
        customerId: customer.id,
        displayName: c.displayName,
        role: c.role,
        notes: c.notes ?? null,
        methods: {
          create: c.methods.map((m) => ({
            type: m.type,
            value: m.value,
            isPrimary: m.isPrimary === true,
            okToEmail: m.type === "EMAIL",
            okToSms: m.type === "MOBILE",
          })),
        },
      },
    });
  }

  await prisma.customerNote.create({
    data: {
      tenantId: TENANT_ID,
      customerId: customer.id,
      body: spec.noteBody,
      createdById: OFFICE_USER_ID,
    },
  });

  return customer.id;
}

async function createDraftQuoteForCustomer(
  prisma: PrismaClient,
  args: {
    customerId: string;
    flowGroupName: string;
    quoteNumber: string;
    workflowVersionId: string;
    proposalGroupName?: string;
  },
): Promise<{
  flowGroupId: string;
  quoteId: string;
  quoteVersionId: string;
  proposalGroupId: string;
}> {
  const flowGroup = await prisma.flowGroup.create({
    data: { tenantId: TENANT_ID, customerId: args.customerId, name: args.flowGroupName },
  });
  const quote = await prisma.quote.create({
    data: {
      tenantId: TENANT_ID,
      customerId: args.customerId,
      flowGroupId: flowGroup.id,
      quoteNumber: args.quoteNumber,
    },
  });
  const qv = await prisma.quoteVersion.create({
    data: {
      quoteId: quote.id,
      versionNumber: 1,
      status: "DRAFT",
      createdById: OFFICE_USER_ID,
      pinnedWorkflowVersionId: args.workflowVersionId,
    },
    select: { id: true },
  });
  const proposalGroup = await prisma.proposalGroup.create({
    data: {
      quoteVersionId: qv.id,
      name: args.proposalGroupName ?? "Base Scope",
      sortOrder: 0,
    },
    select: { id: true },
  });
  return {
    flowGroupId: flowGroup.id,
    quoteId: quote.id,
    quoteVersionId: qv.id,
    proposalGroupId: proposalGroup.id,
  };
}

async function sendThenSign(
  prisma: PrismaClient,
  quoteVersionId: string,
  sendKey: string,
): Promise<{ jobId: string; flowId: string; runtimeTaskCount: number }> {
  const tokRow = await prisma.quoteVersion.findUnique({
    where: { id: quoteVersionId },
    select: { composePreviewStalenessToken: true },
  });
  const sendRes = await sendQuoteVersionForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId,
    sentByUserId: OFFICE_USER_ID,
    request: {
      clientStalenessToken: tokRow?.composePreviewStalenessToken ?? null,
      sendClientRequestId: sendKey,
    },
  });
  if (!sendRes.ok) {
    throw new Error(`send failed for ${quoteVersionId}: ${JSON.stringify(sendRes)}`);
  }
  const signRes = await signQuoteVersionForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId,
    recordedByUserId: OFFICE_USER_ID,
  });
  if (!signRes.ok) {
    throw new Error(`sign failed for ${quoteVersionId}: ${JSON.stringify(signRes)}`);
  }
  const activation = signRes.data.activation;
  if (!activation) {
    throw new Error(
      `auto-activate did not run for ${quoteVersionId} — tenant.autoActivateOnSign should be true`,
    );
  }
  return {
    jobId: signRes.data.jobId,
    flowId: activation.flowId,
    runtimeTaskCount: activation.runtimeTaskCount,
  };
}

async function getRuntimeTasksInSlotOrder(
  prisma: PrismaClient,
  quoteVersionId: string,
  flowId: string,
): Promise<{ id: string; packageTaskId: string; displayTitle: string; nodeId: string }[]> {
  const qv = await prisma.quoteVersion.findUnique({
    where: { id: quoteVersionId },
    select: { executionPackageSnapshot: true },
  });
  const slots =
    (qv?.executionPackageSnapshot as { slots?: { packageTaskId: string }[] } | null)?.slots ?? [];
  const tasks = await prisma.runtimeTask.findMany({
    where: { flowId },
    select: { id: true, packageTaskId: true, displayTitle: true, nodeId: true },
  });
  const byPackageTaskId = new Map(tasks.map((t) => [t.packageTaskId, t]));
  const ordered: { id: string; packageTaskId: string; displayTitle: string; nodeId: string }[] = [];
  for (const slot of slots) {
    const t = byPackageTaskId.get(slot.packageTaskId);
    if (t) ordered.push(t);
  }
  return ordered;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios
// ─────────────────────────────────────────────────────────────────────────────

type ScenarioFlow = {
  flowId: string;
  quoteVersionId: string;
  runtimeTaskCount: number;
  superseded: boolean;
};

type ScenarioSummary = {
  name: string;
  trade: string;
  customerId: string;
  customerName: string;
  flowGroupId: string;
  quoteId: string;
  jobId: string | null;
  flows: ScenarioFlow[];
  paymentGateId?: string;
  holdId?: string;
  changeOrderId?: string;
  preJobTaskIds?: string[];
  notes: string[];
};

async function runScenarioMaple(
  prisma: PrismaClient,
  workflowVersionIds: Record<WorkflowKey, string>,
  packetRevisionIds: Map<PacketKey, string>,
): Promise<ScenarioSummary> {
  const customerId = await createCustomerWithDetails(prisma, {
    name: "Maple Family Residence",
    primaryEmail: "mapleresidence@example.com",
    primaryPhone: "(555) 010-1102",
    billingAddress: { line1: "412 Maple Ln", city: "Springfield", region: "IL", postal: "62704" },
    contacts: [
      {
        displayName: "Sarah Maple",
        role: "OWNER",
        methods: [
          { type: "MOBILE", value: "(555) 010-1102", isPrimary: true },
          { type: "EMAIL", value: "sarah.maple@example.com", isPrimary: true },
        ],
        notes: "Homeowner; on-site contact for crew.",
      },
    ],
    noteBody: "Homeowner prefers morning crew arrivals (7–9am). Back gate code: 4412.",
  });

  const { flowGroupId, quoteId, quoteVersionId, proposalGroupId } =
    await createDraftQuoteForCustomer(prisma, {
      customerId,
      flowGroupName: "Maple — 8.4 kW Solar + Panel Upgrade",
      quoteNumber: "MAPLE-2026-001",
      workflowVersionId: workflowVersionIds.solar,
    });

  const solar = await createQuoteLineItemForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId,
    proposalGroupId,
    sortOrder: 1,
    executionMode: "MANIFEST",
    title: "Solar Install — 8.4 kW residential PV",
    description:
      "Roof-mounted system: 21 × 400 W modules, microinverters, monitoring, full commissioning.",
    quantity: 1,
    scopePacketRevisionId: packetRevisionIds.get("pkt-solar-8kw")!,
    unitPriceCents: 2_480_000,
    lineTotalCents: 2_480_000,
    paymentBeforeWork: true,
    paymentGateTitleOverride: "50% deposit due before installation begins",
  });
  if (solar === "not_found") throw new Error("Maple: solar line creation failed");

  const panel = await createQuoteLineItemForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId,
    proposalGroupId,
    sortOrder: 2,
    executionMode: "MANIFEST",
    title: "Service panel upgrade — 200 A",
    description: "Replace existing 100 A panel with new 200 A main; relabel circuits.",
    quantity: 1,
    scopePacketRevisionId: packetRevisionIds.get("pkt-panel-200a")!,
    unitPriceCents: 340_000,
    lineTotalCents: 340_000,
  });
  if (panel === "not_found") throw new Error("Maple: panel line creation failed");

  const fees = await createQuoteLineItemForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId,
    proposalGroupId,
    sortOrder: 3,
    executionMode: "SOLD_SCOPE",
    title: "Permit & utility interconnection fees",
    description: "Pass-through; final amount per AHJ + utility.",
    quantity: 1,
    unitPriceCents: 85_000,
    lineTotalCents: 85_000,
  });
  if (fees === "not_found") throw new Error("Maple: fees line creation failed");

  const result = await sendThenSign(prisma, quoteVersionId, "demo-maple-send");

  const gate = await prisma.paymentGate.findFirst({
    where: { jobId: result.jobId, quoteVersionId },
    select: { id: true, title: true, targets: { select: { taskId: true } } },
  });

  return {
    name: "1. HAPPY PATH + PAYMENT GATE",
    trade: "Solar + service upgrade",
    customerId,
    customerName: "Maple Family Residence",
    flowGroupId,
    quoteId,
    jobId: result.jobId,
    flows: [
      {
        flowId: result.flowId,
        quoteVersionId,
        runtimeTaskCount: result.runtimeTaskCount,
        superseded: false,
      },
    ],
    paymentGateId: gate?.id,
    notes: [
      `Quote: 8.4 kW solar packet (4 tasks) + 200 A panel packet (1 task) + permit allowance.`,
      `Activation produced ${result.runtimeTaskCount} RuntimeTasks across nodes site-survey → roof-mount → pv-install → commissioning → electrical.`,
      gate
        ? `Payment gate "${gate.title}" targets ${gate.targets.length} solar task(s); Office can satisfy via /api/payment-gates/${gate.id}/satisfy.`
        : `Payment gate was not materialized (verify line 1 paymentBeforeWork=true).`,
      `Expected: solar slots blocked by PAYMENT_GATE_UNSATISFIED; panel slot may be next eligible. After Satisfy Gate, solar slot 0 becomes isNextForJob.`,
    ],
  };
}

async function runScenarioRiverside(
  prisma: PrismaClient,
  workflowVersionIds: Record<WorkflowKey, string>,
  packetRevisionIds: Map<PacketKey, string>,
): Promise<ScenarioSummary> {
  const customerId = await createCustomerWithDetails(prisma, {
    name: "Riverside Apartments — Bldg 3",
    primaryEmail: "pm@riversideapts.example.com",
    primaryPhone: "(555) 010-3344",
    billingAddress: { line1: "88 Riverside Pkwy", city: "Springfield", region: "IL", postal: "62701" },
    contacts: [
      {
        displayName: "Marcus Lee",
        role: "BILLING",
        methods: [
          { type: "EMAIL", value: "marcus.lee@riversideapts.example.com", isPrimary: true },
          { type: "PHONE", value: "(555) 010-3344", isPrimary: true },
        ],
        notes: "Property manager; signs all invoices.",
      },
      {
        displayName: "Dale Ortiz",
        role: "SITE",
        methods: [{ type: "MOBILE", value: "(555) 010-3399", isPrimary: false }],
        notes: "Maintenance lead; on-site coordination + roof access.",
      },
    ],
    noteBody:
      "Tenant notice must be posted 7 days before any rooftop work begins (per lease addendum).",
  });

  const { flowGroupId, quoteId, quoteVersionId, proposalGroupId } =
    await createDraftQuoteForCustomer(prisma, {
      customerId,
      flowGroupName: "Riverside Bldg 3 — South Array",
      quoteNumber: "RIVERSIDE-2026-001",
      workflowVersionId: workflowVersionIds.solar,
    });

  const solar = await createQuoteLineItemForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId,
    proposalGroupId,
    sortOrder: 1,
    executionMode: "MANIFEST",
    title: "Solar Install — 8.4 kW (Bldg 3 South array)",
    description: "Roof-mount PV array on south-facing roof of Building 3.",
    quantity: 1,
    scopePacketRevisionId: packetRevisionIds.get("pkt-solar-8kw")!,
    unitPriceCents: 2_620_000,
    lineTotalCents: 2_620_000,
  });
  if (solar === "not_found") throw new Error("Riverside: solar line creation failed");

  const warranty = await createQuoteLineItemForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId,
    proposalGroupId,
    sortOrder: 2,
    executionMode: "SOLD_SCOPE",
    title: "Roof-penetration 10-year warranty add-on",
    description: "Sold scope: warranty coverage on all new roof penetrations.",
    quantity: 1,
    unitPriceCents: 120_000,
    lineTotalCents: 120_000,
  });
  if (warranty === "not_found") throw new Error("Riverside: warranty line creation failed");

  const result = await sendThenSign(prisma, quoteVersionId, "demo-riverside-send");

  const ordered = await getRuntimeTasksInSlotOrder(prisma, quoteVersionId, result.flowId);
  if (ordered.length < 1) {
    throw new Error(`Riverside: expected ≥1 RuntimeTask, got ${ordered.length}`);
  }
  const slot0 = ordered[0]!;

  const startRes = await startRuntimeTaskForTenant(prisma, {
    tenantId: TENANT_ID,
    runtimeTaskId: slot0.id,
    actorUserId: FIELD_USER_ID,
    request: { notes: "Beginning south-side site verification." },
  });
  if (!startRes.ok) {
    throw new Error(`Riverside: start failed: ${JSON.stringify(startRes)}`);
  }

  const completeRes = await completeRuntimeTaskForTenant(prisma, {
    tenantId: TENANT_ID,
    runtimeTaskId: slot0.id,
    actorUserId: FIELD_USER_ID,
    request: {
      notes: "South array verified. Service capacity confirmed adequate for 8.4 kW addition.",
      completionProof: {
        note: "South array verified. Service capacity confirmed adequate for 8.4 kW addition.",
        checklist: [
          { label: "Roof / structure visually sound", status: "yes" },
          { label: "Service panel rated for additional load", status: "yes" },
          { label: "No obvious safety hazards on site", status: "yes" },
        ],
        attachments: [
          {
            key: "demo/riverside-bldg3-roof-south.jpg",
            fileName: "riverside-bldg3-roof-south.jpg",
            fileSize: 2_184_512,
            contentType: "image/jpeg",
          },
        ],
      },
    },
  });
  if (!completeRes.ok) {
    throw new Error(`Riverside: complete failed: ${JSON.stringify(completeRes)}`);
  }

  return {
    name: "2. COMPLETED PENDING REVIEW",
    trade: "Solar + service upgrade",
    customerId,
    customerName: "Riverside Apartments — Bldg 3",
    flowGroupId,
    quoteId,
    jobId: result.jobId,
    flows: [
      {
        flowId: result.flowId,
        quoteVersionId,
        runtimeTaskCount: result.runtimeTaskCount,
        superseded: false,
      },
    ],
    notes: [
      `Quote: 8.4 kW commercial PV packet (4 tasks) + warranty allowance.`,
      `Field user completed slot 0 (${slot0.displayTitle}) with checklist + attachment proof; no review acceptance.`,
      `Expected (current canon, do not change): completed task remains in feed in 'blocked' lane`,
      `  with reason TASK_ALREADY_COMPLETED; isNextForJob skips to slot 1.`,
      `Open question (flagged, not implemented): no explicit 'pending_review' lane today — investigate.`,
    ],
  };
}

async function runScenarioHilltop(
  prisma: PrismaClient,
  workflowVersionIds: Record<WorkflowKey, string>,
  packetRevisionIds: Map<PacketKey, string>,
): Promise<ScenarioSummary> {
  const customerId = await createCustomerWithDetails(prisma, {
    name: "Hilltop Residence",
    primaryEmail: "hilltop412@example.com",
    primaryPhone: "(555) 010-2244",
    billingAddress: { line1: "412 Ridge Rd", city: "Springfield", region: "IL", postal: "62711" },
    contacts: [
      {
        displayName: "Janet Hill",
        role: "OWNER",
        methods: [
          { type: "MOBILE", value: "(555) 010-2244", isPrimary: true },
          { type: "EMAIL", value: "janet.hill@example.com", isPrimary: true },
        ],
      },
    ],
    noteBody:
      "Two dogs on property — confirm side gate is closed before tear-off begins each morning.",
  });

  const { flowGroupId, quoteId, quoteVersionId: v1Id, proposalGroupId: pg1Id } =
    await createDraftQuoteForCustomer(prisma, {
      customerId,
      flowGroupName: "Hilltop — Reroof + later CO",
      quoteNumber: "HILLTOP-2026-001",
      workflowVersionId: workflowVersionIds.roofing,
    });

  const reroof = await createQuoteLineItemForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId: v1Id,
    proposalGroupId: pg1Id,
    sortOrder: 1,
    executionMode: "MANIFEST",
    title: "Reroof — tear-off + Timberline HDZ (30 sq)",
    description: "Full tear-off of existing roof, deck repair as needed, GAF Timberline HDZ install.",
    quantity: 1,
    scopePacketRevisionId: packetRevisionIds.get("pkt-reroof-30sq")!,
    unitPriceCents: 1_425_000,
    lineTotalCents: 1_425_000,
  });
  if (reroof === "not_found") throw new Error("Hilltop: reroof line creation failed");

  const decking = await createQuoteLineItemForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId: v1Id,
    proposalGroupId: pg1Id,
    sortOrder: 2,
    executionMode: "SOLD_SCOPE",
    title: "Decking replacement allowance (per sheet)",
    description: "Allowance billed per damaged sheet discovered during tear-off.",
    quantity: 1,
    unitPriceCents: 85_000,
    lineTotalCents: 85_000,
  });
  if (decking === "not_found") throw new Error("Hilltop: decking allowance failed");

  const v1 = await sendThenSign(prisma, v1Id, "demo-hilltop-v1-send");

  const coRes = await createChangeOrderForJob(prisma, {
    tenantId: TENANT_ID,
    jobId: v1.jobId,
    reason:
      "Homeowner approved chimney flashing repair after tear-off revealed cracked counter-flashing.",
    createdById: OFFICE_USER_ID,
  });
  if (!coRes.ok) {
    throw new Error(`Hilltop: createChangeOrderForJob failed: ${JSON.stringify(coRes)}`);
  }
  const draftQvId = coRes.data.draftQuoteVersionId;

  const draftPg = await prisma.proposalGroup.findFirst({
    where: { quoteVersionId: draftQvId },
    select: { id: true },
  });
  if (!draftPg) throw new Error("Hilltop: draft proposal group missing after CO clone");

  const chimney = await createQuoteLineItemForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId: draftQvId,
    proposalGroupId: draftPg.id,
    sortOrder: 5,
    executionMode: "MANIFEST",
    title: "Chimney flashing repair (added per CO)",
    description: "New step + counter-flashing on chimney; sealed at all terminations.",
    quantity: 1,
    scopePacketRevisionId: packetRevisionIds.get("pkt-chimney-flash")!,
    unitPriceCents: 115_000,
    lineTotalCents: 115_000,
  });
  if (chimney === "not_found") throw new Error("Hilltop: chimney CO line failed");

  const v2 = await sendThenSign(prisma, draftQvId, "demo-hilltop-v2-send");

  const applyRes = await applyChangeOrderForJob(prisma, {
    tenantId: TENANT_ID,
    changeOrderId: coRes.data.changeOrderId,
    appliedByUserId: OFFICE_USER_ID,
  });
  if (!applyRes.ok) {
    throw new Error(`Hilltop: applyChangeOrderForJob failed: ${JSON.stringify(applyRes)}`);
  }

  return {
    name: "3. CHANGE ORDER / SUPERSEDED FLOW",
    trade: "Roofing repair / reroof",
    customerId,
    customerName: "Hilltop Residence",
    flowGroupId,
    quoteId,
    jobId: v1.jobId,
    flows: [
      { flowId: v1.flowId, quoteVersionId: v1Id, runtimeTaskCount: v1.runtimeTaskCount, superseded: true },
      { flowId: v2.flowId, quoteVersionId: draftQvId, runtimeTaskCount: v2.runtimeTaskCount, superseded: false },
    ],
    changeOrderId: coRes.data.changeOrderId,
    notes: [
      `Original v1: reroof packet (4 tasks) + decking allowance.`,
      `Change order added chimney flashing packet (1 task). Apply: ${applyRes.data.supersededTaskCount} old tasks superseded, ${applyRes.data.addedTaskCount} new tasks live, ${applyRes.data.transferredExecutionCount} executions transferred.`,
      `Expected: Global Work Feed shows ONLY Flow B RuntimeTasks (Flow A's 4 tasks are superseded and excluded).`,
    ],
  };
}

async function runScenarioOakwood(
  prisma: PrismaClient,
  workflowVersionIds: Record<WorkflowKey, string>,
  packetRevisionIds: Map<PacketKey, string>,
): Promise<ScenarioSummary> {
  const customerId = await createCustomerWithDetails(prisma, {
    name: "Oakwood Office Complex",
    primaryEmail: "facilities@oakwoodcomplex.example.com",
    primaryPhone: "(555) 010-5566",
    billingAddress: { line1: "200 Oakwood Blvd", city: "Springfield", region: "IL", postal: "62702" },
    contacts: [
      {
        displayName: "Rita Chen",
        role: "BILLING",
        methods: [
          { type: "EMAIL", value: "rita.chen@oakwoodcomplex.example.com", isPrimary: true },
          { type: "PHONE", value: "(555) 010-5566", isPrimary: true },
        ],
        notes: "Facilities director; primary point of contact for permits and COI.",
      },
    ],
    noteBody:
      "Building access via service entrance only (rear loading dock). COI must be on-site before crew arrival.",
  });

  const { flowGroupId, quoteId, quoteVersionId, proposalGroupId } =
    await createDraftQuoteForCustomer(prisma, {
      customerId,
      flowGroupName: "Oakwood — NE Section BUR repair",
      quoteNumber: "OAKWOOD-2026-001",
      workflowVersionId: workflowVersionIds.roofing,
    });

  const repair = await createQuoteLineItemForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId,
    proposalGroupId,
    sortOrder: 1,
    executionMode: "MANIFEST",
    title: "Built-up roof repair — northeast section",
    description: "Cut-and-patch of damaged BUR membrane in northeast quadrant; water-test on completion.",
    quantity: 1,
    scopePacketRevisionId: packetRevisionIds.get("pkt-roof-builtup-repair")!,
    unitPriceCents: 480_000,
    lineTotalCents: 480_000,
  });
  if (repair === "not_found") throw new Error("Oakwood: repair line failed");

  const afterHours = await createQuoteLineItemForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId,
    proposalGroupId,
    sortOrder: 2,
    executionMode: "SOLD_SCOPE",
    title: "After-hours premium (city ordinance)",
    description: "Sold scope: required after-hours work premium per municipal ordinance.",
    quantity: 1,
    unitPriceCents: 60_000,
    lineTotalCents: 60_000,
  });
  if (afterHours === "not_found") throw new Error("Oakwood: after-hours line failed");

  const result = await sendThenSign(prisma, quoteVersionId, "demo-oakwood-send");

  const ordered = await getRuntimeTasksInSlotOrder(prisma, quoteVersionId, result.flowId);
  if (ordered.length < 2) {
    throw new Error(`Oakwood: expected ≥2 RuntimeTasks, got ${ordered.length}`);
  }
  const slot0 = ordered[0]!;

  const hold = await createOperationalHoldForJob(prisma, {
    tenantId: TENANT_ID,
    jobId: result.jobId,
    createdById: OFFICE_USER_ID,
    runtimeTaskId: slot0.id,
    reason: "Awaiting city permit #25-1148 — hold per facilities request.",
  });

  return {
    name: "4. BLOCKED BY OPERATIONAL HOLD",
    trade: "Roofing repair / reroof",
    customerId,
    customerName: "Oakwood Office Complex",
    flowGroupId,
    quoteId,
    jobId: result.jobId,
    flows: [
      {
        flowId: result.flowId,
        quoteVersionId,
        runtimeTaskCount: result.runtimeTaskCount,
        superseded: false,
      },
    ],
    holdId: hold.id,
    notes: [
      `Quote: BUR repair packet (3 tasks) + after-hours sold-scope premium.`,
      `Task-scoped operational hold placed on slot 0 (${slot0.displayTitle}) with reason "Awaiting city permit #25-1148".`,
      `Expected: slot 0 lane=blocked (HOLD_ACTIVE); slot 1 isNextForJob=true.`,
    ],
  };
}

async function runScenarioSunset(
  prisma: PrismaClient,
  workflowVersionIds: Record<WorkflowKey, string>,
  packetRevisionIds: Map<PacketKey, string>,
): Promise<ScenarioSummary> {
  const customerId = await createCustomerWithDetails(prisma, {
    name: "Sunset Plaza Tenant Spaces",
    primaryEmail: "gm@sunsetplaza.example.com",
    primaryPhone: "(555) 010-7788",
    billingAddress: { line1: "770 Sunset Plaza Dr", city: "Springfield", region: "IL", postal: "62703" },
    contacts: [
      {
        displayName: "Anita Park",
        role: "BILLING",
        methods: [
          { type: "EMAIL", value: "anita.park@sunsetplaza.example.com", isPrimary: true },
          { type: "PHONE", value: "(555) 010-7788", isPrimary: true },
        ],
        notes: "General manager; coordinates tenant approvals.",
      },
    ],
    noteBody:
      "Two tenant suites need EV chargers (Suite 110 + Suite 240). Utility coordination underway with Ameren.",
  });

  const { flowGroupId, quoteId, quoteVersionId, proposalGroupId } =
    await createDraftQuoteForCustomer(prisma, {
      customerId,
      flowGroupName: "Sunset Plaza — EV chargers + sub-panel",
      quoteNumber: "SUNSET-2026-001",
      workflowVersionId: workflowVersionIds.ev,
    });

  const charger110 = await createQuoteLineItemForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId,
    proposalGroupId,
    sortOrder: 1,
    executionMode: "MANIFEST",
    title: "Level 2 EV charger install — Suite 110",
    description: "Wall-mount Level 2 charger; dedicated 40 A circuit from new sub-panel.",
    quantity: 1,
    scopePacketRevisionId: packetRevisionIds.get("pkt-ev-charger-install")!,
    unitPriceCents: 220_000,
    lineTotalCents: 220_000,
  });
  if (charger110 === "not_found") throw new Error("Sunset: charger 110 line failed");

  const charger240 = await createQuoteLineItemForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId,
    proposalGroupId,
    sortOrder: 2,
    executionMode: "MANIFEST",
    title: "Level 2 EV charger install — Suite 240",
    description: "Wall-mount Level 2 charger; dedicated 40 A circuit from new sub-panel.",
    quantity: 1,
    scopePacketRevisionId: packetRevisionIds.get("pkt-ev-charger-install")!,
    unitPriceCents: 220_000,
    lineTotalCents: 220_000,
  });
  if (charger240 === "not_found") throw new Error("Sunset: charger 240 line failed");

  const subPanel = await createQuoteLineItemForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId,
    proposalGroupId,
    sortOrder: 3,
    executionMode: "MANIFEST",
    title: "Sub-panel install for charger feed",
    description: "New 200 A sub-panel feeding both charger circuits; tagged & labeled.",
    quantity: 1,
    scopePacketRevisionId: packetRevisionIds.get("pkt-panel-200a")!,
    unitPriceCents: 340_000,
    lineTotalCents: 340_000,
  });
  if (subPanel === "not_found") throw new Error("Sunset: sub-panel line failed");

  const utility = await createQuoteLineItemForTenant(prisma, {
    tenantId: TENANT_ID,
    quoteVersionId,
    proposalGroupId,
    sortOrder: 4,
    executionMode: "SOLD_SCOPE",
    title: "Utility service upgrade fees (pass-through)",
    description: "Sold scope: utility coordination + service upgrade fees.",
    quantity: 1,
    unitPriceCents: 125_000,
    lineTotalCents: 125_000,
  });
  if (utility === "not_found") throw new Error("Sunset: utility line failed");

  const survey = await prisma.preJobTask.create({
    data: {
      tenantId: TENANT_ID,
      flowGroupId,
      quoteVersionId,
      taskType: "SITE_SURVEY",
      sourceType: "MANUAL",
      title: "Onsite survey: confirm chase routing for two charger circuits",
      description:
        "Confirm conduit chase routing from new sub-panel to Suite 110 and Suite 240. Photograph each penetration point.",
      createdById: OFFICE_USER_ID,
      status: "OPEN",
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });

  const permit = await prisma.preJobTask.create({
    data: {
      tenantId: TENANT_ID,
      flowGroupId,
      quoteVersionId,
      taskType: "PERMIT_SUBMISSION",
      sourceType: "MANUAL",
      title: "Submit electrical permit packet to city",
      description:
        "Compile drawings + load calc; submit Form E-205 to Springfield permitting office; capture permit number.",
      createdById: OFFICE_USER_ID,
      status: "OPEN",
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });

  return {
    name: "5. PRE-JOB ONLY / NO ACTIVATION",
    trade: "EV charger / panel upgrade",
    customerId,
    customerName: "Sunset Plaza Tenant Spaces",
    flowGroupId,
    quoteId,
    jobId: null,
    flows: [],
    preJobTaskIds: [survey.id, permit.id],
    notes: [
      `Quote DRAFT (not sent): 2 charger installs + sub-panel + utility allowance.`,
      `2 PreJobTasks created: site survey + permit submission.`,
      `Expected: Global Work Feed rows=[]; preJobRows=[]; skeletonRows=[]. PreJob lives in workspace context only.`,
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────

function printSummary(scenarios: ScenarioSummary[]): void {
  const lines: string[] = [];
  lines.push("");
  lines.push("=".repeat(78));
  lines.push("Demo seed complete — Execution Canon v5 visual verification (3 trades, 5 customers)");
  lines.push("=".repeat(78));
  const pwd = process.env.STRUXIENT_DEMO_PASSWORD?.trim() || "struxient-demo";
  lines.push(`Tenant ID:    ${TENANT_ID}    (use this in the Tenant ID field at /login)`);
  lines.push(`Office user:  ${OFFICE_USER_EMAIL}  /  ${pwd}`);
  lines.push(`Field user:   ${FIELD_USER_EMAIL}   /  ${pwd}`);
  lines.push("");
  for (const s of scenarios) {
    lines.push(`▶ ${s.name}    [${s.trade}]`);
    lines.push(`   Customer  : ${s.customerName}`);
    lines.push(`             /customers/${s.customerId}`);
    lines.push(`   Quote     : /quotes/${s.quoteId}`);
    if (s.jobId) lines.push(`   Job       : /jobs/${s.jobId}`);
    for (const f of s.flows) {
      const tag = f.superseded ? "  (SUPERSEDED — excluded from feed)" : "";
      lines.push(`   Flow      : /flows/${f.flowId} → ${f.runtimeTaskCount} RuntimeTask(s)${tag}`);
    }
    if (s.paymentGateId) lines.push(`   Pay gate  : ${s.paymentGateId}  → POST /api/payment-gates/${s.paymentGateId}/satisfy`);
    if (s.holdId) lines.push(`   Hold      : ${s.holdId}`);
    if (s.changeOrderId) lines.push(`   CO        : ${s.changeOrderId}`);
    if (s.preJobTaskIds && s.preJobTaskIds.length > 0) lines.push(`   PreJob    : ${s.preJobTaskIds.join(", ")}`);
    for (const n of s.notes) {
      lines.push(`   • ${n}`);
    }
    lines.push("");
  }
  lines.push("Verify via:");
  lines.push("  • /work                       — Global Work Feed (active flows only)");
  lines.push("  • /quotes/<quoteId>           — Quote workspace per scenario");
  lines.push("  • /flows/<flowId>             — Flow execution: cards w/ instructions + requirements");
  lines.push("  • /customers/<customerId>     — Customer detail with notes / contacts");
  lines.push("  • GET /api/work-feed          — Same canon, JSON form (sign in as office user)");
  lines.push("");
  lines.push("Demo data — fictitious customers, addresses, and pricing for product demonstration only.");
  lines.push("");
  console.log(lines.join("\n"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  applyEnvFile(".env", false);
  applyEnvFile(".env.local", true);

  const prisma = new PrismaClient();
  try {
    console.log("[demo-seed] Wiping demo tenant data…");
    await wipeDemoTenant(prisma);
    console.log("[demo-seed] Ensuring tenant + users…");
    await ensureDemoTenantAndUsers(prisma);
    console.log("[demo-seed] Creating TaskDefinitions…");
    const taskDefs = await createTaskDefinitions(prisma);
    console.log("[demo-seed] Creating workflow templates (solar / roofing / ev)…");
    const workflows = await createWorkflowTemplates(prisma);
    console.log("[demo-seed] Creating catalog packets…");
    const packets = await createCatalogPackets(prisma, taskDefs);
    console.log("[demo-seed] Creating line-item presets (saved-line catalog)…");
    const packetIdsByKey = await loadScopePacketIdsByKey(prisma);
    const presetCount = await createLineItemPresets(prisma, packetIdsByKey);
    console.log(`[demo-seed]   → ${presetCount} LineItemPreset rows created.`);

    console.log("[demo-seed] Scenario 1 — Maple (happy path + payment gate)…");
    const maple = await runScenarioMaple(prisma, workflows, packets);
    console.log("[demo-seed] Scenario 2 — Riverside (completed pending review)…");
    const riverside = await runScenarioRiverside(prisma, workflows, packets);
    console.log("[demo-seed] Scenario 3 — Hilltop (change order / superseded)…");
    const hilltop = await runScenarioHilltop(prisma, workflows, packets);
    console.log("[demo-seed] Scenario 4 — Oakwood (blocked by hold)…");
    const oakwood = await runScenarioOakwood(prisma, workflows, packets);
    console.log("[demo-seed] Scenario 5 — Sunset (pre-job only)…");
    const sunset = await runScenarioSunset(prisma, workflows, packets);

    printSummary([maple, riverside, hilltop, oakwood, sunset]);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
