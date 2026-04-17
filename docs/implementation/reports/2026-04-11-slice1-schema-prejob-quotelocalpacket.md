# After-action report: Slice 1 schema foundation — PreJobTask, QuoteLocalPacket, manifest XOR

**Date:** 2026-04-11  
**Scope:** First relational schema implementation in-repo (repository was documentation-only before this slice).

---

## 1. Objective

Establish the **permanent Prisma/PostgreSQL schema** for:

- `PreJobTask` (FlowGroup-anchored, pre-activation; not runtime execution)
- `QuoteLocalPacket` / `QuoteLocalPacketItem` (quote-version–scoped local scope; not packet library canon)
- `QuoteLineItem.quoteLocalPacketId` with a **real FK + Prisma relation**
- **XOR-ready** manifest scope: exactly one of `scopePacketRevisionId` or `quoteLocalPacketId` when `executionMode = MANIFEST`, aligned with `docs/schema-slice-1/04-slice-1-relations-and-invariants.md` and `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md`

Explicitly **out of scope** for this slice: UI, compose rewrite, activation, AI, promotion workflows, Next.js app wiring.

---

## 2. Scope completed

- **Bootstrapped** minimal Node tooling: `package.json`, `.gitignore`, `.env.example`, local `.env` placeholder (gitignored) for Prisma CLI.
- **Authored** `prisma/schema.prisma` as a **merge** of:
  - `docs/schema-slice-1-codepack/03-prisma-schema-draft-v0.md` (Slice 1 base graph)
  - `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md` (extension entities + relations)
- **Added** a **minimal** `TaskDefinition` model so `QuoteLocalPacketItem.taskDefinitionId` can carry a **real FK** for `LIBRARY` lines (extension illustration); full TaskDefinition fields remain a **follow-up** per `docs/schema-slice-1-codepack/01-prisma-model-outline.md` (“deferred” rich shape).
- **Created** initial SQL migration `prisma/migrations/20260411120000_slice1_base_and_extension/migration.sql` (from `prisma migrate diff --from-empty`) plus:
  - `QuoteLineItem_manifest_scope_pin_xor` **CHECK** (manifest XOR)
  - `QuoteLineItem_quantity_positive` **CHECK** (`quantity > 0`, per codepack note)
- **Configured** `postinstall` to run `prisma generate` with a **placeholder** `DATABASE_URL` via `cross-env` so clones without `.env` still install; real `DATABASE_URL` remains required for `migrate`.
- **Added** `prisma/seed.js` and `npm run db:seed` — inserts a minimal tenant → quote → version graph, one **catalog** manifest line, one **local packet** manifest line, a `PreJobTask`, a `SOLD_SCOPE` line without pins, and **asserts** DB rejection of manifest XOR violations and `quantity <= 0`.

---

## 3. Files changed (grouped)

| Group | Files |
|--------|--------|
| Prisma schema | `prisma/schema.prisma` |
| Migrations | `prisma/migrations/20260411120000_slice1_base_and_extension/migration.sql`, `prisma/migrations/migration_lock.toml` |
| Node / tooling | `package.json`, `package-lock.json`, `.gitignore`, `.env.example`, `.env` (local only, gitignored) |
| Seed | `prisma/seed.js` |
| Reporting | `docs/implementation/reports/2026-04-11-slice1-schema-prejob-quotelocalpacket.md` (this file) |

---

## 4. Architecture / schema decisions applied

| Decision | Source |
|----------|--------|
| `PreJobTask` is its own table; required `flowGroupId`; optional `quoteVersionId`; no FK to Job/Flow/RuntimeTask | Extension doc + `prejobtask-schema-decision-pack.md` |
| `QuoteLocalPacket` owned by `quoteVersionId`; children `QuoteLocalPacketItem`; fork link optional to `ScopePacketRevision` | Extension + `quotelocalpacket-schema-decision-pack.md` |
| `QuoteLineItem` → `QuoteLocalPacket` **Restrict** on delete; version → local packet **Cascade** on delete (draft cleanup; sent versions must not be deleted in app) | Extension doc (onDelete discussion) |
| Manifest XOR enforced in **PostgreSQL** for `MANIFEST` rows | `04-slice-1-relations-and-invariants.md` + checklist call for CHECK or app |
| `promotedScopePacketId` remains **opaque string** (no FK) | Matches extension illustration (audit pointer only at this layer) |
| Minimal `TaskDefinition` to satisfy extension FK without pretending epic-17 completeness | Tradeoff: **durable relation** vs deferring table entirely |

**Not modeled in DB (still app/transaction responsibility):**

- `PreJobTask.tenantId` = `FlowGroup.tenantId`; optional quote version belongs to same `FlowGroup` as task.
- `QuoteLocalPacket.tenantId` = parent quote’s tenant (via `QuoteVersion` → `Quote`).
- Post-send immutability for quote version rows (packets, items, lines) — **application** rule per canon.

---

## 5. Behavioral impact

**Now possible**

- Create `PreJobTask` rows tied to `FlowGroup`, optionally linked to a `QuoteVersion`.
- Create `QuoteLocalPacket` + `QuoteLocalPacketItem` under a `QuoteVersion`; pin lines via `QuoteLineItem.quoteLocalPacketId`.
- Reference `TaskDefinition` from local packet items for `LIBRARY`-style lines.
- Rely on DB to **reject** manifest lines that pin **both** or **neither** scope column, and **reject** non-positive `quantity`.

**Unchanged**

- No application services, APIs, or UI.
- No compose/send/activation logic.
- `PacketTaskLine` remains **EMBEDDED-only** enum in v0 (no `LIBRARY` catalog lines in this slice); local packet items already support **LIBRARY** + `TaskDefinition`.

---

## 6. Validation performed

| Command | Result |
|---------|--------|
| `npm install` | **Passed** (postinstall `prisma generate` succeeded) |
| `npx prisma validate` (with `.env` providing `DATABASE_URL`) | **Passed** |
| `npx prisma format` | **Passed** (schema formatted) |
| `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` | **Passed** (used to author migration baseline) |
| `npx prisma migrate deploy` | **Passed** (PostgreSQL 16 via Docker: `struxient-pg`, DB `struxient_v3`, user `struxient`) |
| `npx prisma db seed` | **Passed** — seed graph + XOR / quantity negative tests |

**Operational note:** The first `migrate deploy` attempt failed with Postgres **42601** at a **UTF-8 BOM** at the start of `migration.sql` (PowerShell `Out-File` default). BOM was stripped with a small Node one-liner; **avoid BOM** on migration files (UTF-8 without BOM).

**Lint / tsc / Next build:** not applicable yet (no application TypeScript source beyond generated client).

**Prisma CLI:** `npx prisma db seed` emits a **deprecation** warning: `package.json#prisma` seed config moves to `prisma.config.ts` in Prisma 7 — acceptable for now; migrate config when upgrading major.

---

## 7. Known gaps / follow-ups

1. **Expand `TaskDefinition`** to epic-17 shape (instructions, estimates, input templates, publish workflow) — current model is intentionally minimal.
2. **Optional `PacketTaskLineKind.LIBRARY` + `PacketTaskLine.taskDefinitionId`** when catalog seeds need library lines (codepack OQ-1).
3. **Partial unique** for `sendClientRequestId` per quote/version if client keys are not globally unique (`03-prisma-schema-draft-v0.md` notes).
4. **RLS / tenant checks** if using Postgres RLS; otherwise keep strict service-layer validation for `tenantId` alignment on `PreJobTask` and `QuoteLocalPacket`.
5. **Line-kind conditional validation** on `QuoteLocalPacketItem` (EMBEDDED vs LIBRARY payload rules) — DB does not enforce.
6. **Next.js + Prisma client singleton** wiring when the app lands.
7. **Prisma 7** — migrate seed configuration off `package.json` when upgrading.

---

## 8. Risks / caveats

| Risk | Note |
|------|------|
| **Greenfield bootstrap** | First commit introduces `node_modules` only via install; lockfile should be committed; teammates need Node 18+. |
| **`.env` in workspace** | Created for local CLI validation; **must not** commit secrets — `.gitignore` covers `.env`. |
| **CHECK vs product evolution** | If `executionMode` or manifest rules change, migration must be updated explicitly. |
| **`QuoteLocalPacket` Cascade from `QuoteVersion`** | Deleting a draft version removes local packets; product must **forbid** version delete after send (already canon). |
| **postinstall placeholder URL** | Allows generate without `.env`; **migrations still need** a real `DATABASE_URL`. |
| **Docker dev DB** | Container `struxient-pg` used for validation is **ephemeral** unless you keep it; not required for the repo — document your team’s shared dev DB. |

---

## 9. Recommended next step

Wire **Next.js App Router** with a **singleton Prisma client** and the first read-only API or server action that lists `QuoteVersion` for a tenant — keeps schema honest under real HTTP and auth boundaries.

---

## Appendix: relation names (Prisma)

- `QuoteLocalPacketForkSource` — `QuoteLocalPacket.forkedFromScopePacketRevisionId` ↔ `ScopePacketRevision`
- `PreJobTaskAssignee` / `PreJobTaskCreator` — `PreJobTask` ↔ `User`
- `QuoteLocalPacketCreatedBy` / `QuoteLocalPacketUpdatedBy` — `QuoteLocalPacket` ↔ `User`
