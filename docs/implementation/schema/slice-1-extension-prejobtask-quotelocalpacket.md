# Slice 1 schema extension — PreJobTask & QuoteLocalPacket

**Status:** **Normative extension** of Slice 1 relational planning. **Not** application Prisma in repo root; **planning / merge instructions** for `schema.prisma`.  
**Authority:** Canon + main epics (post-integration) + `docs/implementation/decision-packs/prejobtask-schema-decision-pack.md` + `quotelocalpacket-schema-decision-pack.md`.

**This document is authoritative** for **`PreJobTask`**, **`QuoteLocalPacket`**, **`QuoteLocalPacketItem`**, and the **relational completion** of manifest scope XOR on **`QuoteLineItem`** (including the **`quoteLocalPacket` Prisma `@relation`**). It does **not** replace `docs/schema-slice-1/*` invariants; it **augments** the base codepack draft.

---

## Relationship to `03-prisma-schema-draft-v0.md` (layered schema)

| Question | Answer |
|----------|--------|
| Is the v0 Prisma draft the whole schema story? | **No.** V0 is a **minimal base paste** (`docs/schema-slice-1-codepack/03-prisma-schema-draft-v0.md`). |
| Where do `QuoteLocalPacket` / `PreJobTask` models live? | **Here** (extension) + decision packs. Merge illustrative Prisma from this file into your real `schema.prisma`. |
| Is `quoteLocalPacketId` a real intended column? | **Yes** when using quote-local scope. V0 may show the column **before** the `@relation` block exists — **staged syntax**; semantics are **settled** (XOR with `scopePacketRevisionId`, same `quoteVersionId` chain). |
| Read order | `01-prisma-model-outline.md` → `03-prisma-schema-draft-v0.md` → **this extension** → `docs/schema-slice-1-codepack/10-schema-merge-checklist.md` → decision packs. |

---

## Purpose

Extend the **Slice 1** relational model so that:

1. **Pre-quote operational work** has a persistent home **without** `Job` / `Flow` / `RuntimeTask`.
2. **Quote-local scope** (fork + AI + manual local) has **version-scoped** rows + **child lines** consumable by compose/send.

**Slice 1 strict product scope** (`01-slice-1-scope.md`) may still ship **without** UI for these features in the first demo; this document defines **where** they attach so later slices do not collapse layers.

---

## Relationship map (delta)

```
Tenant
  └── FlowGroup
        └── PreJobTask*                    ← NEW (pre-activation only)

  └── Quote → QuoteVersion
        └── QuoteLocalPacket*              ← NEW (draft + sent immutable)
              └── QuoteLocalPacketItem*

        └── QuoteLineItem
              ├── scopePacketRevisionId?   ← existing (catalog)
              └── quoteLocalPacketId?      ← NEW (XOR with catalog pin)
```

**Unchanged:** No FK from these new entities to `Flow`, `Job`, `RuntimeTask` (still Slice 2+).

---

## Entity: `PreJobTask`

### Prisma-planning shape (illustrative)

```prisma
enum PreJobTaskStatus {
  OPEN
  READY
  IN_PROGRESS
  BLOCKED
  DONE
  CANCELLED
}

model PreJobTask {
  id        String   @id @default(cuid())
  tenantId  String
  flowGroupId String

  quoteVersionId String?  // optional context; same FlowGroup as Quote

  taskType   String      // or enum / registry table later
  sourceType String      // MANUAL | LEAD_CONVERSION | IMPORT | ...

  title       String
  description String?

  assignedToUserId String?
  createdById      String

  dueAt              DateTime?
  scheduledStartAt   DateTime?
  scheduledEndAt     DateTime?

  status       PreJobTaskStatus
  startedAt    DateTime?
  completedAt  DateTime?
  cancelledAt  DateTime?
  cancelReason String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  flowGroup    FlowGroup     @relation(fields: [flowGroupId], references: [id], onDelete: Restrict)
  quoteVersion QuoteVersion? @relation(fields: [quoteVersionId], references: [id], onDelete: SetNull)
  // User FKs: assignee, creator — match existing User model naming

  @@index([tenantId, flowGroupId, status])
  @@index([tenantId, assignedToUserId, status])
}
```

### Tenant / parent checks

- `tenantId` must equal `flowGroup.tenantId` (DB check or transaction guard).  
- If `quoteVersionId` set: `quoteVersion.quote.flowGroupId === flowGroupId`.

### Indexes

- `(flowGroupId, status)` for project timeline.  
- `(assignedToUserId, status)` for Work Station feed.

---

## Entity: `QuoteLocalPacket`

### Prisma-planning shape (illustrative)

```prisma
enum QuoteLocalPacketOrigin {
  FORK_FROM_LIBRARY
  AI_DRAFT
  MANUAL_LOCAL
}

enum QuoteLocalPromotionStatus {
  NONE
  REQUESTED
  IN_REVIEW
  REJECTED
  COMPLETED
}

model QuoteLocalPacket {
  id             String   @id @default(cuid())
  tenantId       String
  quoteVersionId String

  displayName    String
  description    String?

  originType QuoteLocalPacketOrigin
  forkedFromScopePacketRevisionId String?
  aiProvenanceJson               Json?     // or aiDraftJobId FK when that table exists

  promotionStatus     QuoteLocalPromotionStatus @default(NONE)
  promotedScopePacketId String?

  createdById String
  updatedById String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  quoteVersion QuoteVersion @relation(fields: [quoteVersionId], references: [id], onDelete: Cascade)
  forkedFrom   ScopePacketRevision? @relation(fields: [forkedFromScopePacketRevisionId], references: [id], onDelete: SetNull)
  items        QuoteLocalPacketItem[]

  @@index([quoteVersionId])
  @@index([tenantId, quoteVersionId])
}
```

**Delete behavior:** `onDelete: Cascade` from `QuoteVersion` only if product allows **hard delete** of draft versions; if versions are never deleted, use **Restrict** and soft-delete patterns. **Sent** versions must not delete packets (version immutable).

---

## Entity: `QuoteLocalPacketItem`

Mirror **`PacketTaskLine`** semantics for compose (see `03-slice-1-field-definitions.md`).

```prisma
enum QuoteLocalPacketLineKind {
  EMBEDDED
  LIBRARY
}

model QuoteLocalPacketItem {
  id                 String @id @default(cuid())
  quoteLocalPacketId String

  lineKey   String
  sortOrder Int
  tierCode  String?  // optional variant filter when line applies to tier

  lineKind QuoteLocalPacketLineKind
  embeddedPayloadJson Json?
  taskDefinitionId    String?

  targetNodeKey String  // stable node id/key from pinned WorkflowVersion.snapshotJson

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  quoteLocalPacket QuoteLocalPacket @relation(fields: [quoteLocalPacketId], references: [id], onDelete: Cascade)
  taskDefinition   TaskDefinition? @relation(fields: [taskDefinitionId], references: [id], onDelete: SetNull)

  @@unique([quoteLocalPacketId, lineKey])
  @@index([quoteLocalPacketId, sortOrder])
}
```

**Note:** `targetNodeKey` type should match how `PacketTaskLine` references nodes in Slice 1 seeds (string key vs internal node id — align with `WorkflowVersion.snapshotJson` schema).

---

## `QuoteLineItem` extension

Add nullable:

- `quoteLocalPacketId String?` with FK to `QuoteLocalPacket`.

### XOR invariant (compose + send)

For rows where `executionMode` implies manifest scope:

- `(scopePacketRevisionId != null) XOR (quoteLocalPacketId != null)` — **exactly one**.

Update **`04-slice-1-relations-and-invariants.md`** mentally: packet revision pinning section becomes **“scope pin: library revision OR local packet”**.

### Immutability after send

When `QuoteVersion.status = sent`:

- No insert/update/delete on `QuoteLocalPacket` / `QuoteLocalPacketItem` for that version.  
- Same class of rule as `QuoteLineItem` immutability.

---

## Compose engine (planning note)

1. Resolve each manifest line:  
   - If `scopePacketRevisionId` → existing path (`PacketTaskLine` filtered by tier).  
   - If `quoteLocalPacketId` → expand **`QuoteLocalPacketItem`** with same tier filtering rules as catalog (if `tierCode` null = all).  
2. **Plan task id determinism** must incorporate **local** `lineKey` + `quoteLocalPacketId` + line item id + quantity index so local forks do not collide with library-derived ids.  
3. **Source classification** in plan rows: e.g. `BUNDLE_LOCAL` (per epic 31) vs `BUNDLE`.

---

## Work Station (planning note)

- Query `PreJobTask` where `assignedToUserId = currentUser` and `status IN (READY, IN_PROGRESS)` and `tenantId` scoped.  
- **Do not** union PreJobTask into `RuntimeTask` table; union at **read/API** layer if needed.

---

## Drift risks spotted in current Slice 1 docs

| Risk | Location | Mitigation |
|------|----------|------------|
| **QV-5 / packet pinning** assumed only `scopePacketRevisionId` | `04-slice-1-relations-and-invariants.md` §Packet revision pinning | **Mitigated:** XOR + compose/snapshot rules in `04`, `05`, `06`, `07`, `planning/01` §6. |
| **Entity list** omits PreJob / local packet | `02-slice-1-entity-list.md` | **Mitigated:** entity rows added; keep in sync with decision packs. |
| **Builder summary** says no leads/AI | `12-slice-1-builder-summary.md` | Clarify schema **may** land before UI; Slice 1 demo can still skip UI. |

---

## Files to read together

- `docs/schema-slice-1/03-slice-1-field-definitions.md` — QuoteVersion, QuoteLineItem, PacketTaskLine.  
- `docs/schema-slice-1/04-slice-1-relations-and-invariants.md` — immutability, pinning.  
- `docs/planning/01-id-spaces-and-identity-contract.md` — plan task id rules (**§6** library + quote-local).  
- Decision packs in `docs/implementation/decision-packs/`.

---

## Explicit non-goals (this extension)

- No **RuntimeTask** or **TaskExecution** rows for PreJobTask.  
- No **promotion** implementation — only **columns** for workflow.  
- No replacement of JSON snapshots with normalized plan tables.
