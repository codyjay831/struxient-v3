# Struxient v2 → v3 migration notes (planning)

**Status:** **Evidence-informed**, **not authoritative** for v3 canon. Use v2 repo/docs only to anticipate **data** and **UX** carryover.  
**v3 authority:** `docs/canon/*`, `docs/decisions/*`, `docs/epics/*`, `docs/planning/01-id-spaces-and-identity-contract.md`.

---

## 1. Direct conceptual mappings (reuse idea, reshape implementation)

| v2 concept (informal) | v3 concept | Notes |
|----------------------|------------|--------|
| `BundleTemplate` | **ScopePacket** + **ScopePacketRevision** | v3 splits **header** vs **immutable revision** for pinning at send (`canon/05`, planning `01`). |
| `QuoteLineItem` | **QuoteLineItem** under **QuoteVersion** | Commercial truth stays on line items (`canon/02`). |
| `QuoteVersion.snapshot` | **GeneratedPlan** + **ExecutionPackage** + commercial snapshot | v3 **names** artifacts distinctly (`canon/04` plan vs package). |
| `WorkflowVersion.snapshot` | **`workflowVersionId`** immutable graph | Same idea; v3 forbids workflow-first sales (`canon/01`, `09`). |
| `Flow` pinned to version | **`flowId`** runtime instance | Same spine (`canon/02`). |
| `RuntimeTask` | **RuntimeTask** / `runtimeTaskId` | Preserve **manifest** meaning; **must not** reintroduce JobTask bridges (`canon/09`). |
| `TaskExecution` | **TaskExecution** append-only | Keyed by **executable** id; v3 **requires** skeleton vs runtime clarity (`canon/04`, `decisions/02`). |
| `PaymentGate` job-scoped | **PaymentGate** | v3 replaces **`PaymentGateTask.jobTaskId`** with **skeleton/runtime targets** (`decisions/02`). |
| `Hold` + `HoldType.PAYMENT` | **Hold** linked to **PaymentGate** | Concept preserved; **taskId** must be **executable** id space (`decisions/02`). |
| `ScheduleBlock` + time classes | **ScheduleBlock** | MVP **non-authoritative** (`decisions/01`); v2 split-brain must not be replicated in UX (`canon/09#7`). |
| `FlowGroup` / `Job` relationship | **FlowGroup** + **Job** timing | v3 default **job ensured by sign**, activation reuse (`decisions/04`). |

---

## 2. Concepts that must be **reshaped** (not copied raw)

| v2 pattern | v3 requirement | Migration implication |
|------------|----------------|----------------------|
| **JobTask** bridges | **Banned** for new execution (`canon/09#5`) | **Read-only** legacy jobs; **do not** extend. Map old rows to **runtime/skeleton** where possible **once** per tenant (`decisions/02` mentions migration script idea). |
| **String payment mapping** (`nodeName`, `taskName`) | **Banned** (`canon/09#6`, `decisions/02`) | Rebuild gate targets using **explicit ids**; **manual** mapping UI for legacy. |
| **Parallel `InspectionCheckpoint` progression** | **Folded** into tasks + execution (`decisions/03`) | **No new** checkpoint truth rows for v3-native; legacy jobs may **dual-read** for a window (decision doc). |
| **Collapsed “task” vocabulary** | Four layers + plan/package artifacts (`canon/04`) | APIs and DB comments must be audited for **generic taskId**. |
| **“Packet” == “package”** naming drift | **Scope packet** vs **execution package** (`canon/05`, `09#2`) | Rename UI/docs; **avoid** importing v2 terminology into v3 schema column names without care. |
| **Dual progress math** | **Single** v3-native derivation (`canon/09#8`) | Legacy jobs labeled **legacy progress** if old formula must remain read-only. |

---

## 3. Likely **read-only / deprecated** in v3 era

| Area | v3 stance |
|------|-----------|
| **JobTask**-based execution paths | **Deprecated**; **no new writes** (`canon/09`). |
| **legacy-payment-bridge** style resolvers | **Deprecated**; replaced by **id** mapping table (`decisions/02`). |
| **InspectionCheckpoint** as **gating** truth | **Deprecated for v3-native**; legacy read/migrate only (`decisions/03`). |
| **Workflow-first quoting** features | **Out of product** for wedge (`canon/01`); any v2 affordances should not be **default** in v3 UI. |

---

## 4. What **must not** be carried forward raw

| Carryover risk | Why |
|----------------|-----|
| **Generic `taskId` columns** without `kind` | Reintroduces payment/execution ambiguity (`planning/01`). |
| **Quote mutation after send** | Violates freeze canon (`canon/03`). |
| **Silent compose reroutes** | Violates `canon/09#12` honest compose. |
| **Calendar implied start authority** | Violates `decisions/01` + `canon/09#7`. |
| **AI writing snapshots** | Violates `canon/08-ai`. |

---

## 5. Data migration strategy buckets (planning)

| Bucket | Approach |
|--------|----------|
| **Catalog** | Export/import **packet revisions** as immutable rows; map `bundleKey` → `packetKey` with audit. |
| **Templates** | Publish new `workflowVersionId`; **remap** packet line `targetNodeId` if node ids changed (epic 16 warns). |
| **Open quotes** | Finish in v2 **or** convert draft → v3 representation **before** first v3 send — **policy** per tenant. |
| **Signed + activated jobs** | **Freeze** legacy execution modes; **read-only** JobTask paths if present; **new CO** in v3 uses v3 id rules. |
| **Payments** | Rebuild **PaymentGateTarget** rows with **executable** ids; **disable** gates until mapped (`decisions/02` risk). |

---

## 6. Supporting evidence files (non-authoritative pointers)

Use v2 reverse-engineering / schema docs in the repo **only** to locate:

- Where **`TaskExecution.taskId`** already aligns with packaged path.
- Where **`ScheduleBlock`** classes exist.
- Where **`activation-from-package`** enforces `flowGroupId`.

Do **not** treat those documents as v3 normative sources.

---

## 7. v3 planning outputs that drive migration work

1. `01-id-spaces-and-identity-contract.md` — target API + table shapes for **task references**.  
2. `03-schema-planning-pack.md` — which entities are **immutable** at freeze.  
3. `06-schema-planning-open-issues.md` — **multi-flow**, **O12**, **pre-activation gates** decisions affect **migration** difficulty.
