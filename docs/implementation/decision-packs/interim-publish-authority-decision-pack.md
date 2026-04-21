# Interim publish authority — decision pack (consolidated)

**Status:** Canon-authorized planning truth for the **first publish implementation epic**. Decision-focused; not an implementation spec.
**Authority:** `docs/canon/05-packet-canon.md` ("Canon amendment — interim publish authority"), `docs/epics/15-scope-packets-epic.md` §16 + §17 + §20 + §25a, `docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md` ("Out of scope" §27 — this pack lifts that one item, nothing more).

---

## 1. Purpose

Resolve the **smallest missing canon truth** that today blocks any `DRAFT` → `PUBLISHED` transition for `ScopePacketRevision`. After the interim promotion epic, the `LINE_SCOPE_REVISION_NOT_PUBLISHED` enforcement epic, and the publish-readiness inspection epic, every technical substrate exists; only canon authorization is missing. This pack supplies that authorization in the most narrow form possible so a single follow-up code epic can ship a transactional publish mutation **and nothing else**.

This doc is **planning truth**, not a migration or code plan.

---

## 2. Scope boundary

**In scope for this canon decision pass (resolved here):**

- Authority for advancing a `DRAFT` `ScopePacketRevision` to `PUBLISHED` in the interim slice.
- Mandatory preflight contract that the publish writer must satisfy.
- Multi-`PUBLISHED` policy per `ScopePacket`.
- Canonical `publishedAt` truth on publish.

**Out of scope (preserved as deferred, not deleted):**

- Admin-review queue / UI / reviewer assignment.
- `REQUESTED` / `IN_REVIEW` / `REJECTED` transitions (enum values remain reserved for the deferred workflow per `interim-packet-promotion-decision-pack.md` §26).
- DRAFT-revision editing (catalog-side packet metadata edits, `PacketTaskLine` CRUD).
- Re-promotion / "fix and re-promote" recovery (canon-05 §153 forbids re-promotion; that is a separate decision pack).
- `ScopePacket.status` (deferred per epic 15 §17 and `interim-packet-promotion-decision-pack.md` §28).
- `PacketTier` normalized dimension.
- Archive / deprecate / un-publish / rollback / supersede semantics.
- Cross-tenant sharing.
- Revision diff workflow.
- Quote-side packet picker UI (canon §157 / §161 already pre-decides the consumer filter).
- Auto-publish, AI-initiated publish, frequency-heuristic publish.
- Schema changes of any kind (`prisma/schema.prisma` is not modified by the epic this pack authorizes).

---

## 3. Canonical publish flow (interim)

1. An office user with the `office_mutate` capability invokes the publish action against a specific `ScopePacketRevision` they own (tenant-scoped).
2. Server loads the revision and its `PacketTaskLine` set in a single transaction.
3. Server asserts the **mandatory preflight contract** (§5). Any failure → structured rejection; no partial write.
4. Server writes exactly two field updates on the revision row: `status = PUBLISHED` and `publishedAt = NOW()` (server transaction time). No other fields are touched. No new revision is created. No child rows are written.
5. Source `QuoteLocalPacket` is **not** touched (its `promotionStatus = COMPLETED` and `promotedScopePacketId` were already set by promotion; publish does not re-enter that flow).
6. No admin queue row is created. No notifications are sent. No audit-trail entries beyond what the existing tenant-write audit pattern produces.

**Idempotency:** A revision already in `PUBLISHED` cannot be published again. The mutation rejects with a structured error; it is not a silent no-op.

**Transactional expectation:** Preflight read, invariant check, and the two-field update occur in one DB transaction. A failure reverts the update.

---

## 4. Authority decision

**Decision (interim canon):** **Same office user (`office_mutate` capability) who promoted the revision — or any user on the same tenant holding `office_mutate`** — may publish a tenant-owned DRAFT revision in the interim slice.

**Why this option (and not the alternatives):**

- **Option (a) — same `office_mutate` capability used by promotion: chosen.** This is the disciplined parallel to the existing interim-promotion decision: promotion itself is a one-step compaction of the deferred admin-reviewed flow and uses `office_mutate` (`interim-packet-promotion-decision-pack.md` §3, §10). The interim publish action is the symmetrical second half of the same compaction. Reusing the same capability avoids introducing a second authorization concept inside an interim slice that will be entirely re-shaped when the admin-review epic lands.
- **Option (b) — distinct `catalog.publish` capability: rejected for the interim slice.** Epic 15 §20 names `catalog.publish` as the **target** capability. Introducing it now requires (i) extending `ApiCapability` in `src/lib/auth/api-principal.ts` (today: `read | office_mutate | field_execute`), (ii) deciding role-to-capability assignment, and (iii) UI affordances for granting it. All three are admin-review-epic-shaped decisions. Adding the capability now would prejudge the admin-review workflow.
- **Option (c) — no interim publish authority at all: rejected.** This was the canon position before this pack. The investigation (transcript: [Investigate publish next step](c3ea4979-7511-4470-a407-17c081d16fb2)) established that all technical substrate is in place and that the dead-end loop (DRAFT promoted → readiness predicate green → no path forward) now imposes real cost on estimators. Continuing to defer would either force estimators to do nothing with promoted packets, or pressure them to bypass canon. The smallest disciplined fix is to authorize an interim publish path, not to keep deferring.

**Sunset clause (binding):** When the admin-review epic lands, the publish authority shifts to `catalog.publish` (per epic 15 §20) or whatever capability that epic names. The interim `office_mutate` authority is **explicitly temporary** — the same compaction-of-future-canon pattern as interim promotion. The follow-up code epic must comment its capability check accordingly so the swap is mechanical.

**What this decision does not authorize:**

- Field users (`field_execute`) publishing.
- Cross-tenant publish (revision must belong to a `ScopePacket` on the caller's tenant).
- Anonymous/unauthenticated publish.
- Publish via any background job, webhook, or AI-driven path. Publish is **always** a deliberate, foreground office-user action.

---

## 5. Preflight contract (locked)

**Decision (interim canon):** The publish mutation must assert all of the following, in order, before performing the two-field update. Any failure is a structured rejection. Readiness is **mandatory, not advisory**.

1. **Tenant ownership.** The target `ScopePacketRevision` resolves through its parent `ScopePacket.tenantId` to the caller's tenant. Cross-tenant publish is rejected.
2. **Current status is `DRAFT`.** A `PUBLISHED` revision cannot be re-published; the mutation must reject (not no-op) so observability of the state machine remains explicit.
3. **Readiness is true.** `evaluateScopePacketRevisionReadiness({ packetTaskLines })` (from `src/lib/scope-packet-revision-readiness.ts`) must return `{ isReady: true, blockers: [] }`. Any non-empty `blockers` array → publish is rejected and the structured error surfaces the blocker codes verbatim. The readiness predicate is the **single canonical source** of publish-eligibility truth; the publish writer must not invent or skip any gate the predicate covers.
4. **Multi-`PUBLISHED` constraint (see §6).** The parent `ScopePacket` must currently have **zero** `PUBLISHED` revisions at the moment of publish.

**Why readiness is mandatory and not advisory:**

- The readiness predicate already encodes every canon-grounded publish gate (epic 15 §16 ≥1 task line, epic 16 §6/§81 `targetNodeKey` validity, canon-05 PUBLISHED-only TaskDefinition references, EMBEDDED payload non-emptiness, sentinel `__missing__` rejection). If the predicate were advisory, the readiness work just shipped becomes decorative and the library becomes a dumping ground (forbidden by canon-05 §125 and epic 15 §125).
- Reusing the predicate verbatim guarantees that the dev-inspector display and the publish-mutation truth never drift. A user looking at "Ready to publish ✅" can trust that hitting publish will succeed for readiness reasons (it may still fail for the §6 multi-`PUBLISHED` reason, which is the only other gate).
- The predicate is pure and Prisma-free, so the publish mutation pays no extra query cost beyond the existing select that the readiness panel already feeds.

**What the preflight contract does not include:**

- No "minimum age of DRAFT" gate (canon does not authorize one).
- No reviewer-acceptance gate (admin-review queue is deferred).
- No tier-coverage gate (`PacketTier` is deferred; epic 15 §16's "≥1 tier" half is structurally unenforceable in the interim slice and the readiness predicate correctly omits it).
- No diff-against-previous-revision gate (no previous revision can exist under §6).

---

## 6. Multi-`PUBLISHED` policy (locked)

**Decision (interim canon):** **A `ScopePacket` must have at most one `PUBLISHED` `ScopePacketRevision` at a time.** Publishing a DRAFT revision is rejected if any other revision of the same packet currently has `status = PUBLISHED`.

**Why this policy (and not the alternative):**

- **Target canon already implies single-published.** Epic 15 §6 names `ScopePacket.publishedVersion` as a singular pointer. Epic 15 §47 surfaces "last published" in detail UI as a single value. Epic 15 §10 says "Published: new revision draft fork; published stays immutable; quotes pin revision at send" — the implicit model is one current published, with new revisions forking from it. The "single PUBLISHED at a time" policy aligns the interim writer with the target reads.
- **The alternative (PUBLISHED revisions stack by `revisionNumber`)** is more permissive and would force every consumer to carry "highest published number" selection logic explicitly. The existing summary helper does this informally today, but it is a read-side convention, not enforced canon. Locking it in would prejudge the deferred decisions about supersede/un-publish/archive.
- **In the interim slice this constraint is trivially satisfied.** No code path creates revisions with `revisionNumber > 1` today (catalog-side authoring of additional revisions is deferred). Every DRAFT eligible for publish is `revisionNumber = 1` on a packet with zero PUBLISHED revisions. The constraint costs the writer one tiny existence check (`SELECT 1 ... WHERE scopePacketId = ? AND status = 'PUBLISHED'`) and pays for itself the moment a later epic introduces revision-2 authoring.

**What this policy does not decide (still deferred):**

- What happens when a future epic enables creating revision 2 and then publishing it. Options include "supersede the previous PUBLISHED revision" (demote to a new `SUPERSEDED` status), "reject the publish until the previous revision is explicitly archived", or "explicit operator choice between the two". This pack does not pick one — that decision belongs to whichever epic introduces revision-2 creation.
- The semantics of un-publish, archive, deprecate. None exist; the constraint is enforced on publish only.
- Whether `ScopePacket.publishedVersion` should become a denormalized FK column (epic 15 §6 hints at it). Read-side computation continues to work via "the one row with `status = PUBLISHED`".

**What this policy does enforce now (binding for the next code epic):**

- The publish mutation must perform the existence check inside the same transaction as the two-field update, using a row lock on the parent `ScopePacket` if the database/ORM supports it cheaply, or accepting the standard repeatable-read isolation otherwise. The integration test must include a "two simultaneous publishes lose at most one" assertion (or sequential equivalent) to prove the constraint cannot be bypassed by a race.

---

## 7. `publishedAt` truth (locked)

**Decision (interim canon):** When `ScopePacketRevision.status = PUBLISHED`, `publishedAt` **must be non-null**. The publish mutation is the **single writer** that establishes this invariant: it sets `publishedAt = NOW()` (the database transaction's server time) at the same moment it flips `status`.

**What `publishedAt` represents:** The server-side moment at which the revision became eligible for consumption by quote-side pickers and `QuoteLineItem.scopePacketRevisionId` pins. It is not the moment the revision was authored, not the moment promotion happened, and not a user-supplied time. There is no `publishedBy` column today and this pack does not authorize one (audit identity belongs to whichever later epic introduces audit trail for catalog mutations).

**What this decision formalizes:**

- The schema comment on `ScopePacketRevision.publishedAt` (`/// Required for PUBLISHED rows; service-layer enforces the conditional.`) becomes a binding canon rule rather than a paper invariant. The publish mutation is the binding service-layer enforcement.
- The seed-data convention (every PUBLISHED row in `prisma/seed.js` already sets `publishedAt` at creation time) is now backed by canon, not just convention.
- The reverse direction — "DRAFT revisions have `publishedAt = null`" — remains true by construction: no code path sets `publishedAt` on a DRAFT row. This pack does not need to enforce it as a separate invariant; it falls out of the publish-writer-as-single-source rule.

**What this decision does not authorize:**

- A user-supplied or backdated `publishedAt`. The publish mutation must use server `NOW()`; no API field accepts a published-at override.
- Editing `publishedAt` after publish. The schema treats published rows as immutable per canon-05 §10 and epic 15 §10; this pack does not introduce any mechanism that would mutate `publishedAt` post-publish.
- A `publishedBy` field, audit trail row, or webhook. Each is a separate epic's decision.

---

## 8. Schema impact

**None.** The follow-up code epic this pack authorizes performs zero schema changes:

- No new column, no new enum value, no new index, no migration file.
- The existing `status: ScopePacketRevisionStatus` enum already has `PUBLISHED` as a value (used today by seed and consumed by the `LINE_SCOPE_REVISION_NOT_PUBLISHED` invariant).
- The existing nullable `publishedAt: DateTime?` already accommodates DRAFT (null) and PUBLISHED (non-null) per the interim-promotion schema authorization.
- The existing `(scopePacketId, revisionNumber)` unique constraint is unchanged. The "one PUBLISHED per packet" policy is enforced as a runtime invariant, not as a database constraint, in the interim slice.

If a later epic decides to materialize the constraint as a partial unique index (`UNIQUE (scopePacketId) WHERE status = 'PUBLISHED'`), that is a separate decision and a separate migration. This pack neither requires nor forbids it.

---

## 9. Consumer invariants preserved during the interim slice

- **Picker filter (canon-05 §159, §161):** `ScopePacketRevision.status = PUBLISHED` remains the canonical filter. After the publish mutation lands, the set of revisions visible to consumer pickers grows by exactly the published rows; the filter rule itself does not change.
- **`LINE_SCOPE_REVISION_NOT_PUBLISHED` (consumer-side invariant, already shipped):** Continues to enforce that `QuoteLineItem.scopePacketRevisionId` pins only `PUBLISHED` rows. Publishing a revision does not change the invariant; it changes the input data the invariant evaluates.
- **Send/freeze:** Unchanged. Frozen `QuoteLineItem.scopePacketRevisionId` values remain pinned; publish does not retroactively touch any prior pin.
- **Execution truth:** Unchanged. Publish writes catalog rows only. Plan, package, runtime, and audit state are untouched.
- **Library hygiene:** Strengthened. The mandatory readiness preflight ensures no PUBLISHED revision ever enters the library with `__missing__` `targetNodeKey`s, unpublished LIBRARY-row TaskDefinitions, or empty EMBEDDED payloads.

---

## 10. What must not happen in the interim publish slice

- **Silent publishing.** No background job, webhook, AI agent, or scheduled task may publish a revision. Publish is always a foreground, deliberate office-user action.
- **Advisory readiness.** The publish writer must not bypass any blocker the readiness predicate raises, regardless of how the calling UI presents them.
- **Re-publish of an already-PUBLISHED revision.** Must reject with a structured error, not no-op.
- **Multiple PUBLISHED revisions on the same `ScopePacket`.** Must reject with a structured error, not silently coexist.
- **`PUBLISHED` rows with `publishedAt = null`.** The two-field update is atomic; partial state is impossible.
- **Editing `publishedAt`, `revisionNumber`, child `PacketTaskLine` rows, or any other field** as part of the publish mutation. Publish writes exactly two columns and nothing else.
- **Cross-tenant publish.** Tenant ownership is verified before any other check.
- **Field-user publish.** `field_execute` is not sufficient; `office_mutate` is required.
- **Inventing a `catalog.publish` capability now.** Reuse `office_mutate`; let the admin-review epic introduce the dedicated capability when its broader design lands.
- **Coupling publish to promotion.** The publish action must work on any DRAFT revision the tenant owns, not only on revisions whose source `QuoteLocalPacket` is `COMPLETED`. (In practice every DRAFT today comes from promotion, but the publish writer must not assume so — a future seed/import path could legitimately produce DRAFTs.)

---

## 11. Open questions explicitly out of scope for this pass

- Exact admin-review epic shape (reviewer assignment, notifications, diff UX, queue UI).
- Whether the eventual `catalog.publish` capability is per-tenant, per-trade, or global, and how it is granted.
- `un-publish`, `supersede`, `archive`, `deprecate` semantics for already-PUBLISHED revisions.
- Behavior when a published revision's referenced `TaskDefinition` is later un-published or archived (a "downstream invalidation" question that touches LIBRARY-row semantics broadly).
- Audit / webhook / notification surface (`packet.published` per epic 15 §22 hint).
- Source-side recovery: whether a `QuoteLocalPacket` whose promoted DRAFT failed publish-readiness should be re-promotable. Canon-05 §153 currently forbids re-promotion; that remains binding until a separate decision pack lifts it.
- DRAFT revision editing on the catalog side (the obvious complement to this pack, but a meaningfully larger canon question and explicitly out of scope here).

---

## 12. Ready-to-build signal

All canon/planning truth required to build the interim publish action is now explicit and cross-linked. The next implementation epic — **"Interim publish action for `ScopePacketRevision` (DRAFT → PUBLISHED, readiness-gated, single-PUBLISHED-per-packet)"** — may proceed.

**Expected scope of that follow-up code epic (binding shape, not implementation detail):**

- One tenant-scoped, `office_mutate`-gated mutation (`publishScopePacketRevisionForTenant`) performing the §3 flow inside one transaction.
- One narrow API route (`POST /api/scope-packets/{scopePacketId}/revisions/{scopePacketRevisionId}/publish`) returning the refreshed revision detail DTO so the inspector renders the new PUBLISHED state in one round trip.
- One small UI affordance on `/dev/catalog-packets/{id}/revisions/{revId}` — visible only when the revision is DRAFT and `publishReadiness.isReady === true`, hidden otherwise. The existing readiness panel's "no publish action is available yet" disclaimer is replaced with the live affordance.
- Up to four new invariant codes (e.g. `PUBLISH_REVISION_NOT_DRAFT`, `PUBLISH_REVISION_NOT_READY`, `PUBLISH_PACKET_ALREADY_HAS_PUBLISHED`, possibly `PUBLISH_REVISION_TENANT_MISMATCH`) added to `src/server/slice1/errors.ts` and mapped in `src/lib/api/tenant-json.ts` (likely all `409 Conflict` since each represents a state-conflict with the requested transition).
- Unit tests for each preflight gate and a happy-path integration test that promotes → publishes → asserts a previously-rejected `LINE_SCOPE_REVISION_NOT_PUBLISHED` pin now succeeds (closing the loop end-to-end).

Anything beyond that shape (admin-review affordances, capability changes, schema changes, additional revision authoring, un-publish, etc.) is outside the authority of this pack and requires its own decision pass.
