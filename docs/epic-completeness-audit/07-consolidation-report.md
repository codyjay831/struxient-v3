# Consolidation report

**Date:** 2026-04-11
**Purpose:** Document the consolidation of rewritten epics and UX supplements into the main epic library.

---

## Summary

Five consolidation targets were processed:

- **2 direct replacements** (rewritten epic fully superseded the original)
- **3 supplement merges** (supplement content integrated into the parent epic)

After consolidation, all five main epic files are self-sufficient. No supplement or repair doc is required reading for implementation.

---

## 1. `07-quotes-epic.md` — Replaced

**Action:** Original (137 lines) replaced by rewritten version (749 lines).

**Why:** The rewritten version is a complete superset of the original. It preserves all original content — purpose, canon alignment, object model, relationships — and adds implementation-complete detail across all 27 sections: step-by-step create flow with inline customer/FlowGroup creation, full list view column table, detailed tabbed detail page, comprehensive field definitions with validation rules and constraints, detailed archive/delete/restore flows, permissions matrix, mobile behavior table, 10 edge cases, 6 "what must not happen" rules, and 3 open questions.

**Unique content preserved from original:**
- "Ready to activate" filter (original §18) — added to the rewritten version's filter table in §9. This filter was present in the original but not in the rewrite.

**No content was lost.**

**Quality check:** The consolidated epic is now implementation-complete (would rate A, up from C+). A builder can implement the quotes feature from this epic alone without inventing product behavior.

---

## 2. `34-job-anchor-epic.md` — Replaced

**Action:** Original (120 lines) replaced by rewritten version (640 lines).

**Why:** The rewritten version is a complete superset. All original content (purpose, canon alignment, idempotent `ensureJobForFlowGroup`, status set, FlowGroup uniqueness constraint) is preserved. The rewrite adds: 7 user roles with detailed capabilities, tabbed detail page with 10 tabs, full cancel flow with acknowledgment checklist, restore flow, status transition table with 9 transitions and disallowed transitions, field definitions for 18 fields, permissions matrix for 6 roles, mobile behavior table, 8 edge cases, and 3 open questions.

**Unique content preserved from original:**
- None needed. Every detail from the original was already present in the rewrite, often with more specificity.

**No content was lost.**

**Quality check:** The consolidated epic is now implementation-complete (would rate A, up from B-). A builder can implement the job anchor feature from this epic alone.

---

## 3. `08-quote-versions-epic.md` — Merged with `08A-version-ux-supplement.md`

**Action:** Supplement content integrated into the parent epic. The epic grew from 137 lines to ~280 lines.

**What was merged:**
- **§9 (Read / list / detail):** Version history list layout with row elements, click behavior per status, actions on the version list. Read-only sent/signed version view layout (wireframe), key immutability rules. Version switching mechanism (dropdown in header, direct URL navigation). Version header display patterns table.
- **§8 (Create flow):** Draft version creation UX details (carry-forward, redirect to editor, version history update).
- **§12 (Delete behavior):** Delete draft version flow with conditions, confirmation dialog, and cascade behavior.
- **§16 (Field definitions):** Complete field definitions table for QuoteVersion (19 fields with data types, constraints, and ownership).

**Unique content preserved from original:**
- `currency` as a required field (original §14) — preserved.
- `proposalThemeId` as an optional field (original §15) — preserved.
- Snapshot JSON vs normalized tables note (O12) — preserved in §16.
- Concurrent send idempotent lock edge case — preserved with expanded detail (sendClientRequestId).
- "AI writing snapshot without human send" prohibition — preserved.

**Conflicts found:** None. The supplement was additive — it defined UX for behaviors the original only listed structurally.

**Quality check:** The consolidated epic now stands on its own. A builder does not need the supplement to understand version history UX, read-only views, version switching, or field definitions.

---

## 4. `11-quote-editing-draft-behavior-epic.md` — Merged with `11A-quote-editor-layout-supplement.md`

**Action:** Supplement content integrated into the parent epic. The epic grew from 120 lines to ~310 lines.

**What was merged:**
- **§9 (Read / list / detail):** Full screen layout wireframe (4-region workspace), header bar element table, left panel (group tree) with interactions and empty state, center panel (line item grid) with column definitions and row interactions, right rail (context panel) with 5 tabs and their content specifications.
- **§7 (Where it lives):** URL routing table for all quote/version URL patterns.
- **§10 (Edit behavior):** Detailed autosave behavior table (debounce, retry, failure handling), concurrent editor handling, undo stack specification.
- **§16 (Validations):** Preflight validation gate table (4 states controlling Send button).
- **§21 (Mobile):** Desktop-only editor with mobile read-only fallback and optional mobile send.

**Unique content preserved from original:**
- `draftOwnerId` and `lastAutosaveAt` optional fields — preserved.
- Editor-only-for-draft lifecycle rule — preserved with expansion (what happens if version status changes while editor is open).
- "Notify quote owner when collaborator saves" notification — preserved.
- Milestone audit rules (audit on line add/remove, template change, not each keystroke) — preserved.
- "Presence feature cost vs value" open question — preserved.
- Autosave crash recovery (7-day retention) — preserved from original §13 with expanded UI detail.

**Conflicts found:** None. The supplement was purely additive layout/interaction detail.

**Quality check:** The consolidated epic now contains enough layout and interaction detail that the editor would not be built from guesswork. The group tree, line item grid, right rail, autosave, and preflight gate are all specified.

---

## 5. `12-quote-send-freeze-epic.md` — Merged with `12A-send-confirmation-ux-supplement.md`

**Action:** Supplement content integrated into the parent epic. The epic grew from 135 lines to ~350 lines.

**What was merged:**
- **§8 (Send flow):** Send button behavior (stale preview recomputation, error blocking), full send confirmation modal wireframe with 4 sections (summary, warnings, delivery, confirm), modal sections detail tables, send-in-progress indicator (step-by-step progress), success state modal with portal link copy, failure state modal with specific error scenarios table.
- **§15 (Optional fields):** `sendChannel` and `recipientEmail` field definitions.
- **§16 (Validations):** Idempotency via `sendClientRequestId`, atomicity guarantee.
- **§21 (Mobile):** Mobile send behavior (default off, tenant-configurable).
- **§22 (Notifications):** Full customer email template with subject, body, portal link, reply-to, and tenant branding. Internal sent notification.

**Unique content preserved from original:**
- Send pipeline step list (10 steps) — preserved and enriched with UX context.
- "At least one customer-visible line" requirement — preserved.
- "Async send for huge quotes" open question — preserved with expanded recommendation.
- `sendChannel` field definition — preserved.
- Partial failure transaction rollback edge case — preserved.
- Large plan timeout handling — preserved with async fallback recommendation.
- "Hidden compose reroutes" prohibition — preserved.

**Conflicts found:** None. The supplement was purely additive UX detail.

**Quality check:** The consolidated epic now contains enough UX detail for the send flow, modal, progress, success, and failure states. A builder can implement the entire send experience from this epic.

---

## Consolidation quality verification

| Epic | Pre-consolidation rating | Post-consolidation rating | Self-sufficient? |
|------|-------------------------|--------------------------|-----------------|
| `07-quotes-epic.md` | C+ (half-built risk) | A (implementation-complete) | Yes |
| `34-job-anchor-epic.md` | B- (high risk) | A (implementation-complete) | Yes |
| `08-quote-versions-epic.md` | B (needed supplement) | A- (strong, self-sufficient) | Yes |
| `11-quote-editing-draft-behavior-epic.md` | B- (needed supplement) | A- (strong, self-sufficient) | Yes |
| `12-quote-send-freeze-epic.md` | B (needed supplement) | A- (strong, self-sufficient) | Yes |

---

## What is NOT changed

- No other epics were modified during this pass.
- No canon documents were modified.
- No decision documents were modified.
- No schema or application code was modified.
- The audit scorecard (`01-epic-completeness-scorecard.md`) and other analysis docs remain as-is — they reflect the pre-consolidation state and serve as audit history.
