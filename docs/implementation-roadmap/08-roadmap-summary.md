# Struxient v3 — Implementation roadmap summary (one page)

**Audience:** Builders and stakeholders deciding **what to build next**.  
**Authority:** `docs/canon/*`, `docs/decisions/*`, `docs/epics/*`, `docs/planning/*`, `docs/implementation-roadmap/*`.

---

## What we are building first

A **vertical spine**, not horizontal layers:

1. **Freeze send** — draft quote lines + compose + **atomic sent** with **plan + execution package** snapshots (`canon/03`, `epics 12`, `31–32`).
2. **Activation** — idempotent **flow + manifest runtime tasks** from frozen package (`canon/03`, `epics 33`, `35`).
3. **Execution truth** — **tagged** start/complete via **`TaskExecution`** (`canon/04`, `planning/01`, `epic 41`).

Everything else is **supporting** or **deferrable** until that spine demos.

---

## Phases (compressed)

| Phase | Outcome |
|-------|---------|
| **0** | Platform/auth/standards (`01-v3-build-sequence.md`) |
| **1** | CRM anchors |
| **2** | Seeded catalog + published template snapshot |
| **3–4** | Quote draft + **send/freeze** |
| **5–6** | Sign + job + **activation** |
| **7–8** | Eligibility + **field UI** |
| **9+** | Payment gates (if needed), portal, CO, learning |

---

## First three vertical slices (ship criteria)

| Order | Slice | Proves |
|-------|-------|--------|
| **1** | **V2 Freeze send** (`02-vertical-slices.md`) | Immutability + honest compose |
| **2** | **V4 Activation** (+ **V3 sign/job** in same milestone if needed) | Bridge freeze → runtime |
| **3** | **V5 Manifest execution** (+ **V6 skeleton** next) | Field truth + dual executable universe |

---

## MVP critical path (binary)

Office can: **quote → send → sign → activate → complete a manifest task** with **no workflow-first path**, **no bare taskId APIs**, **no scheduling-gated start**, **no parallel inspection truth** for v3-native (`03-mvp-critical-path.md`).

---

## Highest risks

| Risk | Mitigation headline |
|------|---------------------|
| Partial freeze / lying “sent” | Single transaction; failure tests (`04-high-risk-areas.md` R1) |
| Template/packet node mismatch | Publish-time validation + shared seeds (R2) |
| Task identity collapse | `ExecutableTaskRef` enforced in **first** API slice (R4) |
| Activation/job duplication | Unique constraints + idempotent API (R3) |
| Eligibility split-brain | One server eligibility function (R6) |

---

## First schema slice

**Relational (core):** Tenant, User, Customer, FlowGroup, ScopePacket/Revision/Line, WorkflowTemplate/Version (`snapshotJson`), Quote, QuoteVersion, QuoteLineItem.  
**Relational (planned Slice 1 extension — merge with v0 paste):** `PreJobTask` (FlowGroup-anchored, pre-activation), `QuoteLocalPacket`, `QuoteLocalPacketItem`, plus **`QuoteLineItem.quoteLocalPacketId`** + XOR with **`scopePacketRevisionId`** (`docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md`, `docs/schema-slice-1-codepack/10-schema-merge-checklist.md`).  
**Blobs on sent version:** `generatedPlanSnapshot`, `executionPackageSnapshot` (**O12** hybrid — `05-first-schema-slice.md`).

**Prisma layering:** Base draft `03-prisma-schema-draft-v0.md` + normative extension — not two conflicting stories (`01-prisma-model-outline.md`).

**Not yet (Slice 2):** Flow, RuntimeTask, TaskExecution.

---

## First API slice

**`compose:preview` + `send`** with **Idempotency-Key**, warnings acknowledgement, and **ExecutableTaskRef** type defined up front (`06-first-api-slice.md`).

---

## First UI slice

**Quote workspace** (line grid + template picker + compose panel + send) — proves **line-item-fronted** v3 (`07-first-ui-slice.md`).

---

## Best next action (immediately after this roadmap)

**Run a 1–2 week milestone** with exit criteria:

- [ ] Seed **one** published packet revision + **one** published workflow snapshot with **matching node ids**.  
- [ ] Implement **preview compose** + **send** per `06-first-api-slice.md`.  
- [ ] Ship **quote workspace UI** per `07-first-ui-slice.md`.  
- [ ] Record a **5-minute demo**: draft → preview warnings → send → read-only frozen view.

Then start **schema slice 2** (Job/Flow/Activation/RuntimeTask/TaskExecution) and wire **sign + activate** internal UI.

---

## File index (this folder)

| File | Role |
|------|------|
| `01-v3-build-sequence.md` | Phased order + dependencies |
| `02-vertical-slices.md` | E2E slices + first 3 |
| `03-mvp-critical-path.md` | Must / defer |
| `04-high-risk-areas.md` | Drift risks + mitigations |
| `05-first-schema-slice.md` | First tables + hybrid blobs |
| `06-first-api-slice.md` | First contracts |
| `07-first-ui-slice.md` | First screens |
| `08-roadmap-summary.md` | This page |
