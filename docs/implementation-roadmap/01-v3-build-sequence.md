# Struxient v3 — Build sequence (phased)

**Status:** Implementation order optimized for a **working quote-to-execution spine**, not epic file order.  
**Authority:** `docs/canon/*`, `docs/decisions/*`, `docs/epics/*`, `docs/planning/*`.  
**Schema handoff:** Staged Prisma v0 + normative extension + merge checklist — `docs/schema-slice-1-codepack/10-schema-merge-checklist.md` (do not treat v0 paste as the full Slice 1 graph when quote-local / pre-job are in scope).

**Assumptions baked into this sequence**

- **Single active `flowId` per `jobId`** until **O2** is explicitly in scope (`planning/06`).
- **MVP scheduling does not gate start** (`decisions/01`).
- **Office sign** acceptable before full customer portal (**O16/O17** deferred from critical path).
- **Freeze payloads** can start as **version-scoped blobs + relational line items** (hybrid) per `planning/03` / **O12** spike — **do not** block the spine on perfect normalization.

---

## Phase 0 — Platform skeleton (days, not weeks)

**Delivers**

- Tenant boundary, auth, **permission registry v0** (small hardcoded set is fine if centralized), structured errors, **idempotency** pattern on mutations (`planning/04`).
- **API rule:** no bare `taskId` in v3 contracts (`planning/01`).
- CI, environments, feature flags shell (`epic 60` subset).

**Dependencies**

- None (greenfield).

**May stub**

- Email/SMS (log only), full audit UI (write `AuditEvent` rows, minimal viewer later).

---

## Phase 1 — CRM anchors (minimum viable intake)

**Delivers**

- `Customer`, `FlowGroup` (project/site), minimal `User` assignment optional (`epics 02–03`).
- Optional: `Lead` **after** quote path works — **not** on spine critical path (`epic 01` defer friendly).

**Dependencies**

- Phase 0.

**May stub**

- Contacts/contact methods polish (`epic 04`), notes/files (`epics 05–06`) — add once quote exists.
- **`PreJobTask`** (FlowGroup-anchored pre-activation work) — **optional** before quote path ships; when needed, merge per extension doc (`slice-1-extension-prejobtask-quotelocalpacket.md`), **not** as `RuntimeTask` (`epic 03`, decision pack).

---

## Phase 2 — Catalog + template seeds (authoring-lite)

**Delivers**

- **One published** `scopePacketRevisionId` with **packet task lines** carrying **`targetNodeId`** (`epics 15–16`, `canon/05`).
- **One published** `workflowVersionId` snapshot containing **nodes + skeleton tasks + minimal gates/completion** (`epics 23–27`, `canon/06`).
- **Compatibility:** packet lines’ `targetNodeId` **must exist** in the snapshot used for compose (`epic 32`).

**Dependencies**

- Phase 0 (tenant).

**May stub**

- Full catalog CRUD UI, tiers matrix complexity (`epic 19`), assemblies (`epic 20`), AI (`epics 21–22`).
- **Authoring** can be **admin-only JSON import** or internal tools for the first month — **ship readability in product later**.

---

## Phase 3 — Quote draft + commercial rows

**Delivers**

- `Quote`, `QuoteVersion` (`draft`), `QuoteLineItem` with manifest scope **either** **pinned catalog revision** **or** **quote-local packet** (XOR) + tier + qty + execution mode (`epics 07–09`, `planning/01` §5–6).
- Optional `ProposalGroup` — **stub** as single default group (`epic 10`).
- Process template **selection** stored on **version** (recommended in `epic 07` open question — **pick version-scoped** and implement that way).

**Dependencies**

- Phase 1 (customer + flow group).
- Phase 2 (packet + template ids exist).

**May stub**

- Structured inputs beyond **what send gate needs** (`epic 18`) — start with **no REQUIRED_TO_SEND** fields or office-only commit.
- **`QuoteLocalPacket` / `QuoteLocalPacketItem`** tables — **defer** first migration only if product will not persist quote-local scope yet; if lines use **`quoteLocalPacketId`**, merge extension models + relation (`10-schema-merge-checklist.md`).

---

## Phase 4 — Compose + send (freeze transaction)

**Delivers**

- Deterministic **generated plan** + **execution package** persisted and **immutable** after `sent` (`canon/03`, `epics 11–12`, `31–32`).
- **Honest** compose errors/warnings surfaced (`canon/09#12`).
- Quote version transition `draft → sent` **atomic** with freeze artifacts (`epic 12`).

**Dependencies**

- Phase 3.
- Phase 2 snapshot must match placement targets.

**May stub**

- Async send for huge quotes (`epic 12` OQ) — **sync** first.
- PDF generation — **stub** with “proposal payload recorded” + HTML preview optional.

---

## Phase 5 — Sign + job shell (`decisions/04`)

**Delivers**

- `QuoteSignature` record + `signed` transition (`epic 13`).
- **`ensureJobForFlowGroup`** on sign by default (`decisions/04`, `epic 34`).
- **No second job** for same flow group on packaged path (`decisions/04`).

**Dependencies**

- Phase 4 (sent version exists).

**May stub**

- Portal signing; use **office-recorded** acceptance for MVP if legal allows (`O16`).

---

## Phase 6 — Activation + runtime materialization

**Delivers**

- Idempotent `Activation` (`epic 33`).
- `Flow` pinned to `workflowVersionId` (`canon/03`).
- `RuntimeTask` rows for **manifest** package classifications; **no** duplicate skeleton as runtime (`canon/03`, `epic 35`).
- **Folded inspection:** manifest tasks only — **no** new parallel inspection truth table (`decisions/03`, `epic 38`).

**Dependencies**

- Phase 5 (signed + job shell policy satisfied).
- `planning/01` identity rules implemented in writes.

**May stub**

- Change orders (`epic 37`), ad-hoc runtime injection (`epic 35`), detours (`epic 28`) — add after **start/complete** works.

---

## Phase 7 — Execution truth + eligibility

**Delivers**

- `TaskExecution` append-only for **tagged** skeleton/runtime (`canon/04`, `epics 41`, `planning/01`).
- Central **start eligibility** excluding scheduling enforcement MVP (`decisions/01`, `epic 30`).
- **Effective projection** read API (`epic 36`).

**Dependencies**

- Phase 6.

**May stub**

- Evidence required flags enforcement beyond **one photo optional** (`epic 42`).
- Admin “force start” (`epic 30`).

---

## Phase 8 — Field UI spine

**Delivers**

- Work feed + task detail **start/complete** (`epics 39, 41, 43` subset).
- Node board simplified (`epic 40`).

**Dependencies**

- Phase 7.

**May stub**

- Mobile polish, offline queue — **online required** for start/complete initially (`epic 43`).

---

## Phase 9 — Money + holds (when “pay before work” is MVP)

**Delivers**

- `PaymentGate` + `PaymentGateTarget` with **explicit** ids (`decisions/02`, `epics 47–48`).
- `Hold` integration composing with eligibility (`epics 29–30`).

**Dependencies**

- Phase 6+ (runtime ids exist for manifest targets; skeleton targets allowed earlier per business choice — see `planning/06` #4).

**May defer entirely** if first wedge customers **do not** payment-gate tasks.

---

## Phase 10 — Portal, notifications, scheduling UX, CO, learning

**Delivers**

- Customer portal (`epics 53–55`) when GTM requires (**O17**).
- Notifications (`epic 56`), schedule blocks (`epics 45–46`) as **planning-only** UX early.
- CO (`epic 37`), learning (`epic 52`) after spine stable.

**Dependencies**

- Phases 4–8 for meaningful integrations.

---

## Phase dependency graph (compressed)

```
0 Platform
  ↓
1 CRM anchors
  ↓
2 Catalog + template seeds
  ↓
3 Quote draft
  ↓
4 Send/freeze  →  5 Sign + job  →  6 Activate + runtime
                              ↓
                         7 Execution + eligibility
                              ↓
                         8 Field UI
                              ↓
                    9 Money/holds (optional MVP)
                              ↓
                         10 Portal / ops / growth
```

---

## What this sequence intentionally delays

- **Leads** full CRM polish (`epic 01`) — not needed to prove spine.
- **Assemblies** (`epic 20`) — secondary path.
- **AI** (`epics 21–22`) — accelerator only (`canon/08-ai`).
- **Multi-flow** (**O2**) — do not build until wedge ships.
- **InstallItem** (**O4**) — only if customer profile demands.
- **Full portal** — optional for first **trade-first** field proof (`O17`).
