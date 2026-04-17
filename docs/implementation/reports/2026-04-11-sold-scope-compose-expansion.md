# After-action report: SOLD_SCOPE compose / freeze expansion (go 2)

**Date:** 2026-04-11  
**Authority:** `07-compose-engine-input-output-spec.md` (package `SOLD_SCOPE` + `planTaskIds`), seed data with packet-free **SOLD_SCOPE** lines.

---

## Problem

**MANIFEST** lines expanded to plan rows; **SOLD_SCOPE** commercial lines (no packet pin) produced **no** plan tasks, so quotes with only allowances or **SOLD-only** mixes could hit **`PLAN_SNAPSHOT_EMPTY`** at send despite valid draft rows.

---

## Decision (Slice 1)

1. Emit **`scopeSource: "COMMERCIAL_SOLD"`** plan rows for each **`SOLD_SCOPE`** line, **quantity-exploded** like manifest rows.  
2. **`planTaskId`** = `computePlanTaskIdCommercialSold` (tuple includes `scopeSource`, `quoteVersionId`, `lineItemId`, `quantityIndex`, `targetNodeKey`).  
3. **Placement:** **first workflow snapshot node id** by **lexicographic sort** (deterministic placeholder until line-level placement exists).  
4. If **no nodes** and any **SOLD_SCOPE** line exists → blocking **`PACKAGE_BIND_FAILED`** (same as unbindable manifest).  
5. **Non-blocking warning** per line: **`COMMERCIAL_SOLD_DEFAULT_NODE_PLACEMENT`**.  
6. **Package slots:** unchanged enum **`SOLD_SCOPE`**, **`planTaskIds`** singleton, **`lineItemIds`** provenance.

**Normative note:** `generatedPlanSnapshot.v0` text in `07-snapshot-shape-v0.md` lists only `LIBRARY_PACKET` \| `QUOTE_LOCAL_PACKET`. **`COMMERCIAL_SOLD`** is an **implementation extension** for packet-free commercial rows; fold into canon **`07`** when product locks placement rules.

---

## Files

- `compose-preview/plan-task-id.ts` — `computePlanTaskIdCommercialSold`  
- `compose-preview/compose-engine.ts` — sold-line loop + types  
- `compose-preview/freeze-snapshots.ts` — `planRowToFrozenJson` third branch (no packet keys)  
- `compose-preview/build-compose-preview.ts` — preview DTO `scopeSource` union  

---

## Validation

`npm run build`.

---

## Next

- Line-level **`targetNodeKey`** (or policy) for **SOLD_SCOPE** rows.  
- **Phase 5** sign + job shell.
