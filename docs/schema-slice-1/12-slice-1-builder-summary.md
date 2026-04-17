# Slice 1 — Builder summary (implementation handoff)

**Read first:** `01-slice-1-scope.md`. **Then:** `04`, `06`, `07`, `08`, `09`.

---

## Build first (order)

1. **Tenancy + CRM anchors:** `Tenant`, `User`, `Customer`, `FlowGroup` (minimal fields `03`).
2. **Seeded catalog:** `ScopePacket`, `ScopePacketRevision`, `PacketTaskLine` (+ optional `TaskDefinition` per `11` OQ-1).
3. **Seeded workflow:** `WorkflowTemplate`, `WorkflowVersion.snapshotJson` valid against internal schema validator.
4. **Quote graph:** `Quote`, `QuoteVersion`, auto `ProposalGroup` “Items”, `QuoteLineItem`.
5. **Compose engine** (library): draft → plan rows → package slots (shared by preview + send).
6. **APIs:** catalog read, quote CRUD (draft), `compose-preview`, `send`, `GET` sent.
7. **UI:** workspace, grid, pickers, preview panel, send, read-only sent.

---

## Do not build yet

- Activation, `Flow`, `RuntimeTask`, execution endpoints.
- Signatures, portal, payments, holds, scheduling, change orders.
- Leads, structured inputs, assembly/AI.
- Full catalog authoring.
- Normalized plan/package tables (replace JSON).

---

## Schema extensions (plan now, UI optional)

**PreJobTask** and **QuoteLocalPacket** (+ **QuoteLocalPacketItem**) are **first-class planned relational schema** for Slice 1, specified in:

- `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md` (**normative merge layer** atop `docs/schema-slice-1-codepack/03-prisma-schema-draft-v0.md`)
- `docs/implementation/decision-packs/prejobtask-schema-decision-pack.md`
- `docs/implementation/decision-packs/quotelocalpacket-schema-decision-pack.md`

**Not speculative:** the v0 Prisma file intentionally omits these `model` blocks as a **smaller base paste**; **authoritative combined shape** = v0 **+** extension. The **first demo** may still follow strict `01-slice-1-scope.md` (catalog-only **UI**); teams should still **migrate toward** the extension schema so pre-job and quote-local scope do not collapse into `Job` / library tables.

---

## Success criteria (Slice 1)

1. User can create **customer + flow group + quote + draft version** with **lines** and **pinned workflow**.
2. **Compose preview** returns **errors** and **warnings** without persisting snapshots.
3. **Send** is **atomic**: `status = sent`, **both** JSON snapshots + hashes set, **or** full rollback.
4. **Sent** version: **no** API can mutate lines, groups, freeze columns, or status back to draft.
5. **Read-only sent view** shows commercial grid + plan/package structure from persisted artifacts.
6. **Identity:** no `runtimeTaskId` / ambiguous `taskId` in freeze JSON (`planning/01`).

---

## Successful demo output (what stakeholders see)

- A **sent** quote version with a **non-empty** line grid and a **frozen** plan/package breakdown (counts > 0).
- Evidence of **immutability** (attempted edit rejected or UI absent).
- **Staleness** story: preview after edit; send rejected until refresh.

---

## Key documents map

| Need | Doc |
|------|-----|
| Boundaries | `01` |
| Entity set | `02` |
| Columns | `03` |
| Rules | `04` |
| Preview | `05` |
| Transaction | `06` |
| JSON v0 | `07` |
| Routes | `08` |
| Screens | `09` |
| Scope creep | `10` |
| Tiny opens | `11` |

---

## If Slice 1 goes wrong, it will go wrong in these 5 ways

1. **Partial send (dishonest freeze)**  
   **Mistake:** Status flips to `sent` before both snapshots commit, or one blob written alone.  
   **Avoid:** Single DB transaction; integration tests assert `status`, `generatedPlanSnapshot`, and `executionPackageSnapshot` appear together; never return `200 sent` until commit succeeds.

2. **Silent compose reroute**  
   **Mistake:** Send uses a different code path than preview (different ordering, tier rules, or workflow read), so the customer sees preview A but gets B.  
   **Avoid:** One shared compose function; deterministic `sortKey` per `04`; pin workflow version id is the only graph source at send.

3. **Fake or mutable “sent”**  
   **Mistake:** Allowing PATCH on line items, groups, or snapshots after send; or “un-send”.  
   **Avoid:** API guards + DB constraints where possible; treat violations as `409`; document immutability in `04`.

4. **Identity hygiene collapse**  
   **Mistake:** Putting `runtimeTaskId`, `flowId`, or bare `taskId` into freeze JSON or public responses — **or** omitting **`scopeSource`** / local packet ids on plan rows.  
   **Avoid:** Schema lint for v0 shapes (`07`); code review against `planning/01` §6; use `planTaskId`, `packageTaskId`, `skeletonTaskId` with `source` / `kind`; plan rows **tag** library vs quote-local scope.

5. **Staleness / double-send race**  
   **Mistake:** Sending without matching `composePreviewStalenessToken`, or double-click creating two transactions.  
   **Avoid:** Require token match at send (`06`); idempotency key on send; UI disable + `SELECT FOR UPDATE` on version row.

---

## Classification

| Section | Type |
|---------|------|
| Build order | **Slice 1 recommendation** |
| Success criteria | **Normative for milestone** |
| Five failure modes | **Normative anti-patterns** |
