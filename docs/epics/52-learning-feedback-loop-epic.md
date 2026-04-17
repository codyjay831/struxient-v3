# Epic 52 — Learning feedback loop

## 1. Epic title

Learning feedback loop

## 2. Purpose

Define how **aggregated actuals** produce **reviewable suggestions** to update **task definitions** and **scope packets** — **never** silently rewriting **frozen quotes** or **published templates** (`07`, `08-ai`, `O15`).

## 3. Why this exists

Trades **improve** estimates over time; **governance** prevents chaos (`07` learning section).

## 4. Canon alignment

- **Learning** consumes **actuals + outcomes** (`07`).
- **Human approval** before catalog publish (`08-ai` pattern for catalog).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Catalog author** | Review suggestions; **accept** into **draft** revisions. |
| **Admin** | Configure **thresholds** (60). |

## 6. Primary object(s) affected

- **LearningSuggestion** (`targetType` definition|packet, `targetId`, `field`, `proposedValue`, `evidenceSummary`, `status`).

## 7. Where it lives in the product

- **Catalog** → **Suggestions** inbox; **packet** editor shows **badge** “3 suggestions”.

## 8. Create flow

- **Nightly job** or **manual** “Generate suggestions” creates rows from **variance** stats (51) with **minimum sample** thresholds.

## 9. Read / list / detail behavior

- List: target, field, **confidence**, **sample size**, **expected impact**.
- Detail: charts **before/after** distributions (if data exists).

## 10. Edit behavior

- **Accept** → opens **draft** revision with **pre-filled** change; still requires **normal publish** (15/17).
- **Reject** with reason.

## 11. Archive behavior

- **Dismissed** suggestions archived from inbox.

## 12. Delete behavior

- Admin purge old suggestions by retention policy.

## 13. Restore behavior

- **Reopen dismissed** within 7 days optional.

## 14. Required fields

`targetType`, `targetId`, `proposedPatch`, `generatedAt`.

## 15. Optional fields

`modelVersion`, `sampleJobIds[]` (privacy careful).

## 16. Field definitions and validations

- **Reject** reason max 500 chars.

## 17. Status / lifecycle rules

`proposed` | `accepted` | `rejected` | `stale` (auto if underlying data changed).

## 18. Search / filter / sort behavior

- Filter by target type, trade, **stale**.

## 19. Relationships to other objects

- **TaskDefinition**, **ScopePacket**, **Cost/Time** aggregates.

## 20. Permissions / visibility

- **learning.review** role; **no field** access.

## 21. Mobile behavior

- Not applicable.

## 22. Notifications / side effects

- Weekly digest of new suggestions (56).

## 23. Audit / history requirements

- Accept/reject with actor; **accepted** links to **published revision id**.

## 24. Edge cases

- **Small sample** sizes: **suppress** suggestion; show **“not enough data.”**

## 25. What must not happen

- **Silent** catalog publish (`7`, `8`).
- **AI** auto-apply without human (`8`).

## 26. Out of scope

- **Auto-repricing** customer quotes.

## 27. Open questions

- **O15** who approves in large orgs — RACI.
