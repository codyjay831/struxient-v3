# Slice 1 — Field definitions (minimum)

**Companion:** `02-slice-1-entity-list.md`, `04-slice-1-relations-and-invariants.md`.

**Authoritative read order (schema artifacts):** `docs/schema-slice-1-codepack/01-prisma-model-outline.md` → `03-prisma-schema-draft-v0.md` → `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md`. Fields for **`PreJobTask`**, **`QuoteLocalPacket`**, **`QuoteLocalPacketItem`**, and XOR **`quoteLocalPacketId`** are **planned schema**; v0 Prisma may **stage** `quoteLocalPacketId` without `@relation` until the extension models are merged.

**Legend — lifecycle column**

| Value | Meaning |
|-------|---------|
| **always** | Required whenever row exists |
| **draft** | Required before send only when `QuoteVersion.status = draft` (or equivalent) |
| **send** | Must be satisfied at send transaction commit |
| **sent_only** | Populated only when status is `sent` |

---

## Tenant

| Field | Purpose | Req | Mutable | Validation | Lifecycle |
|-------|---------|-----|---------|------------|-----------|
| `id` | PK | always | no | opaque string | always |
| `name` | Display | always | yes | non-empty | always |
| `createdAt` | Audit | always | no | ISO-8601 | always |

**Deferred:** billing, multi-company `companyId` (add when product requires).

---

## User

| Field | Purpose | Req | Mutable | Validation | Lifecycle |
|-------|---------|-----|---------|------------|-----------|
| `id` | PK | always | no | opaque | always |
| `tenantId` | Scope | always | no | FK tenant | always |
| `email` | Identity | always | yes* | unique per tenant | always |
| `displayName` | UI | optional | yes | — | always |

\* Platform policy.

---

## Customer

| Field | Purpose | Req | Mutable | Validation | Lifecycle |
|-------|---------|-----|---------|------------|-----------|
| `id` | PK | always | no | opaque | always |
| `tenantId` | Scope | always | no | FK | always |
| `name` | Anchor label | always | yes | non-empty | always |
| `billingAddressJson` | Optional CRM | optional | yes | JSON object | always |
| `createdAt` | Audit | always | no | ISO-8601 | always |
| `updatedAt` | Audit | always | yes | ISO-8601 | always |

**Slice 1:** No `customerSnapshotJson` on quote version (`01-slice-1-scope.md`).

---

## FlowGroup

| Field | Purpose | Req | Mutable | Validation | Lifecycle |
|-------|---------|-----|---------|------------|-----------|
| `id` | PK | always | no | opaque | always |
| `tenantId` | Scope | always | no | FK | always |
| `customerId` | Anchor | always | no | FK customer same tenant | always |
| `name` | Project/site label | always | yes | non-empty | always |
| `createdAt` | Audit | always | no | — | always |

**Deferred:** address normalization, external ids.

---

## ScopePacket

| Field | Purpose | Req | Mutable | Validation | Lifecycle |
|-------|---------|-----|---------|------------|-----------|
| `id` | PK | always | no | opaque | always |
| `tenantId` | Scope | always | no | FK | always |
| `packetKey` | Stable key | always | no | unique per tenant, slug-like | always |
| `displayName` | Catalog UI | always | yes | non-empty | always |

---

## ScopePacketRevision

| Field | Purpose | Req | Mutable | Validation | Lifecycle |
|-------|---------|-----|---------|------------|-----------|
| `id` | PK | always | no | opaque | always |
| `scopePacketId` | Parent | always | no | FK | always |
| `revisionNumber` | Ordering | always | no | int ≥ 1, unique per packet | always |
| `status` | Lifecycle | always | no* | enum: `published` only in Slice 1 seeds | always |
| `publishedAt` | Pin trust | always | no | ISO-8601 | always |

\* After publish: immutable row semantics (`04`).

---

## PacketTaskLine

| Field | Purpose | Req | Mutable | Validation | Lifecycle |
|-------|---------|-----|---------|------------|-----------|
| `id` | PK | always | no | opaque | always |
| `scopePacketRevisionId` | Parent | always | no | FK | always |
| `lineKey` | Stable within revision | always | no | unique per revision | always |
| `tierCode` | Variant (`epic 19`) | optional | no | string; null = all tiers / base | always |
| `sortOrder` | Expansion order | always | no | number | always |
| `lineKind` | EMBEDDED vs LIBRARY | always | no | enum | always |
| `embeddedPayloadJson` | Copy payload when EMBEDDED | draft/always | no | required if `lineKind = EMBEDDED` | always |
| `taskDefinitionId` | LIBRARY ref | optional | no | required if `lineKind = LIBRARY` | always |

**Slice 1 seeds:** Prefer `EMBEDDED` only to defer `TaskDefinition` table (`02`).

---

## WorkflowTemplate

| Field | Purpose | Req | Mutable | Validation | Lifecycle |
|-------|---------|-----|---------|------------|-----------|
| `id` | PK | always | no | opaque | always |
| `tenantId` | Scope | always | no | FK | always |
| `templateKey` | Stable key | always | no | unique per tenant | always |
| `displayName` | UI | always | yes | non-empty | always |

---

## WorkflowVersion

| Field | Purpose | Req | Mutable | Validation | Lifecycle |
|-------|---------|-----|---------|------------|-----------|
| `id` | PK | always | no | opaque | always |
| `workflowTemplateId` | Parent | always | no | FK | always |
| `versionNumber` | Ordering | always | no | int ≥ 1, unique per template | always |
| `status` | Publish gate | always | no* | `published` for Slice 1 pin | always |
| `publishedAt` | Trust | always | no | ISO-8601 | always |
| `snapshotJson` | Immutable graph | always | no* | validates: nodes, gates, skeleton tasks, completion rules (`epics 23–27`) | always |

\* Immutable after publish.

---

## Quote

| Field | Purpose | Req | Mutable | Validation | Lifecycle |
|-------|---------|-----|---------|------------|-----------|
| `id` | PK | always | no | opaque | always |
| `tenantId` | Scope | always | no | FK | always |
| `customerId` | Anchor | always | no | FK | always |
| `flowGroupId` | Anchor | always | no | FK | always |
| `quoteNumber` | Human-facing | always | yes | unique per tenant (or per company) | always |
| `createdAt` | Audit | always | no | — | always |

---

## QuoteVersion

| Field | Purpose | Req | Mutable | Validation | Lifecycle |
|-------|---------|-----|---------|------------|-----------|
| `id` | PK | always | no | opaque | always |
| `quoteId` | Parent | always | no | FK | always |
| `versionNumber` | Ordering | always | no | int ≥ 1, unique per quote | always |
| `status` | Draft/sent | always | no* after sent | enum: `draft` \| `sent` | always |
| `pinnedWorkflowVersionId` | Template pin | draft → send | no* after send | FK published workflow version | draft required before send |
| `title` | Optional label | optional | yes† | — | draft |
| `createdAt` | Audit | always | no | — | always |
| `createdById` | Actor | always | no | FK user | always |
| `sentAt` | Freeze moment | sent_only | no | ISO-8601 | send |
| `sentById` | Actor | sent_only | no | FK user | send |
| `sendClientRequestId` | Idempotency | optional | no | opaque, unique per version when set | send |
| `planSnapshotSha256` | Integrity | sent_only | no | hex 64 | send |
| `packageSnapshotSha256` | Integrity | sent_only | no | hex 64 | send |
| `generatedPlanSnapshot` | Frozen plan | sent_only | no | JSON v0 (`07`) | send |
| `executionPackageSnapshot` | Frozen package | sent_only | no | JSON v0 (`07`) | send |
| `composePreviewStalenessToken` | Preview vs draft | draft | yes | opaque; bumped on draft mutation (`05`) | draft |

† After send: immutable (`04`).

---

## ProposalGroup

| Field | Purpose | Req | Mutable | Validation | Lifecycle |
|-------|---------|-----|---------|------------|-----------|
| `id` | PK | always | no | opaque | always |
| `quoteVersionId` | Parent | always | no | FK | always |
| `name` | UI | always | yes† | non-empty | draft |
| `sortOrder` | Ordering | always | yes† | number | draft |

† After send: immutable. Slice 1: no new groups after send.

**Default:** One group `"Items"` auto-created with new draft version.

---

## QuoteLineItem

| Field | Purpose | Req | Mutable | Validation | Lifecycle |
|-------|---------|-----|---------|------------|-----------|
| `id` | PK | always | no | opaque | always |
| `quoteVersionId` | Parent | always | no | FK | always |
| `proposalGroupId` | Grouping | always | no* after send | FK same version | always |
| `sortOrder` | Grid order | always | yes† | number | draft |
| `scopePacketRevisionId` | Catalog pin | draft → send | no* after send | FK published revision; **null if** `quoteLocalPacketId` set | draft required before send for manifest lines (XOR) |
| `quoteLocalPacketId` | Local scope pin | draft → send | no* after send | FK `QuoteLocalPacket` same `quoteVersionId`; **null if** `scopePacketRevisionId` set | draft |
| `tierCode` | Variant (`epic 19`) | optional | yes† | string; must match packet tier rules | draft |
| `quantity` | Qty | draft → send | no* after send | number > 0 | draft |
| `executionMode` | SOLD vs MANIFEST stub | draft → send | no* after send | enum Slice 1 subset (`04`) | draft |
| `title` | Commercial | draft → send | no* after send | non-empty | draft |
| `description` | Commercial | optional | yes† | — | draft |
| `unitPriceCents` | Money display | optional | yes† | int ≥ 0 | draft |
| `lineTotalCents` | Denormalized | optional | yes† | int ≥ 0 | draft |

\* After send: row immutable (commercial frozen in place).

---

## AuditEvent (optional table)

| Field | Purpose | Req | Mutable | Validation | Lifecycle |
|-------|---------|-----|---------|------------|-----------|
| `id` | PK | always | no | opaque | append |
| `tenantId` | Scope | always | no | FK | always |
| `eventType` | Kind | always | no | e.g. `QUOTE_VERSION_SENT` | send |
| `actorId` | User | always | no | FK | send |
| `targetQuoteVersionId` | Subject | always | no | FK | send |
| `payloadJson` | Extra | optional | no | includes snapshot hashes | send |
| `createdAt` | Time | always | no | ISO-8601 | send |

**Slice 1 minimum:** `QuoteVersion.sentById/sentAt` + hashes **without** separate table is acceptable; table recommended if audit module is standard.

---

## JSON columns (not separate entities)

| Location | Field | Lifecycle |
|----------|-------|-----------|
| `WorkflowVersion` | `snapshotJson` | always at rest for published version |
| `QuoteVersion` | `generatedPlanSnapshot` | sent_only |
| `QuoteVersion` | `executionPackageSnapshot` | sent_only |

---

## Deferred fields (not Slice 1)

| Field / concept | Deferred to |
|-----------------|-------------|
| `StructuredInputAnswer.*` | Slice 2+ |
| `QuoteSignature.*` | Slice 2 |
| `customerSnapshotJson` | Optional later if legal needs frozen CRM |
| Runtime: `flowId`, `runtimeTaskId` on any quote row | Slice 2 |
| `LeadId` on quote | Later CRM slice |
