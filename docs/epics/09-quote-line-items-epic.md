# Epic 09 — Quote line items

## 1. Epic title

Quote line items

## 2. Purpose

Define **quote line items** as the **primary sales-facing commercial rows**: description, quantity, pricing, proposal grouping, **execution mode**, and **manifest scope selection + tier** for scope-bearing lines per `02-core-primitives` and `05-packet-canon` (persisted as **`scopePacketRevisionId`** *or* **`quoteLocalPacketId`**, XOR — see §6a).

## 3. Why this exists

Customers and estimators reason in **proposal rows**. Line items are the **authority** for **sold price** and **which reusable scope** was selected; freeze expands them into **plan** and **package**.

## 4. Canon alignment

- **Line-item-fronted, packet-driven, task-definition-supported** (`01`, `05`).
- Line item **does not own** process graph, runtime state, or task definition bodies (`02`).
- **Quantity** expands manifest work deterministically (`03`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Estimator** | Add/edit/remove lines on **draft** version only (unless epic 11 allows pre-send draft overlays). |
| **Catalog admin** | Does not edit quote lines; edits **packets** (epic 15). |
| **Customer** | Sees **sent** line presentation via portal. |

## 6. Primary object(s) affected

- **QuoteLineItem** (per `QuoteVersion`).

## 6a. Persisted field names vs. product language

**Schema / API / DTOs (normative):** For manifest-scoped lines, the **library-backed** pin is **`QuoteLineItem.scopePacketRevisionId`** (FK → `ScopePacketRevision`). The **quote-local** pin is **`QuoteLineItem.quoteLocalPacketId`** (FK → `QuoteLocalPacket`). When the line type requires packet-backed scope, **exactly one** of these is non-null (XOR) — `docs/schema-slice-1/04-slice-1-relations-and-invariants.md`, `planning/01-id-spaces-and-identity-contract.md` §5–6.

**Product / UX language:** Estimators pick a **catalog packet** by **stable key** (`packetKey`) and **revision** in the UI; the server **resolves** that to a concrete **`scopePacketRevisionId`** on save/send. **`scopePacketRef` is not a schema field** — do not use it in Prisma, migrations, or API contracts; it has been **retired** from this epic in favor of the concrete names above.

## 7. Where it lives in the product

- **Quote editor** main grid; **packet picker** modal; **line detail** drawer for structured inputs and overrides.

## 8. Create flow

1. User **Add line** → choose **scope line** (packet+tier) OR **non-executing line** (fee, note-only) per `executionMode`.
2. For scope line (**catalog path**): user selects **packet** (UI: typically **`packetKey` + revision**); system persists **`scopePacketRevisionId`** after resolution. **Quote-local path:** user works against a **`QuoteLocalPacket`**; system persists **`quoteLocalPacketId`**. Then set **tier** (when tiering applies), **quantity** (≥1, integer or decimal per product).
3. System pulls **default description** and **suggested price** from catalog policy (tenant); user may override **customer-facing description** and **unit price**.
4. Save row → `lineId` stable within version; triggers **plan regen** preview (epic 31) in UI.

## 9. Read / list / detail behavior

**Grid columns:** Group, line #, description, qty, unit, extended, packet badge, tier, execution mode icon, **compose warnings** count.

**Sort:** Manual **drag** reorder within group (epic 10); **stable lineOrdinal** persisted.

**Detail drawer:** Structured inputs, **exclusions**, **instruction overrides**, **manual plan tasks** attached to this line (epic 31).

**Empty:** “Add a scope packet line to build executable scope.”

## 10. Edit behavior

- Draft only: change packet/tier/qty/price/description; changing packet **revalidates** template compatibility (epic 32 warnings).
- **Sent version:** lines **immutable**; changes go through **change order** / new version (epic 14, 37).

## 11. Archive behavior

- **Soft-remove line** on draft: `archived=true` hidden from proposal but restorable in **draft session**; on send, archived lines **excluded** from freeze.

## 12. Delete behavior

- **Hard delete** line on draft allowed if **no dependencies**; confirm if line has structured answers.

## 13. Restore behavior

- Restore archived line on draft from **removed lines** panel.

## 14. Required fields

| Field | Type | Why |
|-------|------|-----|
| `quoteVersionId` | FK | Parent. |
| `lineOrdinal` | number | Order within proposal. |
| `executionMode` | enum | Scope-generating vs non-executing. |
| For manifest scope lines: **`scopePacketRevisionId` (library)** *or* **`quoteLocalPacketId` (quote-local)** + `tier` when tiering applies | | **XOR** — exactly one scope source; both are first-class for compose/freeze (`planning/01` §5–6). Column names match slice-1 schema (`03-slice-1-field-definitions.md`). |
| `quantity` | decimal | Expansion rules. |
| `unitPrice`, `lineTotal` or computed | money | Commercial truth (`07-time-cost`). |

## 15. Optional fields

`internalSku`, `taxCategory`, `discountReason`, `proposalVisibility` (hide line from customer PDF — rare, audited).

## 16. Field definitions and validations

- **Money:** non-negative unless credit line allowed; rounding per tenant.
- **Quantity:** >0; max ceiling per tenant.
- **Scope pin:** **library** path must resolve to a **published** revision at send; **quote-local** path must reference a **`QuoteLocalPacket`** on the same `quoteVersionId`, frozen immutably with the line at send (`04`).

## 17. Status / lifecycle rules

Line: `active` | `archived` within draft; frozen copy **immutable** post-send.

## 18. Search / filter / sort behavior

- Within editor: filter lines by packet key, by warning presence.
- Global search hits **line descriptions** in **draft** only or **sent** via indexed snapshot (epic 58).

## 19. Relationships to other objects

- **Catalog path:** **Line N—1 `ScopePacketRevision`** via **`scopePacketRevisionId`** + tier **OR** **quote-local path:** **Line N—1 `QuoteLocalPacket`** via **`quoteLocalPacketId`**; **1—* structured answers**; **provenance** to **plan tasks** at freeze.
- When a line’s **library** scope is **forked** (task add/remove/reorder), **`scopePacketRevisionId` is cleared** and **`quoteLocalPacketId`** is set to the deep copy. Minor overrides (qty, price, description) remain on the line item itself.

## 20. Permissions / visibility

- Estimator edit; **customer** sees only **customer-visible** lines on portal.

## 21. Mobile behavior

- **Read-only** line list on mobile for field context; editing desktop-first.

## 22. Notifications / side effects

- Line changes bump `quoteVersion.updatedAt`; optional **collaboration** notify co-editors.

## 23. Audit / history requirements

- Log add/remove/edit of commercial fields on draft; post-send line changes **only** via new version/CO with new audit trail.

## 24. Edge cases

- **Packet deprecated** after draft started: warn on send; block if hard-incompatible.
- **Quantity fractional** for labor sell — tenant policy.

## 25. What must not happen

- **Workflow-first** line creation (dragging skeleton tasks as **primary** SKU path) — banned (`09`).
- **Collapsed** line item with **runtime task** identity.

## 26. Out of scope

- **Tax engine** full specification; **GL codes**.

## 27. Open questions

- **O10** — **CLOSED**. Override bounds resolved by bridge decision pack: minor overrides stay on `QuoteLineItem`; task-level structural changes fork into `QuoteLocalPacket`. See Epic 15, §25a.
