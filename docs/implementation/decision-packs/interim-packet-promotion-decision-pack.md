# Interim packet promotion — decision pack (consolidated)

**Status:** Canon-authorized planning truth for the **first promotion implementation epic**. Decision-focused; not an implementation spec.
**Authority:** `docs/canon/05-packet-canon.md` ("Canon amendment — interim one-step promotion"), `docs/epics/15-scope-packets-epic.md` §17 + §25a, `docs/epics/16-packet-task-lines-epic.md` §6 + §16a, `docs/implementation/decision-packs/quotelocalpacket-schema-decision-pack.md` ("Interim one-step promotion flow"), `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md` ("Addendum — interim promotion slice").

---

## 1. Purpose

Consolidate the narrow set of decisions that unblock the first promotion implementation epic without widening scope. This doc is **planning truth**, not a migration or code plan.

---

## 2. Scope boundary

**In scope for the interim slice:**

- Estimator-triggered one-step promotion from `QuoteLocalPacket` to a new `ScopePacket` + first `DRAFT` `ScopePacketRevision`.
- 1:1 row copy of `QuoteLocalPacketItem` → `PacketTaskLine`.
- `QuoteLocalPacket.promotionStatus = COMPLETED` on success; `promotedScopePacketId` set.
- Two schema amendments: `ScopePacketRevision.publishedAt` nullable; `PacketTaskLine.targetNodeKey` top-level required column.

**Out of scope (preserved as deferred, not deleted):**

- Admin-review queue / UI / reviewer assignment.
- `REQUESTED` / `IN_REVIEW` / `REJECTED` state transitions (enum values remain reserved).
- `DRAFT` → `PUBLISHED` publish workflow for revisions produced by the interim flow.
- `ScopePacket.status` as a top-level column.
- `PacketTier` normalized dimension.
- Cross-tenant promotion.
- Frequency-heuristic or AI-initiated auto-promotion.

---

## 3. Canonical promotion flow (interim)

1. Estimator triggers "Promote to Global Library" on a `QuoteLocalPacket` and supplies a **`packetKey`** (slug).
2. Server validates `packetKey` uniqueness within tenant (`@@unique([tenantId, packetKey])`). Duplicate → reject; no partial write.
3. Server creates a new `ScopePacket` (tenant-scoped) with the supplied key.
4. Server creates a first `ScopePacketRevision` (`revisionNumber = 1`) with `status = DRAFT` and `publishedAt = null`.
5. Server copies every `QuoteLocalPacketItem` into a corresponding `PacketTaskLine` on the new revision per the mapping contract (§4).
6. Server sets `QuoteLocalPacket.promotionStatus = COMPLETED` and `promotedScopePacketId = <new ScopePacket.id>`.
7. No admin queue row created. No publish transition. Source packet otherwise unchanged.

**Idempotency:** A `QuoteLocalPacket` already `COMPLETED` cannot be promoted again.

**Transactional expectation:** All row writes occur in one DB transaction; a failure reverts all of them.

---

## 4. Transform contract: `QuoteLocalPacketItem` → `PacketTaskLine`

| Source column | Target column | Rule |
|---|---|---|
| `lineKey` | `lineKey` | verbatim |
| `sortOrder` | `sortOrder` | verbatim |
| `tierCode` | `tierCode` | verbatim (nullable) |
| `lineKind` | `lineKind` | enum value preserved (`EMBEDDED` / `LIBRARY`) |
| `embeddedPayloadJson` | `embeddedPayloadJson` | deep copy |
| `taskDefinitionId` | `taskDefinitionId` | verbatim (nullable) |
| `targetNodeKey` | `targetNodeKey` | verbatim — requires the new top-level `PacketTaskLine.targetNodeKey` column |

**No field transformation, no merging, no reordering.** The new revision is a faithful snapshot at promotion time. Later edits on either side do not retroactively propagate.

---

## 5. `packetKey` policy

- **Source:** estimator-supplied at promotion time.
- **Validation:** server-validated; unique per tenant; slug-like regex (matches existing `ScopePacket.packetKey` rule in `docs/schema-slice-1/03-slice-1-field-definitions.md`).
- **Collision handling:** duplicate key → promotion rejected with a structured error; UI prompts re-entry. No auto-suffixing.
- **Immutability:** once the `ScopePacket` row exists, `packetKey` is immutable.

---

## 6. Schema changes authorized (canon-scoped)

| Change | Scope | Rationale |
|---|---|---|
| `ScopePacketRevision.publishedAt` → nullable (`DateTime?`) | Prisma + migration | Admits `DRAFT` revisions produced by interim flow. |
| `PacketTaskLine.targetNodeKey` → top-level required `String` | Prisma + migration; backfill from `embeddedPayloadJson` or declare `NOT NULL` directly on seed-only datasets | Parity with `QuoteLocalPacketItem.targetNodeKey`; enables the 1:1 copy contract. |

**No other schema changes** are authorized by the canon pass. `ScopePacket.status`, `PacketTier`, admin-review tables, and the `QuoteLocalPromotionStatus` enum shape are deferred.

**Backfill expectation for `targetNodeKey`:** If pre-existing `PacketTaskLine` rows encoded the value inside `embeddedPayloadJson`, the migration extracts it into the new column before tightening to `NOT NULL`. If no production rows exist yet (seed-only catalog), the migration may add the column as `NOT NULL` directly. Exact strategy is deferred to the implementation epic.

---

## 7. Consumer invariants preserved during the interim slice

- **Picker filter:** Library packet pickers, quote line pickers, and AI grounding sources **must** filter to `ScopePacketRevision.status = PUBLISHED`. Revisions produced by the interim flow are `DRAFT` and must not appear.
- **Send/freeze:** Unchanged. `QuoteLineItem.scopePacketRevisionId` continues to pin a `PUBLISHED` revision; the interim flow does not change which revisions are selectable.
- **Execution truth:** Unchanged. Promotion writes catalog rows only; it does not touch plan, package, runtime, or audit state.

---

## 8. Open questions explicitly out of scope for this pass

- Exact admin-review epic shape (reviewer assignment, notifications, diff UX).
- Whether promoted `DRAFT` revisions should appear to admins in a dedicated view before the full queue lands.
- Tier expansion behavior when the source `QuoteLocalPacket` has tiered items.
- Learning signals that might suggest promotion (epic 52 territory).

---

## 9. What must not happen in the interim slice

- Silent publishing of promoted revisions.
- Auto-promotion by AI or frequency heuristic.
- Duplicate `packetKey` acceptance via server-side rewrite.
- Mutation of the source `QuoteLocalPacket` beyond `promotionStatus` and `promotedScopePacketId`.
- Surfacing `DRAFT` revisions in consumer pickers or quote line-item pickers.
- Removing, renaming, or widening the `QuoteLocalPromotionStatus` enum.
- Adding `ScopePacket.status` as a column.

---

## 10. Ready-to-build signal

All canon/planning/schema truth required to build the interim one-step promotion is now explicit and cross-linked. The next implementation epic — **"Interim one-step promotion for `QuoteLocalPacket` (authorize `ScopePacketRevision.publishedAt` nullable + `PacketTaskLine.targetNodeKey` top-level)"** — may proceed.
