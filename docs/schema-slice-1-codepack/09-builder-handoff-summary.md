# Slice 1 — Builder handoff (schema + API DTO → code)

**Read:** `03-prisma-schema-draft-v0.md`, **`10-schema-merge-checklist.md`** (v0 + extension merge guardrails), `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md`, `04-api-dto-draft.md`, `06-send-transaction-pseudocode.md`, `07-compose-engine-input-output-spec.md`.

---

## Code first (recommended order)

1. **Copy** draft Prisma into repo; add `DATABASE_URL`; fix `sendClientRequestId` uniqueness per `08` O2.
2. **First migration** + seed script: `Tenant`, catalog (`ScopePacket` → `PacketTaskLine` **EMBEDDED-only**), `WorkflowTemplate` → `WorkflowVersion` with valid `snapshotJson`.
3. **Validators:** `WorkflowVersion.snapshotJson` shape; `embeddedPayloadJson` minimum keys (`title`, `taskKind`).
4. **Compose library:** implement `ComposeEngine.run` per `07`; unit tests for ordering, tier filter, `planTaskId`/`packageTaskId` determinism.
5. **Services:** customer, flow group, quote, version (auto default `ProposalGroup`), line items with **staleness token** bump on any draft mutation.
6. **Handlers (when allowed next):** preview (sync), send (txn per `06`), GET version with `include=snapshots` default **omit**.

---

## Do not code yet

- Slice 2: sign, job, flow, activation, runtime tasks, execution endpoints.
- Portal, payments, holds, scheduling, structured inputs, AI, change orders.
- Async send queue, outbox (unless perf forces later).
- LIBRARY packet lines / `TaskDefinition`.

---

## Minimum acceptance tests

| # | Test |
|---|------|
| 1 | Create quote version → default **Items** group exists |
| 2 | Draft PATCH line → `composePreviewStalenessToken` changes |
| 3 | Preview returns **errors** when workflow unpinned |
| 4 | Send with **wrong** staleness token → `422`, still `DRAFT`, snapshots `null` |
| 5 | Send with **missing** warning ack → `422` |
| 6 | Happy path send → `SENT`, both JSON blobs non-null, hashes set, `composePreviewStalenessToken` null, `AuditEvent` row exists |
| 7 | After send, line item PATCH → `409` |
| 8 | `GET` without `include` → no snapshot keys in body (or `snapshots: null`) |
| 9 | `GET ?include=snapshots` on `SENT` → both blobs present |
| 10 | Idempotent send retry → `200`, no duplicate audit (or idempotent audit policy — **define** once) |

---

## Most dangerous failure modes (guard first)

| Failure | Guard |
|---------|--------|
| **Partial send** | Single DB transaction; never set `SENT` before both blobs written |
| **Preview/send drift** | One `ComposeEngine.run`; no forked logic |
| **Stale send** | Require token match (`06`) |
| **Silent warning bypass** | Strict ack set equality vs compose warnings in txn |
| **Identity pollution** | Lint snapshot JSON: reject `runtimeTaskId` / bare `taskId` |

---

## Codepack defaults (recap)

| Default | |
|---------|--|
| Packet lines | **EMBEDDED-only** |
| Warning ack | **Server-side required** |
| Preview | **Synchronous** |
| GET version | **Omit snapshots** unless `include=snapshots` |
| Storage | **Hybrid** relational + two JSON columns on `QuoteVersion` |

---

## Classification

| Doc | Role |
|-----|------|
| This file | **Last read before implementing routes** |
