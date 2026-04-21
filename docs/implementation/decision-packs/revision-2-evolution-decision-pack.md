# Revision-2 evolution — decision pack (consolidated)

**Status:** Canon-authorized planning truth for the **first revision-2 implementation epic**. Decision-focused; not an implementation spec.

**Authority:** `docs/canon/05-packet-canon.md` ("Canon amendment — interim publish authority", §10, §172, §181, §189–§193), `docs/epics/15-scope-packets-epic.md` §6 + §10 + §47, `docs/implementation/decision-packs/interim-publish-authority-decision-pack.md` §6 + §11 (which explicitly defer the questions resolved here), `docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md` §3 + §27 (re-promotion forbidden — preserved).

---

## 1. Purpose

Resolve the **smallest missing canon truth** that today blocks any code that creates a `ScopePacketRevision` with `revisionNumber > 1`. After the interim promotion epic, the publish-readiness inspection epic, the interim publish action epic, and the quote-local fork-from-PUBLISHED epic, every operational substrate exists for **revision 1** of every packet. The next structural gap — same-packet evolution to revision 2+ — is **canon-blocked, not code-blocked**: the interim publish decision pack §6 explicitly assigns the supersede / multi-`PUBLISHED` policy to "whichever epic introduces revision-2 creation."

This pack supplies that policy in the most narrow form possible so a single follow-up code epic can ship revision-N+1 DRAFT creation **and nothing else**.

This doc is **planning truth**, not a migration or code plan.

---

## 2. Scope boundary

**In scope for this canon decision pass (resolved here):**

- Source contract for revision-N+1 DRAFT (§3).
- Multi-DRAFT policy per `ScopePacket` (§4).
- Policy for what happens to revision N when revision N+1 publishes (§5) — the load-bearing decision.
- Pinned-line behavior under that policy (§6).
- DRAFT-edit scope for the first revision-2 slice (§7).
- Picker-semantics confirmation under the chosen publish policy (§8).
- Single conditional schema change identified and quarantined (§9). **Not made by this pack.**

**Out of scope (preserved as deferred, not deleted):**

- Admin-review queue / UI / reviewer assignment / notifications.
- `REQUESTED` / `IN_REVIEW` / `REJECTED` enum values (still reserved per `interim-packet-promotion-decision-pack.md` §26).
- `ScopePacket.status` (`draft` / `deprecated` / `archived`) — still deferred per epic 15 §17.
- `PacketTier` normalized dimension.
- Catalog-side editing of any DRAFT revision (`PacketTaskLine` CRUD, packet metadata edits) — explicitly deferred in §7 below.
- Re-promotion / "fix and re-promote" recovery for a `COMPLETED` `QuoteLocalPacket` — canon-05 §153 forbids; that decision belongs to its own pack.
- Generic archive / deprecate / un-publish / rollback actions beyond the minimum the chosen §5 policy strictly requires (which is **none** under the chosen policy — see §5 alternative analysis).
- Cross-tenant sharing.
- Quote-side packet picker UI (canon §159 / §161 already pre-decides the consumer filter).
- Generic revision-diff platform; only the **read-only fields-that-changed view** that the publish gate may consume is ever in scope, and even that is deferred to its own slice.
- Auto-promotion, AI-initiated publish, frequency-heuristic publish.
- `publishedBy`, audit-trail row, `packet.published` webhook (epic 15 §22 hint remains future canon).
- New capabilities. The interim authority remains `office_mutate` per the interim-publish sunset rule.

---

## 3. Source of revision N+1 DRAFT (locked)

**Decision (interim canon):** **A revision-N+1 `ScopePacketRevision` DRAFT is born as a deep clone of the current PUBLISHED revision of the same `ScopePacket`.** No other source is authorized in the interim slice.

**Canonical create flow (interim, decision-only — implementation deferred to the follow-up epic):**

1. An office user (`office_mutate` capability) on the packet's tenant invokes the create-DRAFT action against a specific `ScopePacket` they own (tenant-scoped).
2. Server resolves the **current PUBLISHED revision** of that packet using the existing `summarizeScopePacketRevisions` rule: highest `revisionNumber` among rows with `status = PUBLISHED`. If none exists, the action is rejected (§4 already provides the smaller "promote first" path; revision-2 creation is **not** how a packet gets its first PUBLISHED revision).
3. Server computes the next `revisionNumber` as `max(revisionNumber across all revisions of the packet) + 1`. The existing `@@unique([scopePacketId, revisionNumber])` constraint guarantees correctness.
4. Server creates one new `ScopePacketRevision` row with `status = DRAFT`, `publishedAt = null`, and a deep-cloned `PacketTaskLine` set whose mapping is **byte-for-byte identical** to the canonical promotion mapping (`05-packet-canon.md` "Canonical `QuoteLocalPacketItem` → `PacketTaskLine` mapping contract"), but **field-for-field** because the source is already a `PacketTaskLine`. The mapping is verbatim: `lineKey`, `sortOrder`, `tierCode`, `lineKind`, `embeddedPayloadJson` (deep copy), `taskDefinitionId`, `targetNodeKey`. No transformation. No reordering. No merging.
5. The source PUBLISHED revision is **not touched**. Its `status` remains `PUBLISHED`, its `publishedAt` is unchanged, its `PacketTaskLine` rows are unchanged.
6. No `QuoteLocalPacket` is created. No `QuoteVersion` is touched. No `QuoteLineItem` pin is rewritten. The action writes exactly one new revision row plus its child `PacketTaskLine` rows in one transaction.

**Why this option (and not the alternatives):**

- **Option (a) — clone of current PUBLISHED revision: chosen.** Direct alignment with epic 15 §10 ("Published: new revision draft fork; published stays immutable; quotes pin revision at send"). The lineage is unambiguous: revision 2 starts from "what the library officially looks like right now." It mirrors the deep-copy contract already proven by `forkScopePacketRevisionToQuoteLocalForTenant` (quote-side) and `promoteQuoteLocalPacketToCatalogForTenant` (catalog-side), reusing the same one-direction field-level copy discipline.
- **Option (b) — second promotion of a different `QuoteLocalPacket` into the existing `ScopePacket`: rejected.** Promotion's contract is that it creates a new `ScopePacket` AND a first revision; the writer hardcodes `revisionNumber = 1` and rejects when the source is `COMPLETED`. Allowing promotion to target an existing packet would (i) require a second write path that diverges from the locked `(packetKey, displayName)`-creation contract, (ii) introduce a "which `QuoteLocalPacket` did this revision come from" provenance question that does not exist for revision 1, and (iii) collide with canon-05 §153's forbidden-re-promotion rule. The two writers must remain orthogonal.
- **Option (c) — blank canvas (empty DRAFT, edit later): rejected.** Already rejected in spirit by the empty-fork rule (`SCOPE_PACKET_REVISION_FORK_SOURCE_HAS_NO_ITEMS`) on the quote side. An empty catalog DRAFT is a stranded snapshot whose only path forward is editing — which §7 explicitly defers. It would only become useful when DRAFT-editing exists, at which point the eventual epic can authorize it. Until then it is a no-value object.
- **Option (d) — clone of an arbitrary historical revision (e.g. a previously-superseded one): rejected.** No coherent product story today; would force decisions about historical-revision provenance that are not blocking revision-2 evolution.

**What this decision does not authorize:**

- Cloning into a different `ScopePacket` (cross-packet copy is not a revision-2 operation).
- Cross-tenant clone (tenant boundary identical to existing mutations).
- A user-supplied `revisionNumber` (server computes it; no caller override).
- Any payload override at clone time (the deep clone is faithful; first edit of the clone happens via the deferred DRAFT-edit epic, not at create time).
- Reading any source other than the **current** PUBLISHED revision (the helper's "highest `revisionNumber` among `PUBLISHED`" is the single canon source-selection rule).

---

## 4. Multi-DRAFT policy (locked)

**Decision (interim canon):** **A `ScopePacket` must have at most one `DRAFT` `ScopePacketRevision` at a time.** The create-DRAFT action is rejected if any other revision of the same packet currently has `status = DRAFT`.

**Why this policy (and not the alternative):**

- **Symmetric with the §5 publish policy and the existing publish writer's at-most-one-PUBLISHED check.** "One DRAFT in flight, one PUBLISHED in production" is the smallest mental model. Authoring tools, comparison views, and the future admin-review queue all become trivially scoped: at any moment there is at most one "what the library is" (PUBLISHED) and at most one "what the library will become" (DRAFT).
- **Avoids reviewer-merge questions.** Multiple coexisting DRAFTs would force decisions about "which DRAFT publishes first," "what happens to the loser," "do they share `revisionNumber` reservations," and "do they reconcile against each other" — all genuinely hard product questions that have nothing to do with unblocking revision-2 evolution.
- **Trivially satisfied today.** No code path creates DRAFTs other than promotion (revision 1) and the new revision-2 create-DRAFT action authorized here. The first revision-2 epic ships with this constraint already true; no migration is needed.
- **The `@@unique([scopePacketId, revisionNumber])` constraint already exists** and incidentally helps: even with multi-DRAFT lifted later, two writers cannot accidentally pick the same number. The "at most one DRAFT" rule layers on top as a runtime existence check, mirroring the publish writer's at-most-one-PUBLISHED sibling check.
- **Forward-compatible.** A future epic (e.g. concurrent-author admin-review workflow) may lift this. Lifting it is a one-line writer change; introducing it later (when DRAFTs proliferate) would be a coordination problem.

**What this policy does not decide:**

- Whether the lone DRAFT is editable. That is §7.
- Whether the DRAFT can be discarded / abandoned without publishing. Recommend a future "delete DRAFT revision" mutation; explicitly **not** authorized here. In the interim slice, a DRAFT that is no longer wanted simply waits for the next iteration of the deferred admin-review / archive epic. There is no operational impact: a stranded DRAFT does not appear in any picker (canon §159 / §161).

---

## 5. Publish-of-revision-N+1 policy (locked)

**Decision (interim canon):** **When revision N+1 publishes, revision N is automatically demoted to a new `SUPERSEDED` status in the same transaction.** Exactly one `PUBLISHED` revision per `ScopePacket` continues to be a binding invariant; this is enforced by the publish writer flipping the previous PUBLISHED row to `SUPERSEDED` rather than by rejecting the publish.

**Canonical publish-N+1 flow (interim, decision-only — implementation deferred to the follow-up epic):**

1. An office user invokes the existing `publishScopePacketRevisionForTenant` action against the new revision N+1 (DRAFT).
2. The existing readiness preflight runs unchanged (`isReady: true` mandatory, per `interim-publish-authority-decision-pack.md` §5).
3. The existing tenant-ownership and `currentStatus = DRAFT` checks run unchanged.
4. The existing **at-most-one-PUBLISHED-sibling check is amended**: instead of rejecting when a sibling is `PUBLISHED`, the writer locates the single sibling PUBLISHED row (there must be exactly zero or one — see §6 below for why) and, if present, flips it from `PUBLISHED` to `SUPERSEDED` in the same transaction as the target's `DRAFT → PUBLISHED + publishedAt = NOW()` write. Both writes occur in one DB transaction; failure reverts both.
5. No other rows are touched. No `PacketTaskLine` rows are rewritten. No `QuoteLineItem` pin is rewritten.
6. Re-publish of an already-PUBLISHED revision continues to be rejected. Publishing into a packet with **two** PUBLISHED revisions (an impossible state under §6, but defended-against) is rejected.

**Why this option (and not the alternatives):**

- **Option (a) — supersede / demote revision N automatically on publish of N+1: chosen.** Preserves epic 15 §6's singular `publishedVersion` mental model (one row is "what the library looks like right now"). Picker semantics (canon §159 / §161) remain "filter to `status = PUBLISHED`" with no rule change — they naturally exclude SUPERSEDED. The decision is fully encoded in the publish action; no second mutation is needed.
- **Option (b) — reject publish until revision N is explicitly retired: rejected.** Forces a second action ("retire" or "archive") into scope, with its own capability decision, its own UI affordance, its own preflight contract, and its own deferred-state-of-the-old-revision question. Net effect is the same as supersede but with two actions instead of one. Doubles the canon surface.
- **Option (c) — explicit operator choice at publish time (parameter on the publish call): rejected.** Pushes the choice to every caller, which means every caller has to know about it. The "right answer" is the same in essentially every case (the new one becomes active; the old one becomes historical). A parameter that is always set to the same value is a parameter that should not exist.
- **Option (d) — multi-`PUBLISHED` coexistence (lift the at-most-one rule, picker selects "latest"): rejected.** Initially attractive because it requires zero schema change. Rejected because:
  - It silently shifts the canonical "active library SKU" definition from a server-side row state to a client-side selection rule. Any consumer that forgets the "select max(revisionNumber)" rule will surface stale or wrong data. The supersede policy keeps the invariant on the server.
  - It contradicts canon §172's "at most one PUBLISHED at a time" without putting anything in its place. The canon amendment would be larger ("multiple PUBLISHED coexist; pickers must select latest") than the supersede amendment ("the previous PUBLISHED is demoted on publish of the next").
  - It complicates the catalog inspector's "which revision is the active one" display: today the inspector reads `latestPublishedRevisionId` and labels exactly one row; under multi-PUBLISHED that label requires explanation ("latest, but the others are still PUBLISHED too"). Under supersede, the labels are self-evident: PUBLISHED = active, SUPERSEDED = historical.

**The schema cost of this decision (quarantined to §9):**

- This option requires exactly one schema change: adding `SUPERSEDED` as a value on the existing `ScopePacketRevisionStatus` enum.
- That change is **not made by this pack.** It is named in §9 as the single conditional schema change the follow-up code epic will perform.

**What this decision does not authorize:**

- An explicit "supersede this revision now without publishing a replacement" action. The only path to SUPERSEDED is publish-of-N+1 demoting the previous PUBLISHED. Standalone retire/archive remains deferred.
- Un-supersede / restore. SUPERSEDED is a one-way transition in the interim slice. A later epic may revisit.
- Editing a SUPERSEDED revision's `publishedAt` (or any other field) post-demotion. SUPERSEDED is read-only by construction; the publish writer is its only author and only writer.
- Cascading any change to existing `QuoteLineItem` pins. Pin behavior is locked separately in §6.

---

## 6. Existing pin behavior locked (locked)

**Decision (interim canon, two-part rule):**

- **Already-pinned `QuoteLineItem.scopePacketRevisionId` rows that point at a `SUPERSEDED` revision remain valid.** They continue to load through the read path and continue to satisfy `assertQuoteVersionScopeViewInvariants`. The freeze artifact on a `SENT` or `SIGNED` quote version is not retroactively invalidated.
- **New pins to a `SUPERSEDED` revision are forbidden.** The line-item mutation path continues to require `status = PUBLISHED` exactly. The canon picker contract (canon §159 / §161) remains "filter to PUBLISHED" so pickers naturally do not offer SUPERSEDED revisions. Any direct API caller that attempts to pin a SUPERSEDED revision is rejected at the mutation boundary.

**Operational consequence (binding for the next code epic):**

The existing assertion `assertScopePacketRevisionIsPublishedForPin` is fired from **two** call sites today (verified in `src/server/slice1/invariants/quote-line-item.ts`):

| Call site | Path | Required behavior under this decision |
|---|---|---|
| `assertQuoteLineItemInvariants` ← `quote-line-item-mutations.ts` (POST/PATCH line-item pin write) | **Mutation / pin-time** | Continues to require `status === "PUBLISHED"`. **No change.** |
| `assertQuoteLineItemInvariants` ← `assertQuoteVersionScopeViewInvariants` ← `quote-version-scope.ts` (every read of a quote-version scope view) | **Read / load-time on every quote version** | Must accept `status === "PUBLISHED"` **or** `status === "SUPERSEDED"`. Otherwise every old SENT/SIGNED quote that pinned the now-SUPERSEDED revision becomes unloadable, and freeze integrity / activation reads break retroactively. |

**Why the read/mutation split:**

- The pin invariant currently overloads two distinct rules into one assertion: "you may only **create** a pin against a PUBLISHED revision" and "a stored pin is **valid** only if it points at a PUBLISHED revision." Today these collapse to the same answer because no revision ever leaves `PUBLISHED`. Once SUPERSEDED exists, they diverge: stored pins must remain valid for historical truth (canon-05 §10 "published stays immutable; quotes pin revision at send"); new pins must continue to point at currently-active library rows.
- Splitting the assertion is the smallest possible code change that preserves both halves. The follow-up code epic will introduce a second, narrower assertion (e.g. `assertScopePacketRevisionIsValidPinForReadModel`) that accepts `PUBLISHED | SUPERSEDED`, and route the read path through it. The write path keeps the existing assertion verbatim.
- This is a code shape, not a canon question; it is named here only to make explicit that the §5 supersede decision and the read-side invariant are deliberately co-designed and the cost is exactly one new pure assertion plus one routing change.

**What this decision does not authorize:**

- Auto-rewriting any existing pin. A pin that points at a SUPERSEDED revision stays pointing there forever, even on subsequent quote-version clones (clone semantics for QuoteVersion are governed by their own epic; nothing here changes them).
- Surfacing SUPERSEDED revisions in any picker. They remain invisible to selection UI. They are surfaced **only** in catalog inspector views (which already display all revisions of a packet, regardless of status).
- Forbidding new draft quote versions from pinning a SUPERSEDED revision via direct API call by accident. The mutation invariant blocks it; no extra UI work is required.
- Changing the `LINE_SCOPE_REVISION_NOT_PUBLISHED` invariant **code** in any other way. The error code itself, its message, and its mutation-side firing are all preserved; the only addition is a parallel read-side assertion that accepts SUPERSEDED.

---

## 7. DRAFT-edit scope (locked)

**Decision (interim canon):** **Catalog-side editing of any `ScopePacketRevision` DRAFT remains deferred for the first revision-2 slice.** The first revision-2 epic ships **only** the create-DRAFT-from-clone action authorized in §3 plus the publish-of-N+1 supersede behavior authorized in §5. There is no `PacketTaskLine` CRUD, no packet-metadata-edit, and no catalog-side payload mutation.

**Why this option (and not the alternative):**

- **The `interim-publish-authority-decision-pack.md` §10 explicit rule "No catalog-side editing of DRAFT revisions" is preserved without amendment.** Lifting it inside this pack would be a meaningfully larger canon question (what fields are editable, who can edit them, how is concurrent editing prevented, how do edits interact with the readiness predicate, what is the audit shape) and is the obvious target of a separate epic. Conflating revision-2 creation with revision-edit doubles the surface.
- **The clone-and-publish-as-is path is independently useful.** It is the smallest non-trivial use of revision-2: a tenant can re-publish the current PUBLISHED revision as revision N+1 when the only thing that needs to change is, for example, "we want a fresh `publishedAt` for downstream consumers" or "we want a clean cut-over that supersedes some long-running historical revision." More importantly, it unblocks the next epic (DRAFT-edit) by establishing the create-DRAFT writer first.
- **Symmetric with the interim-publish discipline.** The interim publish epic shipped DRAFT → PUBLISHED without any DRAFT authoring; this epic ships create-DRAFT without any DRAFT authoring; the next epic ships DRAFT authoring on its own canon authority. Three small slices, each with a single load-bearing change.
- **Honest about the limit.** A clone-only first slice is genuinely small. If the product surface needs a richer "make these specific changes and publish revision 2" flow before catalog-side authoring lands, the existing operational loop still works: estimators can do the work via quote-local fork → local edit → re-promote (after the deferred re-promotion pack lifts canon §153), or in the meantime via supplemental promotion of a different `QuoteLocalPacket` into a different packet identity. Neither workaround is elegant; both are functional. Picking DRAFT-edit-first instead of create-DRAFT-first would not produce a smaller change.

**What this decision explicitly preserves as deferred (not deleted):**

- `PacketTaskLine` CRUD on a DRAFT.
- Packet `displayName` edit on a DRAFT.
- `tierCode` retag on a DRAFT.
- `embeddedPayloadJson` mutation on a DRAFT.
- Reorder of `PacketTaskLine` rows on a DRAFT.
- Any AI-assisted edit-the-draft surface.

All belong to a separate epic whose canon authority will be supplied by its own decision pack.

---

## 8. Picker semantics (confirmed, not re-decided)

**Confirmation (no canon amendment needed):** Canon §159 and §161 already say "library packet pickers, quote line pickers, and AI grounding sources **must filter to `ScopePacketRevision.status = PUBLISHED`**." Under the §5 supersede policy:

- `PUBLISHED` continues to mean exactly "the current active library version of this packet, eligible for new pins."
- `SUPERSEDED` is naturally excluded by the existing filter rule. No picker code change is required to keep historical revisions out.
- `DRAFT` continues to be excluded as today.

The summary helper `summarizeScopePacketRevisions` (`src/lib/scope-packet-catalog-summary.ts`) continues to compute `latestPublishedRevisionId` correctly under both single-PUBLISHED (the steady state under §5) and the transient zero-PUBLISHED state (which can only occur if a future epic introduces an explicit retire action; not a concern here). Under §5 there is exactly one PUBLISHED revision per packet at all times after the first publish, so the helper's "highest revisionNumber among PUBLISHED" reduces to "the only PUBLISHED row."

---

## 9. Schema impact

**One conditional schema change is identified by this pack and explicitly NOT made here:**

| Change | Scope | Rationale |
|---|---|---|
| Add `SUPERSEDED` to the existing `ScopePacketRevisionStatus` enum (`prisma/schema.prisma`) | Prisma + migration | Required by the §5 supersede policy. The publish writer transitions the previous PUBLISHED row to SUPERSEDED in the same transaction as it publishes the new revision. |

**No other schema changes** are authorized by this pack. In particular:

- `ScopePacketRevision` columns are unchanged (no new `supersededAt`, no `supersededBy`, no `supersededByRevisionId` FK in this slice — keep them deferred to a later observability/audit epic if needed).
- `ScopePacket` is unchanged (no `status` column; deferred per epic 15 §17).
- `QuoteLineItem` is unchanged.
- The `(scopePacketId, revisionNumber)` unique constraint is unchanged.
- No partial unique index for "at most one PUBLISHED per packet" — this stays a runtime invariant in the publish writer, exactly as today.

**Migration shape (decision-only, not authored here):**

- The migration adds the enum value. Existing rows are unaffected (none can be SUPERSEDED yet because no writer produces it pre-deployment).
- Seed data does not need to change.
- The "no other changes" discipline is the same as the interim publish slice, which performed zero schema changes; this slice performs exactly one minimal schema change because the §5 chosen policy requires it.

---

## 10. Consumer invariants preserved during the interim revision-2 slice

- **Picker filter (canon §159 / §161):** Unchanged. PUBLISHED is the only selectable state.
- **`LINE_SCOPE_REVISION_NOT_PUBLISHED` (mutation-side):** Unchanged. New pins must target PUBLISHED.
- **Read-side pin validation:** Amended exactly once per §6 to accept PUBLISHED **or** SUPERSEDED. No other invariant changes.
- **Send / freeze:** Unchanged. Frozen `QuoteLineItem.scopePacketRevisionId` values remain pinned at their stored revision id; whether that revision is currently PUBLISHED or SUPERSEDED has no effect on the freeze artifact.
- **Activation / runtime:** Unchanged. Activation reads frozen package snapshots; supersede has no effect on already-activated flows.
- **Promotion writer (`promoteQuoteLocalPacketToCatalogForTenant`):** Unchanged. Continues to hardcode `revisionNumber = 1` and to create a new `ScopePacket`. Revision-2 creation is a different writer.
- **Fork writer (`forkScopePacketRevisionToQuoteLocalForTenant`):** Unchanged. Continues to fork from any PUBLISHED revision. Forking from a SUPERSEDED revision remains forbidden by the existing `SCOPE_PACKET_REVISION_FORK_NOT_PUBLISHED` invariant — a deliberate choice; SUPERSEDED is historical-only and not a fork source. (A later epic may reconsider if "fork from a specific historical revision" becomes a real product need.)
- **Library hygiene:** Strengthened. The existing readiness preflight continues to gate publish; revision-2 publishes have to clear the same bar. No revision can become PUBLISHED with `__missing__` `targetNodeKey`s, unpublished LIBRARY-row TaskDefinitions, or empty EMBEDDED payloads.

---

## 11. What must not happen in the interim revision-2 slice

- **Silent revision-2 creation.** No background job, webhook, AI agent, or scheduled task may create a revision-N+1 DRAFT. Creation is always a foreground, deliberate office-user action.
- **Cloning from anything other than the current PUBLISHED revision.** No "clone from DRAFT," no "clone from SUPERSEDED," no "clone from arbitrary revision id."
- **Multiple coexisting DRAFTs on the same `ScopePacket`.** §4 explicitly forbids it; the writer must reject at the existence-check.
- **Multiple coexisting PUBLISHED revisions on the same `ScopePacket`.** §5 maintains the at-most-one-PUBLISHED rule by demoting the previous PUBLISHED to SUPERSEDED inside the publish transaction.
- **Editing any field on a SUPERSEDED revision after demotion.** SUPERSEDED is read-only.
- **Editing any field on a DRAFT revision (catalog side).** §7 forbids until a separate epic authorizes catalog-side DRAFT editing.
- **Auto-rewriting `QuoteLineItem.scopePacketRevisionId` pins on supersede.** Pins are immutable post-write per existing freeze semantics.
- **Surfacing SUPERSEDED revisions in pickers.** Inspector-only.
- **Inventing a `catalog.publish` or `catalog.retire` capability now.** `office_mutate` remains the interim authority for both create-DRAFT and publish per the interim-publish sunset rule.
- **Touching `ScopePacket.status`, `PacketTier`, or any deferred enum values.** All remain deferred.
- **Coupling create-DRAFT to a specific source `QuoteLocalPacket`.** Create-DRAFT-from-clone has no `QuoteLocalPacket` dependency. (Re-promotion of a `QuoteLocalPacket` into an existing `ScopePacket` remains forbidden by canon-05 §153 and is a different decision pack's problem.)
- **Cross-tenant clone or cross-tenant publish.** Tenant ownership is verified before any other check, exactly as today.

---

## 12. Open questions explicitly out of scope for this pass

- Whether SUPERSEDED revisions should carry a `supersededAt` / `supersededByRevisionId` audit pair. Recommend a future audit-trail epic add this once `publishedBy` and `packet.published` webhook (epic 15 §22) are also in scope.
- Whether SUPERSEDED revisions should ever be re-promotable to PUBLISHED ("un-supersede"). No use case identified; leave forbidden by construction (no writer produces the transition).
- Whether forking from a SUPERSEDED revision should be allowed for a "I want to start a quote from how the library looked last year" workflow. Not blocking revision-2 evolution; a later decision pack may revisit.
- Whether the create-DRAFT action should optionally take a `displayName` override, or whether `ScopePacket.displayName` evolution is its own separate decision. Recommend the latter; this pack does not authorize a packet-level rename via revision-2 creation.
- Whether the deferred admin-review queue, when it lands, retains the supersede semantics chosen here or replaces them with a richer state machine. The §4 sunset clause from the interim-publish pack carries forward: when admin-review lands, the §5 supersede policy is reviewed, not assumed.
- Whether a `delete DRAFT revision` mutation should exist (for "we created a clone, looked at it, decided not to proceed"). Recommend yes as a tiny follow-up; not authorized here.
- Visibility of SUPERSEDED revisions to the catalog inspector page. Recommend yes (rendered with a distinct badge); not blocking, can be in the same code epic or a follow-up.

---

## 13. Ready-to-build signal

All canon/planning truth required to build the first revision-2 implementation epic is now explicit and cross-linked. The next implementation epic — **"Create revision-N+1 `ScopePacketRevision` DRAFT as a deep clone of the current `PUBLISHED` revision; amend publish writer to demote the previous `PUBLISHED` to a new `SUPERSEDED` status; amend read-side pin invariant to accept `SUPERSEDED` for already-pinned rows"** — may proceed.

**Expected scope of that follow-up code epic (binding shape, not implementation detail):**

- One Prisma migration adding `SUPERSEDED` to `ScopePacketRevisionStatus` (the only schema change authorized in §9).
- One tenant-scoped, `office_mutate`-gated mutation (`createScopePacketRevisionDraftFromCurrentPublishedForTenant`, working title) performing the §3 flow inside one transaction. Source-selection via `summarizeScopePacketRevisions`. Multi-DRAFT existence check per §4. Deep-clone of `PacketTaskLine` rows verbatim per §3 step 4.
- One narrow API route (`POST /api/scope-packets/{scopePacketId}/revisions` — body either empty or a thin "from current PUBLISHED" intent token) returning the refreshed packet detail DTO so the inspector renders the new DRAFT immediately.
- One amendment to `publishScopePacketRevisionForTenant` and its preflight assertion: when a sibling PUBLISHED revision exists, demote it to SUPERSEDED in the same transaction (replacing the existing reject-on-sibling-PUBLISHED branch). The readiness preflight, tenant ownership, and `currentStatus = DRAFT` checks are unchanged.
- One new pure assertion (e.g. `assertScopePacketRevisionIsValidPinForReadModel`) that accepts `PUBLISHED | SUPERSEDED`, plus one routing change in `assertQuoteVersionScopeViewInvariants` to call it instead of `assertScopePacketRevisionIsPublishedForPin`. The mutation path continues to call the original assertion verbatim. (See §6 for why the split is required.)
- Up to four new invariant codes (e.g. `SCOPE_PACKET_REVISION_CREATE_DRAFT_NO_PUBLISHED_SOURCE`, `SCOPE_PACKET_REVISION_CREATE_DRAFT_PACKET_HAS_DRAFT`, possibly a generalized `SCOPE_PACKET_REVISION_CREATE_DRAFT_TENANT_MISMATCH`). The publish-side `SCOPE_PACKET_REVISION_PUBLISH_PACKET_HAS_PUBLISHED` may be retired or reused depending on whether the demote-on-publish branch ever throws (recommend retire and replace with a no-op transition, since the writer now handles it gracefully).
- Catalog inspector UI: a "Create new draft revision" affordance visible only when the packet has at least one PUBLISHED revision and zero DRAFT revisions. A revision-list badge for SUPERSEDED. No edit affordance.
- Unit tests for: clone source selection (latest PUBLISHED), multi-DRAFT rejection, tenant-mismatch rejection, publish-side demote-then-publish atomicity, read-side pin invariant accepting SUPERSEDED, mutation-side pin invariant rejecting SUPERSEDED. Integration test: promote → publish r1 → create r2 DRAFT → publish r2 → assert r1 is SUPERSEDED, r2 is PUBLISHED, an existing pin to r1 still loads, a new pin attempt to r1 is rejected, a fork from r1 is rejected (per §10 "fork from SUPERSEDED forbidden").

Anything beyond that shape (DRAFT editing, retire / un-supersede / archive, admin-review affordances, capability changes, schema changes other than the single enum value, audit columns, picker overhauls, cross-tenant flows) is outside the authority of this pack and requires its own decision pass.

---

## 14. Sunset clause (binding)

When the admin-review epic lands, the create-DRAFT and publish authorities both shift to whichever capability that epic names (likely `catalog.publish` or a sibling). The interim `office_mutate` authority for revision-2 creation is **explicitly temporary** — the same compaction-of-future-canon pattern as interim promotion and interim publish. The follow-up code epic must comment its capability checks accordingly so the swap is mechanical.

When that epic lands, the §5 supersede policy is **reviewed against the admin-review state machine**, not assumed. If admin-review introduces richer states (e.g. `IN_REVIEW`, `REJECTED`), the SUPERSEDED transition may need to interlock with them; that interlock is not authorized here.
