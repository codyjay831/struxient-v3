# After-action report: Freeze read (GET) + audit on send

**Date:** 2026-04-11  
**Depends on:** `send-quote-version` transaction, `AuditEvent` / `AuditEventType.QUOTE_VERSION_SENT` in Prisma.

---

## Objective

1. Append **`AuditEvent`** on **first successful** send (same transaction as freeze writes).  
2. Expose **read-only** frozen **`generatedPlanSnapshot`** + **`executionPackageSnapshot`** for **SENT** versions per `06-send-freeze-transaction-design.md` (inline JSON, demo-sized).

---

## Scope

| Item | Detail |
|------|--------|
| **Audit** | `sendQuoteVersionForTenant` creates `AuditEvent` with `eventType: QUOTE_VERSION_SENT`, `actorId` = sender, `payloadJson` = `{ planSnapshotSha256, packageSnapshotSha256, sendClientRequestId }`. **Skipped** on idempotent replay. |
| **GET** | `/api/quote-versions/[quoteVersionId]/freeze` — tenant gate; **404** missing; **409** `QUOTE_VERSION_NOT_SENT` if draft; **409** `FREEZE_PAYLOAD_INCOMPLETE` if SENT but blobs/hashes missing; **200** `{ data, meta }`. |
| **Service** | `getQuoteVersionFreezeReadModel`, `toQuoteVersionFreezeApiDto`. |

---

## Files

- `src/server/slice1/mutations/send-quote-version.ts` — audit insert  
- `src/server/slice1/reads/quote-version-freeze.ts` — read model  
- `src/lib/quote-version-freeze-dto.ts` — API DTO  
- `src/app/api/quote-versions/[quoteVersionId]/freeze/route.ts` — route  
- `src/server/slice1/index.ts` — exports  
- `src/app/page.tsx` — copy  

---

## Validation

`npm run build` — passed.

---

## Next

- **PATCH** `pinnedWorkflowVersionId` on draft (epic 07).  
- **SOLD_SCOPE** expansion or explicit send rules.  
- **Phase 5** sign + `ensureJobForFlowGroup` (`decisions/04`).
