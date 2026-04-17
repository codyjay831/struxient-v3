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

- **ScopePacket** (`key`, `name`, `description`, `trade`, `status`, `publishedVersion`).

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

`draft` | `published` | `deprecated` | `archived`. Transitions: draft→published; published→deprecated (warn usage); any→archived.

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

1. Estimator clicks **"Promote to Global Library"** on a `QuoteLocalPacket`.
2. A new `ScopePacket` is created in `draft` status.
3. Admin reviews task content, labor estimates, and node placement for general use.
4. Admin publishes as a new `ScopePacketRevision`.
5. The original `QuoteLocalPacket` remains unchanged on its quote (historical record).

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
