# Open canon questions — before v3 implementation

**Purpose:** Items that **cannot** be closed from v2 evidence + locked planning assumptions alone. **Labels:** **Proven from code** · **Strong inference** · **Working v3 interpretation** · **Unclear / needs canon decision**

---

## 1. Execution and job lifecycle

1. **Job creation timing:** When exactly is a `Job` created relative to **sign**, **`autoCreateJobOnSignature`**, and **activation**? **Unclear / needs canon decision** — referenced in `03-quote-to-execution-breakdown.md` and synthesis.

2. **Single vs multiple flows per job (MVP):** Are **fan-out** and **cross-flow dependencies** in scope for **trade-first v3 MVP**? **Proven:** schema supports; **12 matrix** says needs review.

3. **Inspection model:** Keep **`InspectionCheckpoint`** parallel to FlowSpec, **fold** into nodes/tasks, or **define explicit contract** between both? **Proven:** parallel exists; pain doc flags drift risk.

4. **InstallItem:** Required for **multi-commodity** jobs in v3 MVP or **defer**? **Proven:** optional link from line → `RuntimeTask`.

---

## 2. Identity, scheduling, and authority

5. **Scheduling authority:** Should **calendar** **block task start** in v3, or remain **non-authoritative intent**? **Proven:** v2 eligibility **defers** scheduling (`08-scheduling-time-horizon.md`). **Must decide** for v3 to avoid split-brain.

6. **RuntimeTask schedule fields:** If scheduling becomes authoritative, do **`scheduledStartAt`/`EndAt`** become **enforced**, or does **`ScheduleBlock`** become the **sole** source of truth? **Unclear.**

7. **FlowGroup vs Lead:** Which fields are **canonical** for customer/address identity? **Proven:** duplication exists (`02-domain-model-inventory.md`).

---

## 3. Money and gates

8. **Payment mapping:** **Single** id scheme for **PaymentGate ↔ tasks** — snapshot task id vs runtime task id rules — **must** replace **JobTask name bridge** (`07`, `11`). Exact mapping table **Unclear / needs canon decision**.

9. **Hold granularity:** Which hold types are **MVP** vs **later** for trade GTM?

---

## 4. Scope authoring and exceptions

10. **Per-quote overrides:** How far can estimators **override** packet placement (node), **without** creating a **new packet version**? **Proven:** v2 has exclusions, instruction overrides, manual tasks — **product bounds** for v3 **Unclear**.

11. **Assembly vs packet-first:** For **solar / upgrade** jobs, is **assembly** a **primary** quoting path or **advanced**? **Working v3 assumption:** evaluate; **canon** should pick default UX.

12. **Plan upload → line items:** **Unclear** whether v2 has a **single** supported pipeline; may be **greenfield** for v3.

---

## 5. Data model and migration

13. **Snapshot decomposition:** Does v3 **normalize** `QuoteVersion.snapshot` into multiple artifacts, or **version JSON** aggressively? **Save but redesign** in foundation matrix — **storage canon** open.

14. **Task identity unification:** “Single task primitive vs two-tier” from synthesis Q1 — **open**; v2 **RuntimeTask + snapshot Task** split is **proven** behavior.

15. **JobTask retirement:** **Hard cutover** date vs **indefinite read** support for legacy tenants — business decision, not code.

---

## 6. Permissions and org

16. **Task-level authorization:** Is **tenant membership** sufficient for v3 MVP, or **role/capability** matrix required day one? **Proven:** sparse capabilities in reviewed code (`04`, `11`).

---

## 7. AI and drafts

17. **AI in MVP:** Which assists (ordering, structured input extract, catalog package draft) ship **when**, always **human commit**? **Locked assumption 10:** evaluate — **product canon** open.

18. **Draft contamination:** Rules for **AI drafts** touching **line items** vs **catalog only** — **prevent** accidental freeze inclusion.

---

## 8. Learning and costing

19. **Variance ownership:** **Who** approves packet/definition updates from **LearningSuggestion**? **Governance** open.

20. **Accounting boundary:** **CostEvent** vs external GL — **integration depth** for v3.

---

## 9. Customer experience

21. **Signature providers:** Native-only vs **DocuSign** parity for v3 MVP? **12 matrix** flags review.

22. **Portal scope:** **View/sign only** vs **structured input completion** in portal — affects freeze gating (`REQUIRED_TO_SEND_QUOTE` vs later timings).

---

## 10. Resolved by locked assumptions (do not reopen without explicit change)

These are **settled for foundation docs** unless stakeholders **explicitly** change planning inputs:

- Trade-first, not full-home-first.  
- Not raw-task-first.  
- Line-item-fronted, packet-driven, task-definition-supported.  
- Workflow = **process skeleton**, not main reusable trade scope.  
- Quote-selected scope determines **manifest work**.  
- Packet tasks carry **default node placement**.  
- Activation populates **stable node-based process** (template-driven default, not per-job authoring as default).  
- FlowSpec = skeleton + routing framework populated from quote at activation.

---

## See also

- `01-v3-foundation-synthesis.md` — questions originally listed in `00-synthesis` (overlap intentional; this file expands).  
- `04-save-redesign-drop-foundation-matrix.md`
