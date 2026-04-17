# Slice 1 — Scope (strict)

**Status:** Normative **schema/API/UI design boundary** for the first build milestone.  
**Authority:** `docs/canon/*`, `docs/decisions/*`, listed epics, `docs/planning/*`, `docs/implementation-roadmap/*`.  
**Non-authority:** Struxient_v2 (evidence only if ever cited elsewhere).

---

## Slice 1 mission

Deliver the **smallest** end-to-end product slice where an **office user** can:

1. Create **CRM anchors** (customer + project/site).
2. Attach a **draft quote version** to those anchors.
3. Add **quote line items** with manifest scope pinned **either** to **seeded** catalog **scope packet revisions** **or** to **quote-local packets** (XOR per `planning/01` §5–6; first demo may be catalog-only), plus **tiers** where applicable.
4. Select a **seeded published workflow version** for the quote version.
5. Run **compose preview** (dry-run) that returns **errors** (blocking) and **warnings** (non-blocking, acknowledgeable).
6. Execute **Send** as a **single transactional freeze**: version becomes **`sent`**, **immutable**, with **frozen relational line items** and **persisted snapshot blobs** (`generatedPlanSnapshot`, `executionPackageSnapshot`).
7. Open a **read-only** view of the **sent** quote version (no further commercial or freeze mutation).

---

## User flow supported (single primary path)

```
Create customer → Create flow group (project)
  → Create quote + draft quote version
  → Add line items (scope pin: catalog revision **or** quote-local packet, XOR + tier + qty + commercial fields)
  → Pick published workflow version (pin on version)
  → Compose preview → fix errors → acknowledge warnings
  → Send / freeze
  → View sent quote (read-only)
```

**Not supported:** customer portal, e-sign, activation, field execution, money.

---

## Required objects (must exist in Slice 1 design)

| Area | Objects |
|------|---------|
| **Tenancy / auth** | `Tenant`, `User` (minimal), membership/role stub |
| **CRM** | `Customer`, `FlowGroup` |
| **Catalog (seeded)** | `ScopePacket`, `ScopePacketRevision`, `PacketTaskLine` |
| **Template (seeded)** | `WorkflowTemplate`, `WorkflowVersion` (snapshot contains nodes, gates, skeleton tasks, completion rules per epics 23–27) |
| **Quote** | `Quote`, `QuoteVersion`, `QuoteLineItem` |
| **Presentation (minimal)** | `ProposalGroup` (see **Slice 1 decision** below) |
| **Freeze payloads** | `QuoteVersion.generatedPlanSnapshot` (JSON), `QuoteVersion.executionPackageSnapshot` (JSON) |

---

## Explicitly excluded objects (Slice 1)

| Excluded | Rationale |
|----------|-----------|
| `Lead` | Not on freeze spine (`epic 01`). |
| `Contact`, `ContactMethod` | CRM polish (`epic 04`). |
| `Note`, `FileAsset` (polymorphic) | `epics 05–06`. |
| `StructuredInputAnswer` | **Slice 1 decision:** **exclude** — no `REQUIRED_TO_SEND` gating in v0 (`epic 18`); add Slice 2+ when send gates need it (`planning/06` O17 adjacent). |
| `QuoteSignature` | Post-send lifecycle (`epic 13`) — **Slice 2**. |
| `Job`, `Flow`, `Activation`, `RuntimeTask`, `TaskExecution` | Execution domain (`planning/01`); **zero** runtime tables in Slice 1. |
| `PaymentGate`, `Hold`, `DetourRecord` | Money/ops (`epics 47–48`, `28–29`). |
| `ScheduleBlock` | Scheduling (`decisions/01`). |
| `ChangeOrder` | Post-activation (`epic 37`). |
| Full **catalog authoring** CRUD | Seeds only (`implementation-roadmap/01`). |
| **Assembly** rule engine | Secondary (`epic 20`). |
| **AI** jobs | `epics 21–22`. |

---

## Why Slice 1 stops at **sent** + read-only (not signed, not activated)

- **Freeze honesty** and **compose integrity** are the **first canon cliff** (`canon/03`, `canon/09#12`). Signing and activation introduce **job/flow/runtime identity** (`decisions/04`, `planning/01`) — **Slice 2**.
- Demos prove **“we can honestly sell and freeze scope + package”** before proving **field birth**.

---

## What Slice 2 will pick up (handoff)

| Slice 2 theme | Starts with |
|---------------|-------------|
| **Commercial acceptance** | `QuoteSignature`, `quoteVersion.status` → `signed` |
| **Job shell** | `Job`, `ensureJobForFlowGroup` on sign (`decisions/04`) |
| **Execution birth** | `Flow`, `Activation`, `RuntimeTask`, `TaskExecution` |
| **Structured inputs** | If product requires `REQUIRED_TO_SEND` / portal (`O17`) |

---

## Slice 1 decisions (product/engineering, not canon changes)

| Topic | Slice 1 decision |
|-------|------------------|
| **Freeze storage** | **Hybrid:** relational **line items** + **JSON blobs** on `QuoteVersion` for plan + package (`implementation-roadmap/05`, `planning/06` O12 deferred for normalization). |
| **ProposalGroup** | **Include** minimal `ProposalGroup` + required `QuoteLineItem.proposalGroupId` — **one default group** auto-created per draft version (“Items”) when quote version is created (`epic 10` empty-state avoided). |
| **Tiers** | **Include** `tierCode` on line item; **library path:** revision + tier resolves `PacketTaskLine` rows; **quote-local path:** same tier filter applies to `QuoteLocalPacketItem` rows (`epic 19` pattern, `planning/01` §6). |
| **Task definitions in catalog** | **Slice 1:** packet lines may be **EMBEDDED-only** in seeds to avoid `TaskDefinition` table — **or** include `TaskDefinition` if seeds use LIBRARY lines (**deferred** choice in `11-slice-1-open-questions.md` only if both needed day one). |

---

## What not to do (Slice 1)

- Do **not** persist **`runtimeTaskId`** or **`flowId`** in freeze artifacts — use **`planTaskId`** and **`packageTaskId`** spaces only (`planning/01`).
- Do **not** use bare **`taskId`** in any public JSON for this slice (preview/send responses may reference **skeleton** ids only inside **package snapshot** slots with explicit **`source`** / labels — never ambiguous).
- Do **not** label catalog objects **“package”** in API field names (`canon/09#2`, `canon/05`).
- Do **not** allow **partial** `sent` state: either **fully sent** with both snapshots + status flip, or **rollback** (`canon/09#12`, `epic 12`).

---

## Settled vs Slice 1 decision vs Deferred

| Item | Classification |
|------|----------------|
| Send freezes commercial + plan + package (`canon/03`) | **Settled** |
| Immutable sent version | **Settled** |
| JSON v0 for snapshots | **Slice 1 decision** |
| Normalized plan/package tables | **Deferred** (O12) |
| Sign/activate | **Deferred** (Slice 2) |
