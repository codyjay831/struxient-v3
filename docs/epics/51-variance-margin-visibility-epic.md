# Epic 51 — Variance and margin visibility

## 1. Epic title

Variance and margin visibility

## 2. Purpose

Define **read-only analytics** comparing **frozen estimate snapshot** (from send) to **execution actuals** (time + cost events) and **commercial** totals — **without** mutating authoritative layers (`07`).

## 3. Why this exists

Leadership needs **honest** visibility into **estimate vs actual** and **sold vs cost** without **fake precision** (`07` variance section).

## 4. Canon alignment

- **Variance** attributes may reference **packet**, **definition**, **line**, **node** (`07`).
- **Learning** proposals remain **approval-gated** (`07`, epic 52).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **PM** | View **job** variance dashboard. |
| **Exec** | Tenant **rollups** with permissions (59). |

## 6. Primary object(s) affected

- **Computed rollups** (materialized views optional): `job_variance_summary`.

## 7. Where it lives in the product

- **Job** → **Performance** tab; **Executive** dashboard (subset).

## 8. Create flow

N/A — nightly or on-demand **recompute** job.

## 9. Read / list / detail behavior

**Cards:**  
- **Sold total** (from frozen commercial snapshot).  
- **Frozen labor estimate** (from plan/package rollup).  
- **Actual labor** (from TaskExecution durations + labor entries 50).  
- **Actual costs** (49).  
- **Margin %** = `(sold - actualCost) / sold` with **disclaimers** if **cost incomplete**.

**Drilldown:** by **node**, by **line item**, by **packet key**.

**Empty actuals:** show **“insufficient data”** not zero.

## 10. Edit behavior

- **No user edit** to rollups; **assumptions** note in admin (60) for **burden rates**.

## 11. Archive behavior

N/A.

## 12. Delete behavior

N/A.

## 13. Restore behavior

N/A.

## 14. Required fields

N/A.

## 15. Optional fields

`burdenRateUsdPerHour` tenant setting affecting **cost from hours**.

## 16. Field definitions and validations

- **Rounding** rules displayed to user; consistent across pages (`9` single progress story applies to **execution** progress, not margin — **do not** mix **job progress %** with **margin %** without labels).

## 17. Status / lifecycle rules

N/A.

## 18. Search / filter / sort behavior

- Dashboard filters: **date range**, **trade**, **PM**.

## 19. Relationships to other objects

- Reads **QuoteVersion snapshot**, **TaskExecution**, **CostEvent**, **LaborTimeEntry**.

## 20. Permissions / visibility

- **margin.view** sensitive; **hide** from field default.

## 21. Mobile behavior

- **Executives only** simplified cards.

## 22. Notifications / side effects

- Optional alert **margin below threshold** on job closeout (56).

## 23. Audit / history requirements

- **No** audit for reads; **changes** to burden rates audited in admin.

## 24. Edge cases

- **CO** mid-job: **partition** variance by **baseline vs CO** segments — **MVP:** **single** combined with **footnote** “includes CO #2”.

## 25. What must not happen

- **Auto-changing** **packet defaults** from variance without approval (`7`, `52`).

## 26. Out of scope

- **Benchmarking** across tenants.

## 27. Open questions

- **Burden** and **equipment** allocation methodology — finance policy.
