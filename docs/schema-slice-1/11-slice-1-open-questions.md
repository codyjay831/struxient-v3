# Slice 1 — Open questions (minimal)

Only items that **materially** affect Slice 1 implementation.

---

## OQ-1 — EMBEDDED-only seeds vs `TaskDefinition` table

**Question:** Do day-one seeds require **LIBRARY** `PacketTaskLine` rows that reference `TaskDefinition`?

- **If no:** Omit `TaskDefinition` table; all lines `EMBEDDED`.
- **If yes:** Add minimal `TaskDefinition` entity per `02`.

**Blocks:** seed data format + one optional table.

---

## OQ-2 — Strict server-side warning acknowledgment on send

**Question:** Must `acknowledgedWarningCodes` match all current warnings for send to succeed?

- **Strict:** Yes — prevents “ignored yellow” sends.
- **Lenient:** UI-only ack — server ignores.

**Blocks:** send handler validation only.

---

## OQ-3 — Preview + send HTTP semantics

**Question:** Is preview always **sync** heavy compute in request thread?

- **Slice 1 default:** **Sync** for demo simplicity.
- **Async:** Job + poll — only if perf fails.

**Blocks:** infra (queue) vs simple controller.

---

## OQ-4 — `GET /quote-versions/{id}` snapshot payload size

**Question:** Inline full JSON vs `include=snapshots` default false?

- **Demo small data:** inline OK.
- **Production-shaped:** default omit, separate fetch.

**Blocks:** API default + mobile clients later (not blocking if decided either way).

---

## Non-questions (resolved in pack)

| Topic | Resolution |
|-------|------------|
| ProposalGroup in v0 | **Yes** — default “Items” (`01`) |
| Structured inputs | **Excluded** (`01`) |
| O12 normalization | **Deferred** |
| Staleness token | **Required** at send (`06`) |
