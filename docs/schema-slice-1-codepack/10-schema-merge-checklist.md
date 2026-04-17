# Slice 1 — Schema merge checklist (v0 + normative extension)

**Purpose:** Guardrail for turning **staged planning docs** into **implementation-ready** `schema.prisma` / migrations **without** misreading base v0 as the full story or “simplifying away” settled Slice 1 entities.

**Does not:** generate Prisma, replace `slice-1-extension-prejobtask-quotelocalpacket.md`, or restate full canon.

---

## 1. Why this exists & reading order

The repo uses **layered** schema planning:

| Step | Doc | Use |
|------|-----|-----|
| 1 | `01-prisma-model-outline.md` | Field/relation blueprint per model |
| 2 | `03-prisma-schema-draft-v0.md` | **Base paste** (minimal; omits extension `model` blocks by design) |
| 3 | `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md` | **Normative merge** for `PreJobTask`, `QuoteLocalPacket`, `QuoteLocalPacketItem`, XOR completion |
| 4 | `docs/implementation/decision-packs/prejobtask-schema-decision-pack.md`, `quotelocalpacket-schema-decision-pack.md` | Locked semantics when extension text needs confirmation |
| 5 | `04-slice-1-relations-and-invariants.md`, `03-slice-1-field-definitions.md`, `12-slice-1-builder-summary.md` | Invariants, columns, handoff context |

**Correct mental model:** **Planned Slice 1 schema ≈ v0 ∪ extension** when the product persists quote-local scope and/or pre-job work. v0 **alone** is a **smaller first migration**, not a denial of extension entities.

---

## 2. Merge scope (must carry into implementation)

Check off as you merge into real `schema.prisma` / SQL (conceptual — **no code in this file**):

- [ ] **`PreJobTask`** model (and enum/status shape per extension illustration)
  - [ ] **`flowGroupId`** required; **`quoteVersionId`** optional
  - [ ] **No** FK to `Job` / `Flow` / `RuntimeTask`
  - [ ] Tenant/parent checks per extension (e.g. `tenantId` aligns with `FlowGroup`; optional quote version same FlowGroup)
- [ ] **`QuoteLocalPacket`** model
  - [ ] **`quoteVersionId`** required (version-scoped local scope)
  - [ ] Lineage / promotion fields per extension: e.g. `originType`, `forkedFromScopePacketRevisionId?`, `promotionStatus`, `promotedScopePacketId?`, `aiProvenanceJson?` (or agreed equivalent)
  - [ ] **Not** folded into `ScopePacket` / `ScopePacketRevision` as “just another revision”
- [ ] **`QuoteLocalPacketItem`** model
  - [ ] Child of `QuoteLocalPacket`; **`lineKey`**, **`sortOrder`**, tier/placement fields aligned with compose (`targetNodeKey` / parity with `PacketTaskLine` planning)
  - [ ] `@@unique([quoteLocalPacketId, lineKey])` (or equivalent) — **stable line identity** for local path
- [ ] **`QuoteLineItem`**
  - [ ] **`quoteLocalPacketId`** present when product persists quote-local scope
  - [ ] Prisma **`quoteLocalPacket` `@relation`** + reverse on `QuoteLocalPacket` (v0 may show column **without** relation — that is **staged syntax**, not “skip relation”)
  - [ ] **`scopePacketRevisionId`** nullable where XOR applies; manifest lines: **exactly one** of `scopePacketRevisionId` / `quoteLocalPacketId` when line type requires packet-backed scope (`04`, `planning/01` §5–6)
- [ ] **XOR enforcement:** DB `CHECK` and/or transactional validation — **documented** even if enforced only in app on day one
- [ ] **Post-send immutability** for `QuoteLocalPacket` / `QuoteLocalPacketItem` for sent versions (same **class** as line items per extension + `04`)

---

## 3. Staged vs settled vs still open

| Category | Meaning | Examples |
|----------|---------|----------|
| **Staged in v0 file** | Omitted or partial **in the paste** for ergonomics | No `model PreJobTask` / `QuoteLocalPacket` / `QuoteLocalPacketItem` in v0 block; `quoteLocalPacketId` without `@relation` until parent model merged |
| **Semantically settled** | **Decided** in decision packs + extension; implementers **must not** reinterpret | XOR; `PreJobTask.flowGroupId` required; `QuoteLocalPacket.quoteVersionId` required; quote-local is **not** library packet canon; no runtime FKs from pre-job / quote-local to execution graph |
| **Truly open / deferred** | **Product or Slice 2** — not “unknown” because v0 skipped it | `TaskDefinition` table vs EMBEDDED-only seeds; exact `onDelete` for draft version delete vs soft-delete; `sendClientRequestId` uniqueness strategy (`08-open-implementation-questions.md`); AI job FK vs JSON provenance |

**Rule:** **“Not pasted yet” ≠ “not decided yet.”** Resolve ambiguity from **extension + packs**, not from v0 absence.

---

## 4. Must-not-regress (anti-drift)

- [ ] Do **not** model **`PreJobTask`** as **`RuntimeTask`** (or subtype).
- [ ] Do **not** fold **`QuoteLocalPacket`** into library **`ScopePacket` / `ScopePacketRevision`** rows.
- [ ] Do **not** drop **`quoteLocalPacketId`** because v0 looked “incomplete.”
- [ ] Do **not** revert to **library-only** manifest pinning; XOR stays.
- [ ] Do **not** treat missing **`@relation`** in v0 as “FK undecided” — add relation when merging extension models.
- [ ] Do **not** add FKs from these entities to **`Flow` / `Job` / `RuntimeTask`** in Slice 1.
- [ ] Do **not** break **quote-version-bounded** compose/freeze identity (`planning/01` §6, `07-snapshot-shape-v0.md`): frozen scope drives **`planTaskId`** inputs, not runtime.

---

## 5. Merge-complete checkpoints (before “done”)

Answer **yes** or **documented exception**:

- [ ] All **first-class** Slice 1 extension entities exist in schema when product needs them: `PreJobTask`, `QuoteLocalPacket`, `QuoteLocalPacketItem`?
- [ ] `QuoteLineItem.quoteLocalPacketId` has **intended FK + relation** when local scope is persisted?
- [ ] XOR between `scopePacketRevisionId` and `quoteLocalPacketId` **enforced or explicitly enforced in app** with ticket to add `CHECK`?
- [ ] Extension **tenant / version / FlowGroup** rules still satisfied in ERD or migration notes?
- [ ] Resulting schema **matches** `02` entity list, `03` fields, `04` invariants for touched models?
- [ ] **No stray “base-only” story** left in README/internal docs if merge shipped (i.e. team knows v0 was a **stage**, not the **final** Slice 1 graph)?

---

## 6. Allowed staging (narrow)

**OK to defer first migration** (only if product **does not** persist quote-local or pre-job yet):

- Omit `PreJobTask` / `QuoteLocalPacket` / `QuoteLocalPacketItem` **tables** until features ship **and** omit **`quoteLocalPacketId`** column **or** keep column unused — see `08-open-implementation-questions.md` (if column exists, XOR/version rules still apply once used).

**Not OK to silently omit** if product **will** persist quote-local or pre-job **in Slice 1**:

- Extension models, `quoteLocalPacketId` + relation, XOR, immutability after send, and lineage/promotion fields called out in extension illustration (adjust names only with pack alignment — **do not** delete semantics without a decision record).

---

## Related

- `09-builder-handoff-summary.md` — code build order after schema exists  
- `08-open-implementation-questions.md` — repo/migration blockers  
