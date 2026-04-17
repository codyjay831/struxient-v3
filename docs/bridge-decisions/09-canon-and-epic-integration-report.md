# 09 — Canon and Epic Integration Report

**Status:** Integration of bridge decisions into authoritative canon and epic docs is complete.

---

## 1. Canon Docs Updated

| Doc | What was added |
| :--- | :--- |
| **`00-canon-index.md`** | Added locked assumptions 12–14 (PreJobTask, QuoteLocalPacket, curated library philosophy). Updated the canonical one-paragraph model to include pre-job tasks, quote-local packets, and the learning-not-mutation rule. |
| **`01-v3-core-thesis.md`** | Added two new sections: "Pre-job work exists and is not runtime execution" and "Reuse philosophy: curated libraries, not dumping grounds." |
| **`02-core-primitives.md`** | Added `QuoteLocalPacket` primitive definition (between Scope Packet and Task Definition). Added `PreJobTask` primitive definition (before Runtime Task Instance). Added both to the "Quick reference: who owns what" table. |
| **`03-quote-to-execution-canon.md`** | Restructured "How work enters" into two stages: "Pre-job operational work" (before quoting) and "Quote-time scope entry" (with explicit QuoteLocalPacket fork and AI-local-first rules). |
| **`04-task-identity-and-behavior.md`** | Expanded the four-layer table to **five layers** by adding `Pre-job task`. Added the fourth sentence to the mnemonic. Added "Task library curation philosophy" section. |
| **`05-packet-canon.md`** | Updated AI-drafted scope section to specify QuoteLocalPacket-first. Added full "Packet-level override policy" with fork rules table, promotion flow, and reuse philosophy. Updated summary table. |
| **`07-time-cost-and-actuals-canon.md`** | Expanded "How future learning flows back" with explicit reuse philosophy: no automatic library mutation, admin review required, QuoteLocalPacket actuals for learning. |
| **`08-ai-assistance-canon.md`** | Added "AI at quote-time: QuoteLocalPacket-first" subsection under "Can AI create scope packets?" |
| **`10-open-canon-decisions.md`** | Closed **O10** (Per-quote override bounds) as resolved by bridge decisions. |

---

## 2. Epic Docs Updated

| Epic | Update Type | What was added |
| :--- | :--- | :--- |
| **01 Leads** | Moderate | Updated Lead → FlowGroup relationship to establish FlowGroup at conversion. Added Lead → PreJobTask (via FlowGroup) relationship. |
| **03 FlowGroup** | Moderate | Added `PreJobTask` to primary objects. Added `FlowGroup 1—* PreJobTask` relationship. Added "Do not create a Job to track pre-job work" to §25. |
| **09 Quote Line Items** | Light | Updated relationships to include `QuoteLocalPacket` reference. Closed O10 in open questions. |
| **11 Quote Editing** | Moderate | Added fork behavior section (§25a) with QuoteLocalPacket creation flow and pre-job evidence sidebar. |
| **15 Scope Packets** | Heavy | Updated roles to include fork/promotion capabilities. Added full §25a (QuoteLocalPacket fork behavior) with rules table, promotion flow, metadata ownership, and reuse philosophy. |
| **17 Task Definitions** | Light | Strengthened §25 with explicit curation philosophy and anti-dumping-ground rule. |
| **21 AI Packet Authoring** | Moderate | Added §25a (AI drafting during quoting creates QuoteLocalPacket). |
| **22 AI Quote Drafting** | Moderate | Updated validation rules for AI-drafted scope (QuoteLocalPacket when no library match). Added §25a (local-first rule). |
| **31 Generated Plan** | Light | Updated purpose to include QuoteLocalPacket as source. Added `BUNDLE_LOCAL` source classification. |
| **33 Activation** | Light | Added note that PreJobTask evidence on FlowGroup remains accessible from Job. |
| **34 Job Anchor** | Light | Added §25.4: "Do not create a Job to track pre-quote work — use PreJobTask." |
| **39 Workstation** | Moderate | Added `PRE_JOB` badge and filter. Updated feed to pull PreJobTask records from assigned FlowGroups. |

---

## 3. Major Ideas Integrated into Canon

1. **PreJobTask as a first-class primitive:** Site surveys and similar pre-quote work now have a formal home in the canon (`02-core-primitives.md`).
2. **QuoteLocalPacket as a first-class primitive:** Project-specific scope mutations have a formal home in the canon (`02-core-primitives.md`).
3. **Reuse philosophy as explicit canon:** The curated library principle — "one-off work stays local, promotion is explicit, actuals feed learning not mutation" — is now stated in `01-v3-core-thesis.md`, `04-task-identity-and-behavior.md`, `05-packet-canon.md`, and `07-time-cost-and-actuals-canon.md`.
4. **O10 closed:** The per-quote override bounds decision is resolved by the fork/promotion rules.

---

## 4. Major Ideas Integrated into Epics

1. **Pre-job work anchored to FlowGroup:** Epics 01, 03, 33, 34, and 39 now reference PreJobTask.
2. **QuoteLocalPacket fork behavior:** Epics 09, 11, 15, 21, 22, and 31 now reference the fork/promotion model.
3. **Library curation philosophy:** Epics 15 and 17 now explicitly state the anti-dumping-ground and promotion-required rules.

---

## 5. What Remains Intentionally Separate

The **bridge-decision docs** (`docs/bridge-decisions/01–08`) remain as historical decision records. They capture the reasoning and evidence that led to the decisions. The authoritative truth now lives in the canon and epic docs. The bridge docs should be retained for reference but are no longer the primary source of truth.

---

## 6. Contradictions Found and Resolved

| Area | Contradiction | Resolution |
| :--- | :--- | :--- |
| **Epic 01 (Leads) → FlowGroup** | Originally said "No direct relationship at MVP." | Updated to establish FlowGroup creation at lead conversion, which is required for PreJobTask anchoring. |
| **Canon O10 (Override bounds)** | Was listed as open. | Closed by the fork/promotion rules in the bridge decisions. |
| **Epic 22 (AI Quote Drafting)** | Originally said "AI cannot invent nonexistent packet keys" (validator checks catalog). | Updated to allow AI to create QuoteLocalPacket when no library match exists. |
