# Slice 1 — Deferred items and risks

---

## Explicit deferred items

| Item | Deferred to | Why |
|------|-------------|-----|
| `QuoteSignature`, signed status | Slice 2 | Post-freeze lifecycle |
| `Job`, `Flow`, `Activation`, `RuntimeTask`, `TaskExecution` | Slice 2 | Runtime birth |
| `StructuredInputAnswer` + REQUIRED_TO_SEND | Slice 2+ | Not in v0 scope |
| Payment gates, holds, detours | Later | Money domain |
| Portal, scheduling, change orders | Later | Ops |
| Assembly engine, AI drafting | Later | Not critical path |
| Full catalog authoring UI | Later | Seeds suffice |
| Normalized plan/package tables (O12) | Post–Slice 1 | Hybrid JSON first |
| Multi-draft concurrent UX polish | Later | Schema allows; product can simplify |
| Customer CRM snapshot on version | Optional future | Legal/compliance |
| PDF export / e-sign | Later | Not Slice 1 mission |

---

## Risks specific to Slice 1

| Risk | Impact | Mitigation |
|------|--------|------------|
| Partial send bug | **Trust collapse** | Single transaction; integration test asserts both blobs + status |
| Staleness ignored | User sends outdated composition | Require token match at send (`06`) |
| Identity drift in JSON | Wrong execution wiring later | Code review against `planning/01`; lint snapshot shapes |
| Large `snapshotJson` on GET | Timeouts | Pagination / separate download in follow-up |
| Duplicate sends (double click) | Corruption anxiety | UI lock + idempotency key |
| Tier resolution mismatch | Wrong scope sold | Unit tests per **library** revision + tier matrix **and** quote-local packet items where used |

---

## Triggers that mean Slice 1 is growing beyond scope

**Stop and re-plan if:**

1. Someone adds **activation** or **flow** creation to send transaction.
2. **Preview** starts **writing** to DB freeze columns.
3. APIs expose **bare `taskId`** without discriminator.
4. **Catalog** CRUD becomes required for demo (should be seeds).
5. **Payment** or **signature** becomes coupled to send.
6. **Change order** or **runtime task** appears in schema folder for Slice 1.

---

## Mitigations (process)

- Schema review checklist: `04` + `07` + `planning/01`.
- Golden-path E2E test: create → preview → send → GET sent.

---

## Classification

| Content | Type |
|---------|------|
| Risk list | **Slice 1** maintenance doc |
| Triggers | **Normative** for scope guards |
