# Struxient v3 — First schema slice (recommendation)

**Goal:** Smallest relational footprint that supports **vertical slice V2 (freeze send)** and can grow to **activation** without rewriting identity.  
**Not included here:** Prisma/SQL — **entity list + invariants only**.  
**Tied to:** `02-vertical-slices.md` (ship **V2**), `planning/03-schema-planning-pack.md`, `planning/06-schema-planning-open-issues.md` (**O12**).

---

## Decision: hybrid freeze storage for slice 1

**Relational:** everything that powers **editing**, **indexing**, and **foreign keys** (customers, quotes, lines, pins).  
**JSON blobs on `QuoteVersion` (sent-only):** `generatedPlanSnapshot`, `executionPackageSnapshot` — **semantic** content per `canon/03–04` (`planning/03` hybrid recommendation).

**Why:** Unblocks **compose** + **immutability** immediately; **defers O12 normalization** without changing canon meaning. Plan to extract hot fields later (nodeId, source) if reporting demands.

---

## Entities in schema slice 1 (in dependency order)

### A) Platform / tenancy

| Entity | Minimum fields / notes |
|--------|-------------------------|
| **Tenant** | `id`, name/slug, status |
| **User** | `id`, `tenantId`, email, auth subject linkage |
| **UserTenantMembership** (if needed) | roles as **string[] v0** or join to `Role` later (`epic 59` — **stub** single admin role if required) |

---

### B) CRM anchors (Phase 1)

| Entity | Minimum fields / notes |
|--------|-------------------------|
| **Customer** | `id`, `tenantId`, type, display identity fields per `epic 02` |
| **FlowGroup** | `id`, `tenantId`, `customerId`, site address fields or `addressTbd` flag per `epic 03` |

**Defer:** `Lead`, `Contact`, `ContactMethod` tables until after **V2** ships (optional).

---

### C) Catalog pin targets (Phase 2 — can be seeded)

| Entity | Minimum fields / notes |
|--------|-------------------------|
| **ScopePacket** | `id`, `tenantId`, stable `packetKey` |
| **ScopePacketRevision** | `id`, `scopePacketId`, `revision`, `status=published`, timestamps |
| **PacketTaskLine** | `id`, `scopePacketRevisionId`, `targetNodeId`, line payload (embedded vs definition ref) per `epic 16` |
| **TaskDefinition** (optional in slice 1) | Only if first packet uses **LIBRARY** lines; else **defer** and use **embedded** lines only for fastest start |

| Entity | Minimum fields / notes |
|--------|-------------------------|
| **WorkflowTemplate** | `id`, `tenantId`, name |
| **WorkflowVersion** | `id`, `workflowTemplateId`, `version`, `status=published`, **`snapshotJson`** (nodes, gates, skeleton tasks, completion rules) per `epic 23–27` |

**Defer:** full draft/publish workflow tables if you import snapshots via admin seed.

---

### D) Quote draft + freeze shell (Phase 3–4)

| Entity | Minimum fields / notes |
|--------|-------------------------|
| **Quote** | `id`, `tenantId`, `customerId`, `flowGroupId`, `quoteNumber`, `currentVersionId?` |
| **QuoteVersion** | `id`, `quoteId`, `versionNumber`, `status`, `currency`, **`workflowVersionId` pin**, `createdAt`, **`generatedPlanSnapshot` nullable**, **`executionPackageSnapshot` nullable**, `sentAt` nullable, integrity hashes optional |
| **QuoteLineItem** | `id`, `quoteVersionId`, order key, commercial fields, **`scopePacketRevisionId`?** / **`quoteLocalPacketId`?** (manifest scope **XOR** per `04` / `planning/01`), tier, qty, execution mode per `epic 09` |
| **ProposalGroup** (optional) | **Omit** in slice 1 if single implicit group; add when UI needs sections (`epic 10`) |

---

## Explicitly OUT of first schema slice

| Entity | Why out |
|--------|---------|
| **Job**, **Flow**, **RuntimeTask**, **TaskExecution** | Not needed to **send**; add for **V4/V5** (`01-v3-build-sequence.md`). |
| **Activation** | After runtime exists. |
| **Signature** | Needed for **V3** — add **immediately after** slice 1 if milestone combines send+sign; otherwise **slice 1b** table. |
| **PaymentGate\*** | Phase 9 unless wedge requires (`01`). |
| **ScheduleBlock** | Non-authoritative; later. |
| **Notes/Files polymorphic tables** | Stub later (`epics 05–06`). |

---

## Slice 1 completion criteria (schema-level)

- You can **insert** a published **packet revision** + **workflow version** snapshot **without** quote UI.
- You can **create** a **draft** `QuoteVersion` with **line items** whose manifest scope uses **`scopePacketRevisionId` *or* `quoteLocalPacketId`** (exactly one when required).
- You can **atomically** flip version to **`sent`** and persist **non-null** `generatedPlanSnapshot` + `executionPackageSnapshot` blobs **plus** pin `workflowVersionId` used for compose.
- **Unique constraints** exist for: `quoteId+versionNumber`, `quoteNumber` per tenant (per epic rules).

---

## Next schema slice (preview — do not build first)

**Slice 2: Execution birth**

- `Job`, `Flow`, `Activation`, `RuntimeTask`, `TaskExecution` (+ `QuoteSignature` if not already).

This order prevents building execution tables before **freeze semantics** exist — a common source of **orphan** runtime rows in greenfield projects.
