# Epic 58 — Search, filtering, and global retrieval

## 1. Epic title

Search, filtering, and global retrieval

## 2. Purpose

Define **global** **quick search** across **authorized** entities: **customers, jobs, quotes, tasks (by title), flow groups**, with **substring** or **token** rules, **pagination**, **highlighting**, and **performance** budgets — complementing **object-local** searches defined in other epics.

## 3. Why this exists

Power users **jump** without navigating hierarchies; **inconsistent** search causes **support** load.

## 4. Canon alignment

- Results must **respect** permissions (59) and **tenant** isolation (`9` no cross-tenant).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Office** | Global search default on. |
| **Field** | **Limited** search to **assigned** jobs if row-level enabled. |

## 6. Primary object(s) affected

- **Search index** (implementation: DB trigram, Elasticsearch, etc. — **out of scope**); **SearchQuery** log optional.

## 7. Where it lives in the product

- **Header omnibox** `/search?q=`; **keyboard shortcut** `/`.

## 8. Create flow

N/A.

## 9. Read / list / detail behavior

**Results grouped** by entity type; each row: **title**, **subtitle** (customer, status), **deep link**.

**No results:** “No matches — try quote #, customer name, job #, or address.”

**Min query length:** 2 chars; **debounce** 300ms.

## 10. Edit behavior

N/A.

## 11. Archive behavior

N/A.

## 12. Delete behavior

N/A.

## 13. Restore behavior

N/A.

## 14. Required fields

N/A.

## 15. Optional fields

`savedSearch` future out of scope.

## 16. Field definitions and validations

- **Sanitize** query to prevent **regex** DOS if regex used.
- **PII:** **mask** sensitive fields in **snippets** for roles.

## 17. Status / lifecycle rules

N/A.

## 18. Search / filter / sort behavior

- **Filters** chips on results page: type, date **optional** phase 2.
- **Sort** relevance default.

## 19. Relationships to other objects

- **Index** includes: Customer display, Job #, Quote #, FlowGroup nickname+address, **Runtime task** titles (job scoped).

## 20. Permissions / visibility

- **Search never** returns rows user cannot **detail** read.

## 21. Mobile behavior

- Omnibox in **mobile** header; **recent** items quick list local.

## 22. Notifications / side effects

- None.

## 23. Audit / history requirements

- Optional **log** searches for **insider threat** — default **off**; **admin** toggle.

## 24. Edge cases

- **10k** hits: show top 50 + **refine query** message.

## 25. What must not happen

- **Leaking** existence of **other tenant** rows via timing attacks — constant-time responses recommended.

## 26. Out of scope

- **Semantic** vector search over documents.

## 27. Open questions

- **Index** technology choice — engineering spike post-epic.
