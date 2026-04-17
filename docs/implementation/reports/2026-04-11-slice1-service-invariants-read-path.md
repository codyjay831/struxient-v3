# After-action report: Slice 1 service invariants + narrow quote-version read path

**Date:** 2026-04-11  
**Depends on:** `2026-04-11-slice1-schema-prejob-quotelocalpacket.md` (schema + migration + seed)

---

## 1. Objective

Add **explicit service-layer invariant enforcement** for the new Slice 1 extension (pre-job, quote-local, manifest scope pins) so early application code cannot rely on “DB will catch it” alone, then ship the **first narrow read path** that is tenant-safe and **re-validates** loaded rows against the same rules.

---

## 2. Scope completed

### Invariants (pure assertions + typed errors)

| Function | Enforces |
|----------|-----------|
| `assertManifestScopePinXor` | `MANIFEST` → exactly one of `scopePacketRevisionId` / `quoteLocalPacketId` (mirrors SQL CHECK; useful pre-insert and for non-Prisma writers) |
| `assertPreJobTaskAnchors` | `PreJobTask.tenantId` = `FlowGroup.tenantId`; optional `quoteVersion` same tenant + same `flowGroupId` |
| `assertQuoteLocalPacketTenantMatchesQuote` | Local packet `quoteVersionId` + `tenantId` align with owning quote version / quote |
| `assertQuoteLocalPacketItemLineKindPayload` | `LIBRARY` requires `taskDefinitionId`; `EMBEDDED` requires non-null `embeddedPayloadJson` (not DB-enforced today) |
| `assertQuoteLineItemInvariants` | QV-5 proposal-group version match + manifest XOR + library revision tenant match + local packet alignment |
| `assertQuoteVersionScopeViewInvariants` | All groups belong to version; every line passes `assertQuoteLineItemInvariants`; detects orphan line ↔ group |

### Errors

- `InvariantViolationError` with stable `Slice1InvariantCode` for programmatic handling and logging.

### Read path

- `getQuoteVersionScopeReadModel(prisma, { tenantId, quoteVersionId })`  
  - **Tenant filter** on `Quote` (no cross-tenant leakage by id).  
  - Returns `null` if not found.  
  - Runs `assertQuoteVersionScopeViewInvariants` before return (fail loud on corrupted/partial graphs).  
  - Attaches **`orderedLineItems`**: `proposalGroup.sortOrder` → line `sortOrder` → `id` tie-break per QV-5.

### Tooling

- `tsconfig.json` (strict, `noEmit` for now).  
- `npm run typecheck` → `tsc --noEmit`.  
- `src/server/db/prisma.ts` — singleton `PrismaClient` (Next dev–reload pattern).

---

## 3. Files changed (grouped)

| Group | Path |
|--------|------|
| TS config | `tsconfig.json` |
| Package | `package.json`, `package-lock.json` |
| DB client | `src/server/db/prisma.ts` |
| Invariants | `src/server/slice1/errors.ts`, `src/server/slice1/invariants/*.ts` |
| Read model | `src/server/slice1/reads/quote-version-scope.ts` |
| Barrel | `src/server/slice1/index.ts` |
| Report | `docs/implementation/reports/2026-04-11-slice1-service-invariants-read-path.md` |

---

## 4. Canon / docs honored

- `docs/schema-slice-1/04-slice-1-relations-and-invariants.md` — tenant rules for scope revision + quote-local packet; QV-5 ordering; manifest XOR semantics.  
- `docs/implementation/schema/slice-1-extension-prejobtask-quotelocalpacket.md` — pre-job anchors; local packet not library canon.  
- Decision packs: pre-job FlowGroup anchor; quote-local `quoteVersionId` + tenant alignment.

---

## 5. Behavioral impact

- Callers can **validate DTOs** before `create`/`update` using the same assertions the read path uses on loaded data.  
- `getQuoteVersionScopeReadModel` is the **single** supported narrow read for “version + lines + scope pins” until a broader DTO layer exists.  
- **Snapshots** are intentionally **not** loaded (aligns with codepack “GET omits snapshots unless include” direction).

---

## 6. Validation performed

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | **Passed** |

**Not run:** runtime integration test calling `getQuoteVersionScopeReadModel` against Docker DB (optional follow-up).

---

## 7. Known gaps / follow-ups

1. **Mutation services** — wire `assert*` into create/update transaction paths; add `assertQuoteVersionDraft` when mutating draft-only rows (QV-3/QV-4).  
2. **Published revision policy** — library pin should reference `ScopePacketRevision.status = PUBLISHED` at send/compose; not enforced in this read path (compose service owns that).  
3. **Pre-job read API** — optional `getPreJobTaskReadModel` with same assert pattern for Work Station feed.  
4. **`assertQuoteLocalPacketItemLineKindPayload`** — if product allows empty EMBEDDED JSON temporarily, relax or gate behind feature flag (currently strict).  
5. **Path alias** — Next.js may want `@/server/slice1`; not configured until App Router lands.

---

## 8. Risks / caveats

| Risk | Mitigation |
|------|------------|
| **Double maintenance** | Service XOR vs DB CHECK — intentional overlap; service gives clearer errors and covers non-SQL writers. |
| **Read throws on bad data** | Corrupt rows cause `InvariantViolationError` instead of silent UI drift — operational alert / repair migration. |
| **Strict local item payload** | Seed and future AI drafts must satisfy EMBEDDED/LIBRARY shape or assertions fail at write time when wired. |

---

## 9. Recommended next step

Introduce **Next.js App Router** with `import { prisma } from '@/server/db/prisma'` (or relative path), and one **server-only** route or Server Component that calls `getQuoteVersionScopeReadModel` behind session-derived `tenantId` — keeps the read path honest under real auth.
