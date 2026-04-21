# Epic 15 — Scope packets (catalog)

## 1. Epic title

Scope packets (catalog)

## 2. Purpose

Define **scope packet** as the **reusable catalog template** for a **unit of trade scope** at a **tier** (`05-packet-canon`): identity, display metadata, **packet task lines**, **inspection checkpoint definitions** (materialized per decision `03`), tiers, publish workflow, and **draft** states.

## 3. Why this exists

**Line-item-fronted** selling requires **SKUs** that compose work and default placement without **workflow-first** authoring (`01`, `06`).

## 4. Canon alignment

- **`05`:** Naming: **scope packet** vs **execution package** (`09` naming drift ban).
- **`04`:** Packet ≠ task definition ≠ line item.
- **`08-ai`:** AI drafts require **human publish**.

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Catalog author** | Create/edit **draft** packets; submit publish. |
| **Admin** | Approve publish, deprecate, archive. Review and publish **promoted** QuoteLocalPackets. |
| **Estimator** | **Consume** published packets on quotes. **Fork** to `QuoteLocalPacket` for task-level modifications. **Request promotion** of useful local patterns to global library. |

## 6. Primary object(s) affected

- **ScopePacket** (`key`, `name`, `description`, `trade`, `status` — **deferred for the interim promotion slice; see §17**, `publishedVersion`).

## 7. Where it lives in the product

- **Catalog → Scope packets** nav `/catalog/packets`.
- **Picker** in quote line (09).

## 8. Create flow

1. **New packet** → enter `key` (slug, unique per tenant), `name`, `trade`.
2. Save **draft** → add **tiers** (19) and **packet task lines** (16).
3. **Validate** placement against **at least one** published process template compatibility (warnings).
4. **Publish** → immutable `publishedRevision`; or **schedule** effective date.

## 9. Read / list / detail behavior

**List:** Key, name, trade, **status**, tier count, **last published**. Filter trade, status. Search key/name. Sort name.

**Detail:** Tabs: Overview, Tiers, Task lines, Checkpoints, History, **Where used** (quotes count — approximate).

**Empty catalog:** onboarding CTA.

## 10. Edit behavior

- **Draft:** full edit.
- **Published:** **new revision** draft fork; published stays immutable; quotes **pin** revision at send (09).

## 11. Archive behavior

- **Archive** hides from **new** line picks; existing quotes keep **pinned** revision.

## 12. Delete behavior

- Hard delete only if **never published** and **unused**; else archive.

## 13. Restore behavior

- Restore archived; audit.

## 14. Required fields

| Field | Type | Why |
|-------|------|-----|
| `key`, `name`, `tenantId` | | Identity and display. |

## 15. Optional fields

`marketingBlurb`, `heroImageId`, `defaultTier`, `inspectionCheckpointDefs` (structured).

## 16. Field definitions and validations

- `key`: regex `^[a-z0-9._-]+$`, max 80.
- **Publish gate:** ≥1 tier, ≥1 task line unless **explicit** empty packet disallowed.

## 17. Status / lifecycle rules

**Target canon (future):** `draft` | `published` | `deprecated` | `archived`. Transitions: draft→published; published→deprecated (warn usage); any→archived.

**Interim promotion slice (authorized scope):** `ScopePacket.status` is **deferred** — not added to the Slice 1 schema as a column on `ScopePacket` itself. Lifecycle is expressed at the `ScopePacketRevision` level only (`DRAFT` | `PUBLISHED`) in the interim slice. The packet-level `status` enum remains canon for a later epic once deprecation/archive flows are built; preserving the deferred column avoids a churn migration when that epic lands.

## 18. Search / filter / sort behavior

See §9; filter **deprecated** inclusion default off in picker.

## 19. Relationships to other objects

- **Packet 1—* PacketTaskLine**; **1—* TierVariant**; referenced by **QuoteLineItem** by key+revision pin.

## 20. Permissions / visibility

- **catalog.publish** admin/author roles.

## 21. Mobile behavior

- **Read-only** catalog browser optional; authoring desktop.

## 22. Notifications / side effects

- Webhook `packet.published`; **learning** suggestions may reference packet (52).

## 23. Audit / history requirements

- Publish, deprecate, archive, each **revision diff** summary.

## 24. Edge cases

- **Rename key** after publish: **forbidden**; create new packet key.

## 25. What must not happen

- Calling **execution package** a **packet** in UI (`09`).
- **Auto-publish** AI packet (`08-ai`).
- Allowing estimators to **edit** a published `ScopePacketRevision` directly from the quote editor — task-level changes must **fork** into a `QuoteLocalPacket`.
- Allowing AI-drafted scope to enter the global library without explicit human promotion and admin review.
- Treating the packet library as a dumping ground for one-off project tasks — it is **curated reusable scope structure**.

## 25a. Quote-local packet fork behavior (QuoteLocalPacket)

**Context:** Estimators and AI often need to modify the task structure of a library packet for a specific project. These modifications must not pollute the global library.

### Fork rules

| Scenario | What happens | Library affected? |
|----------|-------------|-------------------|
| Standard packet, no task changes | `QuoteLineItem` points to `ScopePacketRevision` directly | No |
| Price/qty/description overrides only | Overrides stored on `QuoteLineItem` | No |
| Task added/removed/reordered | System creates `QuoteLocalPacket` (deep copy); `QuoteLineItem` switches reference | No |
| AI-drafted scope from text/voice/documents | Created as `QuoteLocalPacket` directly | No |
| Ad hoc manual line item | Stored on `QuoteLineItem` (literal, no packet) | No |

### Promotion to global library

**Canon amendment — interim one-step promotion (first implementation slice).** The first promotion epic collapses the multi-step admin-review flow into a single estimator-driven step. The deferred admin-review workflow (`DRAFT` → `IN_REVIEW` → publish) remains canon for a later epic and is **not** withdrawn.

**Interim flow (authorized for first implementation epic):**

1. Estimator clicks **"Promote to Global Library"** on a `QuoteLocalPacket` and supplies a **`packetKey`** (slug, unique per tenant).
2. Server **validates `packetKey` uniqueness** within the tenant (`@@unique([tenantId, packetKey])`). Duplicate key → **promotion rejected**.
3. Server creates a new **`ScopePacket`** (tenant-scoped).
4. Server creates a **first `ScopePacketRevision`** (`revisionNumber = 1`) in **`DRAFT`** status with `publishedAt = null`.
5. Server copies `QuoteLocalPacketItem` rows → `PacketTaskLine` rows on the new revision per the mapping contract in `05-packet-canon.md` ("Canonical `QuoteLocalPacketItem` → `PacketTaskLine` mapping contract").
6. Source `QuoteLocalPacket.promotionStatus` = **`COMPLETED`**, `promotedScopePacketId` set. Source packet otherwise unchanged.
7. **No admin queue is implemented.** The new revision stays in `DRAFT` until the deferred admin-review epic lands.

**Deferred (remains future canon):** admin queue UI, `IN_REVIEW` transition, publish workflow, tier-expansion review, cross-tenant sharing. The target multi-step publish canon stays on the roadmap; only the interim one-step compaction is authorized for the first slice.

**Picker contract:** Library packet pickers and AI grounding sources **must filter to `ScopePacketRevision.status = PUBLISHED`**. Revisions produced by the interim promotion flow are `DRAFT` and must not appear as selectable library packets until the admin-review epic publishes them.

### Metadata ownership

- **Library metadata** (instructions, labor hints, evidence requirements): Owned by the `ScopePacketRevision`, managed by Admin/Catalog Author.
- **Local metadata**: Owned by the `QuoteLocalPacket`, managed by the Estimator for that quote only.
- **Promoted metadata**: Initial values from the `QuoteLocalPacket`, but once published, owned by the new Library object.

### Reuse philosophy

- The scope packet library is **curated reusable scope structure** — the primary way trades express "what we install/service/upgrade" as repeatable SKUs.
- **One-off work stays local by default.** Quote-local modifications and AI drafts do not enter the library automatically.
- **Promotion is explicit and human-reviewed.** Estimators request; admins approve.
- **Runtime actuals feed learning, not automatic library mutation.** Observed job data may propose updates to library defaults, but never silently overwrites curated catalog truth.

## 26. Out of scope

- **Marketplace** sharing packets across tenants.

## 27. Open questions

- **Effective dating** for price book linkage — if separate from packet revision.
- **Admin-review workflow shape** (future epic): exact states, notifications, reviewer assignment, diff UX for promoted `DRAFT` revisions authored via the interim one-step flow.
