# Repair doc status

**Date:** 2026-04-11
**Purpose:** Track the status of each repair document in `06-rewritten-epics/` after consolidation.

---

## Status key

- **Replaced main epic** — The rewritten file fully superseded the original. The main epic file now contains the rewritten content. This file is retained for audit history only.
- **Merged into main epic** — The supplement content was integrated into the parent epic's appropriate sections. The main epic is now self-sufficient. This file is retained for audit history only.

---

## File status

| File | Action taken | Target epic | Status |
|------|-------------|-------------|--------|
| `07-quotes-epic.rewritten.md` | Replaced `07-quotes-epic.md` | Epic 07 | Archived — consolidated into main epic |
| `34-job-anchor-epic.rewritten.md` | Replaced `34-job-anchor-epic.md` | Epic 34 | Archived — consolidated into main epic |
| `08A-version-ux-supplement.md` | Merged into `08-quote-versions-epic.md` | Epic 08 | Archived — consolidated into main epic |
| `11A-quote-editor-layout-supplement.md` | Merged into `11-quote-editing-draft-behavior-epic.md` | Epic 11 | Archived — consolidated into main epic |
| `12A-send-confirmation-ux-supplement.md` | Merged into `12-quote-send-freeze-epic.md` | Epic 12 | Archived — consolidated into main epic |

---

## What this means

**None of these files are required reading.** The main epic files under `docs/epics/` are the authoritative source of truth.

These repair documents are retained in `06-rewritten-epics/` for audit history — they document what was changed and when. They should not be referenced for implementation decisions. If a discrepancy is found between a repair doc and the main epic, the main epic wins.

---

## Intentionally separate documents

None. All repair documents were fully consolidated into their target epics.
