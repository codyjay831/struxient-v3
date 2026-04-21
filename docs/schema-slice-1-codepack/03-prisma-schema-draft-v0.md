# Slice 1 — Prisma schema draft v0

**Status:** **DRAFT** — **base-layer** starting point for `prisma/schema.prisma`; expect migration tuning (partial unique, check constraints).  
**Do not** add Slice 2 models (`Job`, `Flow`, `RuntimeTask`, …).  
**Codepack defaults:** EMBEDDED-only packet lines; `AuditEvent` included.

---

## Layered truth (read this before pasting)

| Layer | Document | Role |
|-------|----------|------|
| **Base v0 paste** | **This file** | Minimal Prisma block for first migration / catalog-seed demos. Intentionally **does not** declare `PreJobTask`, `QuoteLocalPacket`, or `QuoteLocalPacketItem` models. |
| **Normative extension** | `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md` | **Authoritative planned shape** for those entities, XOR semantics on `QuoteLineItem`, and illustrative Prisma for **merge** into `schema.prisma`. |
| **Boundary locks** | `docs/implementation/decision-packs/prejobtask-schema-decision-pack.md`, `quotelocalpacket-schema-decision-pack.md` | Product/schema decisions the extension implements. |

**Authoritative read order for implementers:** (1) this v0 draft → (2) extension doc → (3) decision packs if a detail is unclear. **Planned schema** for Slice 1 = **v0 ∪ extension** when building quote-local scope and pre-job work; v0 alone is **not** claiming those features are out of scope — only that this **file’s code block** stays a smaller paste.

**`QuoteLineItem.quoteLocalPacketId` in the block below:** The column and index are **intentional**. Prisma **`@relation` to `QuoteLocalPacket` is omitted here** because the **parent model is defined in the extension doc** — this is **staged syntax**, not an undecided FK. When you add `QuoteLocalPacket`, add `quoteLocalPacket QuoteLocalPacket? @relation(...)` on `QuoteLineItem` and the reverse field on `QuoteLocalPacket`. **Semantic direction** (version-scoped local packet, XOR with `scopePacketRevisionId`) is **already settled** (`04-slice-1-relations-and-invariants.md`, decision packs).

**Canon amendment pending in the block below (interim promotion slice, authorized for next implementation epic):**

- `ScopePacketRevision.publishedAt` must become **nullable** (`DateTime?`). The block currently shows `DateTime`; implementers applying this slice should change to `DateTime?` in `schema.prisma`.
- `PacketTaskLine` must add a **top-level required** `targetNodeKey String` column. The block below does not yet list it; add it to `schema.prisma` when the interim promotion slice is built.

Both are authorized by `docs/canon/05-packet-canon.md` ("Canon amendment — interim one-step promotion"), `docs/epics/15-scope-packets-epic.md`, `docs/epics/16-packet-task-lines-epic.md`, and the extension doc's addendum. The v0 code block is **deliberately left unchanged** in this pass to keep the base paste minimal; the outline file and field definitions are the authoritative spec.

---

## Notes before paste

1. **Generator / datasource** — set `provider`, `url` per your repo; omitted here.
2. **`sendClientRequestId` partial unique** — add in SQL migration: unique where `sendClientRequestId IS NOT NULL` scoped to `quoteVersionId` (exact syntax depends on product: often unique on `(id)` already; **idempotency** = same key retries same version — `@@unique([sendClientRequestId])` is **wrong** globally; prefer **composite** `(quoteId, sendClientRequestId)` or store key only after success and use application check). **Slice 1 pragmatic approach:** `@@unique([sendClientRequestId])` **only if** keys are globally unique (UUID from client). Documented alternative: **nullable unique** per version via raw SQL.
3. **`quantity` check** — `CHECK ("quantity" > 0)` in SQL migration.

---

## Draft `schema.prisma` (Slice 1)

```prisma
// DRAFT v0 — Slice 1 only. Review before first migration.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum QuoteVersionStatus {
  DRAFT
  SENT
}

enum ScopePacketRevisionStatus {
  DRAFT
  PUBLISHED
}

enum WorkflowVersionStatus {
  DRAFT
  PUBLISHED
}

enum PacketTaskLineKind {
  EMBEDDED
}

enum QuoteLineItemExecutionMode {
  SOLD_SCOPE
  MANIFEST
}

enum AuditEventType {
  QUOTE_VERSION_SENT
}

model Tenant {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())

  users             User[]
  customers         Customer[]
  flowGroups        FlowGroup[]
  scopePackets      ScopePacket[]
  workflowTemplates WorkflowTemplate[]
  quotes            Quote[]
  auditEvents       AuditEvent[]
}

model User {
  id          String   @id @default(cuid())
  tenantId    String
  email       String
  displayName String?
  createdAt   DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  quoteVersionsCreated QuoteVersion[] @relation("QuoteVersionCreatedBy")
  quoteVersionsSent    QuoteVersion[] @relation("QuoteVersionSentBy")
  auditEvents          AuditEvent[]

  @@unique([tenantId, email])
  @@index([tenantId])
}

model Customer {
  id                 String   @id @default(cuid())
  tenantId           String
  name               String
  billingAddressJson Json?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  tenant     Tenant       @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  flowGroups FlowGroup[]
  quotes     Quote[]

  @@index([tenantId])
}

model FlowGroup {
  id         String   @id @default(cuid())
  tenantId   String
  customerId String
  name       String
  createdAt  DateTime @default(now())

  tenant   Tenant    @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  customer Customer  @relation(fields: [customerId], references: [id], onDelete: Restrict)
  quotes   Quote[]

  @@index([tenantId])
  @@index([customerId])
}

model ScopePacket {
  id          String @id @default(cuid())
  tenantId    String
  packetKey   String
  displayName String

  tenant     Tenant                @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  revisions  ScopePacketRevision[]

  @@unique([tenantId, packetKey])
  @@index([tenantId])
}

model ScopePacketRevision {
  id              String                     @id @default(cuid())
  scopePacketId   String
  revisionNumber  Int
  status          ScopePacketRevisionStatus
  publishedAt     DateTime

  scopePacket     ScopePacket      @relation(fields: [scopePacketId], references: [id], onDelete: Restrict)
  packetTaskLines PacketTaskLine[]
  quoteLineItems  QuoteLineItem[]

  @@unique([scopePacketId, revisionNumber])
  @@index([scopePacketId])
  @@index([status])
}

model PacketTaskLine {
  id                      String              @id @default(cuid())
  scopePacketRevisionId   String
  lineKey                 String
  tierCode                String?
  sortOrder               Int
  lineKind                PacketTaskLineKind
  embeddedPayloadJson     Json

  scopePacketRevision ScopePacketRevision @relation(fields: [scopePacketRevisionId], references: [id], onDelete: Restrict)

  @@unique([scopePacketRevisionId, lineKey])
  @@index([scopePacketRevisionId])
}

model WorkflowTemplate {
  id          String @id @default(cuid())
  tenantId    String
  templateKey String
  displayName String

  tenant   Tenant            @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  versions WorkflowVersion[]

  @@unique([tenantId, templateKey])
  @@index([tenantId])
}

model WorkflowVersion {
  id                 String                 @id @default(cuid())
  workflowTemplateId String
  versionNumber      Int
  status             WorkflowVersionStatus
  publishedAt        DateTime
  snapshotJson       Json

  workflowTemplate    WorkflowTemplate @relation(fields: [workflowTemplateId], references: [id], onDelete: Restrict)
  pinnedQuoteVersions QuoteVersion[]

  @@unique([workflowTemplateId, versionNumber])
  @@index([workflowTemplateId])
  @@index([status])
}

model Quote {
  id           String   @id @default(cuid())
  tenantId     String
  customerId   String
  flowGroupId  String
  quoteNumber  String
  createdAt    DateTime @default(now())

  tenant    Tenant         @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  customer  Customer       @relation(fields: [customerId], references: [id], onDelete: Restrict)
  flowGroup FlowGroup      @relation(fields: [flowGroupId], references: [id], onDelete: Restrict)
  versions  QuoteVersion[]

  @@unique([tenantId, quoteNumber])
  @@index([tenantId])
  @@index([customerId])
  @@index([flowGroupId])
}

model QuoteVersion {
  id                         String              @id @default(cuid())
  quoteId                    String
  versionNumber              Int
  status                     QuoteVersionStatus
  pinnedWorkflowVersionId    String?
  title                      String?
  createdAt                  DateTime            @default(now())
  createdById                String
  sentAt                     DateTime?
  sentById                   String?
  sendClientRequestId        String?             @unique
  planSnapshotSha256         String?
  packageSnapshotSha256      String?
  generatedPlanSnapshot      Json?
  executionPackageSnapshot   Json?
  composePreviewStalenessToken String?

  quote                 Quote             @relation(fields: [quoteId], references: [id], onDelete: Restrict)
  pinnedWorkflowVersion WorkflowVersion?  @relation(fields: [pinnedWorkflowVersionId], references: [id], onDelete: Restrict)
  createdBy             User              @relation("QuoteVersionCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  sentBy                User?             @relation("QuoteVersionSentBy", fields: [sentById], references: [id], onDelete: Restrict)
  proposalGroups        ProposalGroup[]
  quoteLineItems        QuoteLineItem[]
  auditEvents           AuditEvent[]

  @@unique([quoteId, versionNumber])
  @@index([quoteId])
  @@index([status])
  @@index([pinnedWorkflowVersionId])
}

model ProposalGroup {
  id             String @id @default(cuid())
  quoteVersionId String
  name           String
  sortOrder      Int

  quoteVersion   QuoteVersion    @relation(fields: [quoteVersionId], references: [id], onDelete: Cascade)
  quoteLineItems QuoteLineItem[]

  @@index([quoteVersionId])
}

// QuoteLineItem: manifest scope XOR is normative (`04`, `planning/01` §5–6).
// `quoteLocalPacketId`: intentional column + index; Prisma @relation + parent model — merge from
// `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md` (see this file header § Layered truth).
// Seed-only demos may populate only `scopePacketRevisionId`.
model QuoteLineItem {
  id                      String                     @id @default(cuid())
  quoteVersionId          String
  proposalGroupId         String
  sortOrder               Int
  scopePacketRevisionId   String?
  quoteLocalPacketId      String?
  tierCode                String?
  quantity                Int
  executionMode           QuoteLineItemExecutionMode
  title                   String
  description             String?
  unitPriceCents          Int?
  lineTotalCents          Int?

  quoteVersion        QuoteVersion         @relation(fields: [quoteVersionId], references: [id], onDelete: Cascade)
  proposalGroup       ProposalGroup        @relation(fields: [proposalGroupId], references: [id], onDelete: Restrict)
  scopePacketRevision ScopePacketRevision? @relation(fields: [scopePacketRevisionId], references: [id], onDelete: Restrict)

  @@index([quoteVersionId])
  @@index([proposalGroupId])
  @@index([scopePacketRevisionId])
  @@index([quoteLocalPacketId])
}

model AuditEvent {
  id                    String          @id @default(cuid())
  tenantId              String
  eventType             AuditEventType
  actorId               String
  targetQuoteVersionId  String
  payloadJson           Json?
  createdAt             DateTime        @default(now())

  tenant             Tenant       @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  actor              User         @relation(fields: [actorId], references: [id], onDelete: Restrict)
  targetQuoteVersion QuoteVersion @relation(fields: [targetQuoteVersionId], references: [id], onDelete: Restrict)

  @@index([tenantId, createdAt])
  @@index([targetQuoteVersionId])
}
```

---

## Draft caveats

| Topic | Issue |
|-------|--------|
| `sendClientRequestId @unique` | Global uniqueness of client keys; if keys are per-tenant only, replace with raw partial/composite unique |
| `ProposalGroup` onDelete | `Cascade` from version — **deleting draft version** removes groups/lines; **forbid version delete** after send in app |
| `QuoteLineItem.proposalGroup` | `Restrict` on delete — cannot remove group if lines exist |
| `quoteLocalPacketId` without `@relation` | **Staged in v0 file only.** Add FK + `QuoteLocalPacket` model from extension doc; until then enforce XOR / tenant / `quoteVersionId` match in application code if column exists |

---

## Classification

| Content | Type |
|---------|------|
| Full Prisma text in this file | **Base draft v0** (minimal paste) |
| `PreJobTask`, `QuoteLocalPacket`, `QuoteLocalPacketItem`, full `quoteLocalPacket` relation | **Extension-owned** — merge from `slice-1-extension-prejobtask-quotelocalpacket.md` |
| First migration SQL | **Next step** (see `08-open-implementation-questions.md`) |
| Merge guardrail checklist | **`10-schema-merge-checklist.md`** |
