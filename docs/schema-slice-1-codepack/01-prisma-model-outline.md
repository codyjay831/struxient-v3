# Slice 1 — Prisma model outline (blueprint)

**Status:** Draft blueprint. **Not** the final `schema.prisma` file (see `03-prisma-schema-draft-v0.md`).  
**Authority:** `docs/schema-slice-1/*`, settled codepack defaults (EMBEDDED-only lines, strict warning ack, GET omits snapshots unless `include=snapshots`).

**Layered planning:** **`03-prisma-schema-draft-v0.md`** is the **base** Prisma paste. **`docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md`** is **normative** for **`PreJobTask`**, **`QuoteLocalPacket`**, **`QuoteLocalPacketItem`**, and the **complete** `QuoteLineItem` ↔ `QuoteLocalPacket` relation. Those entities are **first-class planned schema**, not speculative add-ons; the v0 file omits their `model` blocks to keep the initial paste small — **not** because they are optional product direction.

**Implementer read order:** `01-prisma-model-outline.md` (this file) → `03-prisma-schema-draft-v0.md` → `slice-1-extension-prejobtask-quotelocalpacket.md` → **`10-schema-merge-checklist.md`** (pre-merge verification) → decision packs.

---

## Global conventions

| Topic | Choice |
|-------|--------|
| Primary keys | `String` (cuid or uuid), `@id @default(cuid())` |
| Tenant scoping | Explicit `tenantId` on root-owned models; quote chain resolves tenant via `Quote.tenantId` |
| Timestamps | `DateTime` UTC; `@default(now())` where noted |
| JSON columns | Prisma `Json` type |
| Money | `Int` cents, nullable optional (`unitPriceCents`, `lineTotalCents`) |
| Partial unique (idempotency) | `sendClientRequestId` unique **per quote version when non-null** — may require **raw migration** SQL (Prisma has limited partial unique support) |

---

## Tenant

| Item | Specification |
|------|----------------|
| **Model** | `Tenant` |
| **Fields** | `id`, `name`, `createdAt` |
| **Required** | all |
| **Indexes** | primary `id` |
| **Relations** | `users`, `customers`, `scopePackets`, `workflowTemplates`, `quotes`, `auditEvents` |
| **Delete / update** | **Restrict** child deletes at app layer; Prisma default `Restrict` on FKs from children |
| **Immutability** | N/A (not quote send) |

---

## User

| Item | Specification |
|------|----------------|
| **Model** | `User` |
| **Fields** | `id`, `tenantId`, `email`, `displayName?`, `createdAt` |
| **Required** | `displayName` optional; rest required |
| **Unique** | `@@unique([tenantId, email])` |
| **Indexes** | `tenantId`, unique composite |
| **Relations** | `tenant`; optional reverse `createdQuotes` deferred — Slice 1 uses `createdById` / `sentById` on `QuoteVersion` only |
| **Delete** | **Restrict** if referenced by `QuoteVersion.createdById` / `sentById` (or `SetNull` if policy allows orphan actors — **Slice 1:** **Restrict** send actor rows) |

---

## Customer

| Item | Specification |
|------|----------------|
| **Model** | `Customer` |
| **Fields** | `id`, `tenantId`, `name`, `billingAddressJson?`, `createdAt`, `updatedAt` |
| **Required** | `billingAddressJson` optional |
| **Indexes** | `@@index([tenantId])` |
| **Relations** | `tenant`, `flowGroups`, `quotes` |
| **Delete** | **Restrict** if `quotes` exist (app + FK) |

---

## FlowGroup

| Item | Specification |
|------|----------------|
| **Model** | `FlowGroup` |
| **Fields** | `id`, `tenantId`, `customerId`, `name`, `createdAt` |
| **Indexes** | `@@index([tenantId])`, `@@index([customerId])` |
| **Relations** | `tenant`, `customer`, `quotes` |
| **Delete** | **Restrict** if quotes reference |

---

## ScopePacket

| Item | Specification |
|------|----------------|
| **Model** | `ScopePacket` |
| **Fields** | `id`, `tenantId`, `packetKey`, `displayName` |
| **Unique** | `@@unique([tenantId, packetKey])` |
| **Indexes** | `tenantId` |
| **Relations** | `tenant`, `revisions` |
| **Delete** | **Restrict** if revisions/lines referenced by line items (app); FK from `ScopePacketRevision` |

---

## ScopePacketRevision

| Item | Specification |
|------|----------------|
| **Model** | `ScopePacketRevision` |
| **Fields** | `id`, `scopePacketId`, `revisionNumber`, `status` (enum), `publishedAt` |
| **Unique** | `@@unique([scopePacketId, revisionNumber])` |
| **Indexes** | `scopePacketId`, `@@index([status])` |
| **Relations** | `scopePacket`, `packetTaskLines`, `quoteLineItems` (reverse) |
| **Update** | After `PUBLISHED`, treat as **immutable** in app (no Prisma-level enforcement) |
| **Delete** | **Restrict** if any `QuoteLineItem` references |

---

## PacketTaskLine

| Item | Specification |
|------|----------------|
| **Model** | `PacketTaskLine` |
| **Fields** | `id`, `scopePacketRevisionId`, `lineKey`, `tierCode?`, `sortOrder`, `lineKind` (enum), `embeddedPayloadJson` |
| **Codepack default** | **EMBEDDED-only:** seeds and app **must** set `lineKind = EMBEDDED` and non-null `embeddedPayloadJson`. **No** `TaskDefinition` / `taskDefinitionId` in Slice 1 schema. |
| **Unique** | `@@unique([scopePacketRevisionId, lineKey])` |
| **Indexes** | `scopePacketRevisionId` |
| **Relations** | `scopePacketRevision` |
| **Immutability** | Immutable under published revision (app) |

---

## WorkflowTemplate

| Item | Specification |
|------|----------------|
| **Model** | `WorkflowTemplate` |
| **Fields** | `id`, `tenantId`, `templateKey`, `displayName` |
| **Unique** | `@@unique([tenantId, templateKey])` |
| **Relations** | `tenant`, `versions` |
| **Delete** | **Restrict** if versions pinned |

---

## WorkflowVersion

| Item | Specification |
|------|----------------|
| **Model** | `WorkflowVersion` |
| **Fields** | `id`, `workflowTemplateId`, `versionNumber`, `status` (enum), `publishedAt`, `snapshotJson` |
| **Unique** | `@@unique([workflowTemplateId, versionNumber])` |
| **Indexes** | `workflowTemplateId`, `status` |
| **Relations** | `workflowTemplate`, `pinnedQuoteVersions` (QuoteVersion[]) |
| **Immutability** | After `PUBLISHED`, row **immutable** (app); `snapshotJson` never updated |

---

## Quote

| Item | Specification |
|------|----------------|
| **Model** | `Quote` |
| **Fields** | `id`, `tenantId`, `customerId`, `flowGroupId`, `quoteNumber`, `createdAt` |
| **Unique** | `@@unique([tenantId, quoteNumber])` |
| **Indexes** | `tenantId`, `customerId`, `flowGroupId` |
| **Relations** | `tenant`, `customer`, `flowGroup`, `versions` |
| **After send** | Shell remains **mutable** per design pack (`quoteNumber` etc.) — **Slice 1 app** may still restrict edits for UX; not a DB invariant |

---

## QuoteVersion

| Item | Specification |
|------|----------------|
| **Model** | `QuoteVersion` |
| **Fields** | `id`, `quoteId`, `versionNumber`, `status` (enum), `pinnedWorkflowVersionId?`, `title?`, `createdAt`, `createdById`, `sentAt?`, `sentById?`, `sendClientRequestId?`, `planSnapshotSha256?`, `packageSnapshotSha256?`, `generatedPlanSnapshot?` (Json), `executionPackageSnapshot?` (Json), `composePreviewStalenessToken?` |
| **Semantics** | `composePreviewStalenessToken` **non-null** while `DRAFT`; set **`null`** when `SENT`. |
| **Unique** | `@@unique([quoteId, versionNumber])` |
| **Indexes** | `quoteId`, `status`, `pinnedWorkflowVersionId`, `@@index([sentAt])` optional |
| **Relations** | `quote`, `pinnedWorkflowVersion`, `createdBy`, `sentBy`, `proposalGroups`, `quoteLineItems`, `auditEvents` |
| **Delete** | **Forbidden** after `SENT` (app); Prisma may allow — enforce in service |
| **After send** | **Immutable:** `versionNumber`, `status`, `pinnedWorkflowVersionId`, `title`, freeze columns, hashes, snapshots; **no** transition to `DRAFT` |

---

## ProposalGroup

| Item | Specification |
|------|----------------|
| **Model** | `ProposalGroup` |
| **Fields** | `id`, `quoteVersionId`, `name`, `sortOrder` |
| **Indexes** | `@@index([quoteVersionId])` |
| **Relations** | `quoteVersion`, `quoteLineItems` |
| **After send** | **No** insert/update/delete for that `quoteVersionId` |

---

## QuoteLineItem

| Item | Specification |
|------|----------------|
| **Model** | `QuoteLineItem` |
| **Fields** | `id`, `quoteVersionId`, `proposalGroupId`, `sortOrder`, `scopePacketRevisionId?`, `quoteLocalPacketId?`, `tierCode?`, `quantity` (Int), `executionMode` (enum), `title`, `description?`, `unitPriceCents?`, `lineTotalCents?` |
| **Constraints** | `quantity > 0`; manifest lines: **exactly one** of `scopePacketRevisionId` / `quoteLocalPacketId` non-null (`04-slice-1-relations-and-invariants.md`) — enforce in app or DB check |
| **Indexes** | `@@index([quoteVersionId])`, `@@index([proposalGroupId])`, `@@index([scopePacketRevisionId])`, `@@index([quoteLocalPacketId])` |
| **Relations** | `quoteVersion`, `proposalGroup`, `scopePacketRevision?`, **`quoteLocalPacket?`** — parent **`QuoteLocalPacket` model and `@relation` live in extension doc**; v0 Prisma paste may list `quoteLocalPacketId` **without** relation until merged (**staged syntax**, settled semantics) |
| **After send** | **Row immutable**; no delete |

---

## AuditEvent

| Item | Specification |
|------|----------------|
| **Model** | `AuditEvent` |
| **Fields** | `id`, `tenantId`, `eventType` (enum), `actorId`, `targetQuoteVersionId`, `payloadJson?`, `createdAt` |
| **Indexes** | `@@index([tenantId, createdAt])`, `@@index([targetQuoteVersionId])` |
| **Relations** | `tenant`, `actor`, `targetQuoteVersion` |
| **Mutability** | **Append-only** |
| **When** | Insert **one** row on successful send (`QUOTE_VERSION_SENT`) inside same transaction as freeze |

---

## Slice 1 extension models (normative; not in v0 Prisma paste)

The following are **planned relational schema for Slice 1** per extension + decision packs. They are **omitted from `03-prisma-schema-draft-v0.md`** to keep the first paste minimal; **merge** their Prisma shapes from **`docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md`** when implementing:

- **`PreJobTask`** (`flowGroupId` required, `quoteVersionId` optional)
- **`QuoteLocalPacket`** (`quoteVersionId` required)
- **`QuoteLocalPacketItem`**

**Not deferred product decisions** — only **deferred in the v0 code block**.

---

## Deferred (Slice 2+ — do not model in Slice 1)

`TaskDefinition`, `QuoteSignature`, `Job`, `Flow`, `Activation`, `RuntimeTask`, `TaskExecution`, `StructuredInputAnswer`, payments, portal.

---

## Summary: immutability after send

| Model | Rule |
|-------|------|
| `QuoteVersion` (sent) | No mutation of commercial + pin + freeze fields |
| `ProposalGroup` | No CUD |
| `QuoteLineItem` | No update/delete |
| `generatedPlanSnapshot` / `executionPackageSnapshot` | Never update |
| `AuditEvent` | Insert only |
