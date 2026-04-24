# Struxient v3 — API surface outline

**Status:** **Service boundary and contract responsibility** plan — **no** routes/controllers code.  
**Companion:** `01-id-spaces-and-identity-contract.md` (all execution writes use **Tagged ExecutableTaskRef**).

---

## Conventions (all services)

| Convention | Rule |
|------------|------|
| **AuthN** | Tenant-scoped sessions; portal separate issuer/cookie domain if applicable. |
| **AuthZ** | Central policy engine keyed by **permission registry** (epic 59); **no** ad-hoc checks scattered without registry linkage. |
| **Idempotency** | `POST` mutations that can retry (**send**, **activate**, **start**, **complete**, **record payment**) accept **`Idempotency-Key`**. |
| **Versioning** | Public API `/v3/...` for v3-native shapes; **legacy** `/v2/...` read-only during migration if needed. |
| **Errors** | Structured problem+json: `code`, `message`, `details`, **`entityType`/`entityId`** when safe. |
| **Task identity** | **Never** return bare `taskId` without `kind` for executable work (`01`). |

---

## 1. CRM service

**Responsibilities**

- Leads, customers, flow groups, contacts, contact methods, polymorphic notes/files **attach APIs** (as of the minimal Lead schema slice, **Lead rows exist in Prisma** but **no** lead HTTP/API surface is wired yet — `/crm/leads` remains **planned**).
- Duplicate warnings (epics 01–02) — **compute** only, **no** merge in MVP.

**Owns**

- CRM aggregate consistency (`customerId` ↔ `flowGroupId`).
- Portal invite issuance **events** (actual email via notifications service).

**Does not own**

- Quote commercial math, execution, catalog publishing.

**Key identifiers**

- `leadId`, `customerId`, `flowGroupId`, `contactId`, `fileId`.

---

## 2. Quotes service

**Responsibilities**

- Quote shell + versions; draft editing; line items; proposal groups; structured answers (draft/commit).
- **Read** frozen versions faithfully.

**Owns**

- `quoteId`, `quoteVersionId`, `lineItemId` lifecycle per epics 07–11.
- **Pointers** to pinned `workflowVersionId` at send; line-level manifest scope pins (**`scopePacketRevisionId` *or* `quoteLocalPacketId`**, XOR) frozen with the version (`planning/01` §5–6).

**Does not own**

- **Activation** side effects, **flow** creation, **runtime tasks**.
- **Compose engine** may live here or in **freeze service** — see §6.

**Key identifiers**

- `quoteId`, `quoteVersionId`, `lineItemId`, `proposalGroupId`.

---

## 3. Catalog service (packets + definitions + assemblies)

**Responsibilities**

- CRUD draft/publish for **scope packets**, **revisions**, **packet task lines**, **tiers**.
- Task definitions + structured input templates.
- Assembly rule sets + quote-time “run rules” **draft** outputs (epic 20).
- AI draft jobs for catalog (epic 21) — orchestration + storage of suggestions.

**Owns**

- `scopePacketRevisionId`, `taskDefinitionId`, `assemblyRuleSetId`.

**Does not own**

- Quote freeze immutability (consumer only).
- Process template graph editing (separate service).

**Key identifiers**

- `scopePacketId`, `scopePacketRevisionId`, `taskDefinitionId`, `definitionRevisionId` (if used).

---

## 4. Process templates service (FlowSpec template-time)

**Responsibilities**

- Authoring workflow templates, publishing **immutable** `workflowVersionId` snapshots.
- Validation: reachability, gate integrity, node completion rule validity.

**Owns**

- `workflowTemplateId`, `workflowVersionId`, graph entities (`nodeId`, `skeletonTaskId`, gates, completion rules).

**Does not own**

- Runtime **flow** instances, **TaskExecution**.

**Key identifiers**

- `workflowVersionId`, `skeletonTaskId` (only meaningful inside snapshot).

---

## 5. Compose / compatibility service (optional split)

**Responsibilities**

- Dry-run **generated plan** recompute for draft quotes.
- **composeExecutionPackage** at send: errors/warnings surface (epic 32).
- Packet↔template compatibility checks (epic 16).

**Owns**

- Pure functions + persisted **outputs** handed to Quotes/Freeze writer.

**Does not own**

- Long-term storage authority — **persist** via Quotes service transaction.

**Key identifiers**

- Inputs: `quoteVersionId`, `workflowVersionId`; outputs: `planTaskId`, `packageTaskId` spaces.

---

## 6. Send / freeze transaction (“Freeze writer”)

**Responsibilities**

- **Single transactional boundary** for: version → `sent`, immutable snapshots (**commercial**, **plan**, **package**), proposal artifact generation events, **integrity hashes** (epic 12).

**Owns**

- Atomicity guarantees; **must not** emit “sent” without package when activation requires it (`canon/03`).

**Does not own**

- Signature; activation.

**Key identifiers**

- `quoteVersionId`.

**Failure modes**

- Partial failure **rolls back** entire freeze (epic 12).

---

## 7. Sign service

**Responsibilities**

- Customer/offline signature capture; `QuoteVersion` status transition `sent→signed`; **job ensure** side effect per `decisions/04` (may call Job service).

**Owns**

- `signatureId` records immutable.

**Does not own**

- Mutable customer CRM beyond linkage.

**Key identifiers**

- `quoteVersionId`, `jobId` (ensure output).

---

## 8. Activation service

**Responsibilities**

- Validate preconditions (**signed**, package present, inputs satisfied).
- Idempotent create: `flowId`, `runtimeTask` rows for manifest slots, `activation` audit, **no duplicate job** (`decisions/04`).
- **No** parallel inspection table rows for v3-native (`decisions/03`).

**Owns**

- `activationId`, `flowId`, runtime task creation rules.

**Does not own**

- Quote draft mutation.

**Key identifiers**

- `quoteVersionId` → produces `flowId`, `runtimeTaskId[]`.

---

## 9. Execution / task action service

**Responsibilities**

- Effective projection queries (read).
- **Start**, **complete**, **fail**, **outcome** mutations → **TaskExecution** append-only.
- Detours + holds application/release APIs (or split Ops service).
- Evidence attach finalize (ties to Files service).

**Owns**

- **Start eligibility** evaluation (`decisions/01` scheduling excluded MVP).
- **Tagged** task references end-to-end (`01`).

**Does not own**

- **Payment satisfaction** (finance), **quote** edits.

**Key identifiers**

- `flowId` + `ExecutableTaskRef`.

**Critical contract**

- `POST /execution/flows/{flowId}/tasks:start` body uses **tagged** ref; server rejects ambiguous ids.

---

## 10. Money / holds service

**Responsibilities**

- `PaymentGate` CRUD (finance), **targets** with **explicit** skeleton/runtime ids (`decisions/02`).
- Record payments → satisfy gates → release `PAYMENT` holds (epic 48).
- Generic holds CRUD (epic 29).

**Owns**

- Payment state transitions **without** mutating quote snapshots.

**Does not own**

- Task execution truth.

**Key identifiers**

- `jobId`, `paymentGateId`, optional `flowId` on targets.

---

## 11. Scheduling service (MVP)

**Responsibilities**

- `ScheduleBlock` CRUD; calendars; **explicit** non-authoritative labeling (`decisions/01`).
- **Must not** call into start eligibility with **PLANNED** blocks MVP.

**Owns**

- Schedule intent rows only.

**Key identifiers**

- `scheduleBlockId`, optional links `jobId`, `flowId`, `runtimeTaskId`/`skeletonTaskId` metadata for display.

**Future**

- Phase C: `COMMITTED` evaluation branch inside **single** eligibility module (`decisions/01`).

---

## 12. Portal service

**Responsibilities**

- Portal auth, magic links, **read** sent proposal presentation, **sign** flow delegation, structured input **submit** (epics 53–55).
- **Strict** customer scoping.

**Owns**

- `portalUserId` sessions.

**Does not own**

- Internal CRM lists.

**Key identifiers**

- `customerId`, `quoteVersionId` (scoped tokens).

---

## 13. Notifications service

**Responsibilities**

- Template rendering, fan-out email/SMS/push; delivery logs; throttling (epic 56).

**Owns**

- `notificationId` logs.

**Does not own**

- Domain truth changes.

---

## 14. Audit / search / settings service (may be modules)

### Audit

- Append-only `AuditEvent` ingestion from all services (standard envelope).

### Search

- Indexer reading **authorized** projections; respects row-level policy (epic 58).

### Settings

- `TenantSettings` reads/writes with audit (epic 60).

---

## Suggested **minimum** public API groups (documentation buckets)

| Bucket | Examples (illustrative, not routes) |
|--------|-------------------------------------|
| **CRM** | `/crm/customers`, `/crm/flow-groups`, `/crm/leads` |
| **Quotes** | `/quotes`, `/quote-versions`, `/line-items` |
| **Catalog** | `/catalog/packets`, `/catalog/task-definitions` |
| **Templates** | `/process-templates`, `/workflow-versions` |
| **Freeze** | `/quote-versions/{id}/send` (transactional) |
| **Sign** | `/quote-versions/{id}/sign` |
| **Activate** | `/quote-versions/{id}/activate` |
| **Execution** | `/flows/{flowId}/projection`, `/flows/{flowId}/tasks:start` |
| **Ops** | `/jobs/{jobId}/holds`, `/jobs/{jobId}/detours` |
| **Money** | `/jobs/{jobId}/payment-gates`, `/payment-gates/{id}/payments` |
| **Schedule** | `/schedule/blocks` |
| **Portal** | `/portal/...` |
| **Admin** | `/settings/...`, `/audit/...` |

Exact URL style (REST vs RPC) is **implementation** — **contract** requirements are the **service boundaries** and **identity rules** above.

---

## Cross-service events (recommended)

Use **outbox** pattern for:

- `quote.version.sent`
- `quote.version.signed`
- `quote.version.activated`
- `task.execution.completed`
- `payment.gate.satisfied`

Consumers: notifications, search indexer, webhooks (epic 56), analytics.

**Payloads** include **tagged** task refs whenever a task is referenced (`01`).
