# After-action: Activation / runtime shell — frozen-artifact canon hardening

**Date:** 2026-04-11  
**Role:** Durable activation boundary verification + strengthening (not a greenfield rewrite).

---

## 1. Objective

Establish and **prove** the **first activation path** from a **SIGNED** quote version with **send-time freeze** into a **job-linked Flow + manifest RuntimeTask shell**, with:

* **No** consumption of **live draft** scope at activation time  
* **Idempotent** “at most one activation per quote version”  
* **Job shell reuse** per **`decisions/04-job-anchor-timing-decision.md`**  
* **Provenance** from frozen **plan** + **package** artifacts  
* **Compile-time and production build** validation  

Prior work already added `Flow`, `Activation`, `RuntimeTask`, `POST …/activate`, and hash checks on the **package** blob. This pass **closes the canon gap** on the **generated plan** and documents the **full** runtime shell story for reviewers.

---

## 2. Scope completed

| Area | Status |
|------|--------|
| Tenant-scoped activation service | **`activateQuoteVersionForTenant`** + **`activateQuoteVersionInTransaction`** (unchanged entry, strengthened internals) |
| Public alias for “ensure” semantics | **`ensureActivationForSignedQuoteVersion`** → same implementation as **`activateQuoteVersionForTenant`** |
| HTTP entry | **`POST /api/quote-versions/[quoteVersionId]/activate`** (existing pattern) |
| Preconditions | **SIGNED**; **Job** on quote’s **FlowGroup**; full freeze blobs + hashes |
| Frozen-only materialization | **No** `getQuoteVersionScopeReadModel` / **no** `runComposeFromReadModel` in activation |
| Plan integrity | **Canonical SHA-256** of **`generatedPlanSnapshot`** vs **`planSnapshotSha256`** |
| Plan ↔ package alignment | Every **`planTaskId`** on each **manifest** package slot must exist in **`generatedPlanSnapshot.v0.rows`** |
| Package integrity | Existing canonical hash vs **`packageSnapshotSha256`**; pin match |
| Idempotency | **Unique `Activation.quoteVersionId`**; replay returns existing **Flow** + counts; **`skippedSkeletonSlotCount`** re-derived from frozen package on replay |
| Provenance on **RuntimeTask** | **`quoteVersionId`**, **`lineItemId`**, **`planTaskIds`**, **`packageTaskId`**, **`nodeId`**, **`flowId`**, **`tenantId`** |
| Shared error mapping | **`nextResponseForActivateQuoteFailure`** extended for new plan/slot failures |
| Build | **`npx tsc --noEmit`** + **`npx next build`** succeed |

**No new Prisma migration** in this pass — **`Flow` / `Activation` / `RuntimeTask`** were introduced in **`20260414120000_phase6_flow_activation_runtime`**.

---

## 3. Files changed (by purpose)

### Activation logic & canon comments

* **`src/server/slice1/mutations/activate-quote-version.ts`** — load **`planSnapshotSha256`** + **`generatedPlanSnapshot`**; **`plan_hash_mismatch`**; **`indexFrozenGeneratedPlanV0`**; **`plan_slot_mismatch`**; audit payload includes **`planSnapshotSha256`**; **`ensureActivationForSignedQuoteVersion`** export; module docstring states frozen-only boundary.

### Frozen plan indexing

* **`src/server/slice1/compose-preview/frozen-plan-for-activation.ts`** — parse **`generatedPlanSnapshot.v0`**, enforce **`quoteVersionId`** match, collect **`planTaskId`** set.

### API error mapping

* **`src/lib/api/activate-quote-failure-response.ts`** — **`PLAN_HASH_MISMATCH`**, **`invalid_plan_snapshot`** (uses indexer **code**), **`PLAN_PACKAGE_SLOT_MISMATCH`**, clarified **`MISSING_FREEZE`** copy.

### Public exports

* **`src/server/slice1/index.ts`** — export **`ensureActivationForSignedQuoteVersion`**.

### Documentation

* **`docs/implementation/reports/2026-04-11-activation-frozen-artifacts-canon-slice.md`** (this file).

---

## 4. Architecture / runtime decisions applied

1. **Freeze is the only compose input at activation**  
   Send/freeze already persisted **`generatedPlanSnapshot`** and **`executionPackageSnapshot`** with **matching hashes**. Activation **re-reads those JSON columns** from **`QuoteVersion`** under row lock — never the mutable line-item graph.

2. **Dual-hash gate**  
   Tampering with either blob without updating its hash fails closed (**409**).

3. **Structural coupling plan ↔ package**  
   Package slots carry **`planTaskIds`** from send-time compose. Activation **rejects** slots that reference **unknown** **`planTaskId`**s vs the **frozen plan**. That prevents “phantom” runtime rows detached from the **sold plan** artifact.

4. **Job vs execution birth**  
   **Job** is ensured at **sign** (default product path). **Activation** **never** creates a second Job; it **finds** the row by **`flowGroupId`**.

5. **PreJobTask / QuoteLocalPacket**  
   Unchanged: **not** promoted into **`RuntimeTask`**; no new edges.

6. **Skeleton slots in package**  
   Still **skipped** for **`RuntimeTask`** creation (**`execution-package-for-activation.ts`**) per **canon/03** (no skeleton duplication as manifest runtime).

---

## 5. Behavioral impact

* **Stricter activation**: Versions that are **SIGNED** but **missing plan blob/hash** (corrupt or pre-migration partial rows) now fail **`MISSING_FREEZE`** instead of activating on package alone.
* **New failure modes** (all tenant-scoped, predictable HTTP):
  * **`PLAN_HASH_MISMATCH`** — plan JSON does not match **`planSnapshotSha256`**
  * **Plan indexer errors** — wrong schema, **`PLAN_QUOTE_MISMATCH`**, bad **`rows`**
  * **`PLAN_PACKAGE_SLOT_MISMATCH`** — package references a **planTaskId** absent from frozen plan
* **Successful path unchanged** for well-formed send → sign → activate data.
* **Sign + `autoActivateOnSign`**: failures surface through the same **`nextResponseForActivateQuoteFailure`** branches (including new plan/slot kinds).

---

## 6. Validation performed

| Check | Result |
|--------|--------|
| **`npx tsc --noEmit`** | Pass |
| **`npx next build`** | Pass (compile, lint, typecheck in build) |
| DB migration | **None new**; existing Phase 6 migration remains authoritative |
| Runtime smoke (live POST) | Not executed in this environment; recommend: seed → send → sign → activate on a dev DB |

---

## 7. Known gaps / follow-ups

* **SKELETON `TaskExecution`** start/complete for template tasks (separate uniqueness model on **`TaskExecution`** when **`runtimeTaskId`** is null).
* **Holds / eligibility** (**`epic 30`**, **`decisions/01`**) before field start — not wired into activation.
* **Reactivation / change orders** — explicitly out of scope; new quote version / CO epic path later.
* **Activation record** stores **`packageSnapshotSha256`** only; plan hash is in **audit payload** — optional future column if reporting needs it without parsing audit.
* **Workstation UX** — **`workItems`** merge on **`GET /api/flows/[flowId]`** is read-side only; no new activation coupling.

---

## 8. Risks / caveats

* **Stricter activation** may surface **legacy or hand-edited DB rows** where plan/package diverged; that is **intentional** (fail closed) for integrity.
* **Idempotent replay** recomputes **`skippedSkeletonSlotCount`** by re-parsing the **stored** package — if package JSON were corrupted but row still present, count could be **0**; primary truth remains **RuntimeTask** count on **Flow**.

---

## 9. Recommended next step

1. **Manual smoke**: one full path **send → sign → activate** against Postgres, then **`GET /api/jobs/{jobId}`** and **`GET /api/flows/{flowId}`** to confirm **RuntimeTask** + **workItems**.  
2. **SKELETON execution** slice: design **`TaskExecution`** uniqueness for **`(flowId, skeletonTaskId, eventType)`** (likely **partial unique index** in SQL) without breaking **RUNTIME** rows.  
3. **Optional seed extension**: write **`STRUXIENT_DEV_FLOW_ID`** after activate for faster dev UX (product choice).

---

## Appendix: What exists vs does not

| Exists today | Does not exist yet |
|--------------|-------------------|
| **`Flow`** per activated **quote version** | Multi-flow per job, CO-driven second flow |
| **`Activation`** row (unique per **quote version**) | Reactivation / supersede workflow |
| **`RuntimeTask`** from **frozen package** slots (manifest) | Skeleton **TaskExecution** writes |
| **`TaskExecution`** for **RUNTIME** start/complete | Holds gate on start |
| **Job** reuse at activation | Job creation at activation only (non-default policy) |
| **GET** job / flow execution reads | Full **epic 36** effective merge with skeleton state |

---

## Canon / doc cross-reference (read during this pass)

* **`docs/decisions/04-job-anchor-timing-decision.md`** — Job at sign; activation reuses Job.  
* **`docs/canon/03-quote-to-execution-canon.md`** — activation consumes **freeze**; manifest runtime from **package**.  
* **`docs/epics/33-activation-epic.md`** — idempotent activation per version.  
* Prior implementation reports through **`2026-04-11-phase5-sign-job-shell.md`** and **`2026-04-11-phase6-activate-flow-runtime.md`** — schema/API baseline.  

This report **supersedes** informal “activation deferred” wording where it conflicted with **Phase 6** code already merged; it records the **canon-complete frozen-input** contract as of this hardening pass.
