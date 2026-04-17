# Struxient v3 — Open canon decisions (narrowed)

**Canon:** Everything **not listed here** is **settled** by **`00`–`09`** in this folder plus **locked planning assumptions**. This file lists **only** decisions that **cannot** be closed without **business**, **MVP scope**, or **implementation** commitment.

---

## Resolved elsewhere (do not treat as open)

The following were **open in foundation** but are **closed by v3 canon**:

| Former open topic | Closed by |
|-------------------|-----------|
| “Single task primitive?” | **`04-task-identity-and-behavior.md`** — four layers + plan/package artifacts. |
| Workflow vs scope catalog | **`01`**, **`06`** — FlowSpec skeleton; **scope packets** catalog. |
| Packet-first vs assembly default | **`05-packet-canon.md`** — **packet default**; assembly **secondary**. |
| AI as silent truth | **`08-ai-assistance-canon.md`** — **commit walls**. |
| JobTask / string payment / dual progress / vocabulary drift | **`09-banned-v2-drift-patterns.md`** — **bans** on new work. |
| “What freezes at send?” | **`03-quote-to-execution-canon.md`**. |

---

## Remaining open decisions

### O1 — Job anchor timing vs sign and activation

**Open question:** When is a **job** record created relative to **customer sign**, **`autoCreateJobOnSignature`**, and **activation**?

**Why still open:** v2 has **multiple** hooks; **exact** ordering is **implementation + business** (when job id is customer-visible, billing, etc.).

**Impacts:** CRM integrations, reporting, idempotency stories.

**MVP blocker?** **Yes** — must pick **one** coherent story per tenant profile before build.

---

### O2 — Multi-flow: fan-out and cross-flow dependencies in MVP

**Open question:** Are **fan-out instantiation** and **cross-flow dependencies** **in** or **out** of **trade-first MVP**?

**Why still open:** Powerful for **multi-discipline** jobs; **adds** BLOCKED semantics and operational complexity.

**Impacts:** Template design, support surface, testing matrix.

**MVP blocker?** **Defer-friendly** for **single-trade** wedge; **blocker** if GTM requires **sales + execution** paired flows day one.

---

### O3 — Inspection model vs FlowSpec

**Open question:** Keep **inspection checkpoints** **parallel** to FlowSpec, **fold** into **nodes/skeleton tasks**, or define a **strict contract** between both?

**Why still open:** v2 **parallel** model risks **drift**; **folding** is a **product + migration** bet.

**Impacts:** Field UX, activation payload, compliance reporting.

**MVP blocker?** **Yes** if inspections are **day-one** for target trade.

---

### O4 — InstallItem (multi-commodity anchor)

**Open question:** Is **install item** (or successor) **required** in MVP for **multi-line / multi-system** jobs, or **defer**?

**Why still open:** v2 has **optional** link from **line → runtime** context.

**Impacts:** Data model, scheduling rollups, dashboards.

**MVP blocker?** **Defer-friendly** for **single-commodity** MVP; **blocker** for **solar + storage + MPU** as **first** customer.

---

### O5 — Scheduling authority

**Open question:** Does **calendar** **enforce** **task start**, remain **non-authoritative intent**, or use a **documented hybrid** (e.g. enforce only COMMITTED class)?

**Why still open:** v2 **defers** scheduling in **central start eligibility** while **persisting** blocks.

**Impacts:** Trust in calendar, field behavior, false “blocked” UX.

**MVP blocker?** **Yes** — pick before **scheduling-heavy** GTM; **defer** if MVP is **execution without calendar enforcement**.

---

### O6 — Schedule overlay sources of truth (if O5 enforces)

**Open question:** If calendar **enforces**, is **`ScheduleBlock`** **sole** authority, or **`RuntimeTask` schedule fields**, or **both** with precedence rules?

**Why still open:** v2 carries **multiple** hints.

**Impacts:** API contracts, deduplication, mobile offline.

**MVP blocker?** **Conditional** on O5 = enforce.

---

### O7 — Customer/site identity canonical source

**Open question:** **FlowGroup**-duplicated fields vs **Lead** — which is **canonical** for **display, portal, and audit**?

**Why still open:** v2 **duplication** is **proven**; **canonical** choice is **data governance**.

**Impacts:** PII handling, portal, email templates.

**MVP blocker?** **Medium** — can ship with **explicit** “display uses X” rule even if **technical debt** remains.

---

### O8 — Payment gate ↔ task stable id mapping table

**Open question:** Exact **id scheme** linking **PaymentGate** to **skeleton vs manifest** tasks (and **CO supersession**).

**Why still open:** **Ban** on **string** bridge is **canon**; **replacement table** is **implementation design**.

**Impacts:** Money gating correctness, migrations off JobTask.

**MVP blocker?** **Yes** when **payment-gated** execution ships.

---

### O9 — Hold types in MVP

**Open question:** Which **hold types** are **required** at launch vs **later**.

**Why still open:** **GTM** choice.

**Impacts:** Permissions, UX, integrations.

**MVP blocker?** **Product** — not structural canon.

---

### O10 — Per-quote override bounds — CLOSED

**Open question:** How far **estimators** may **override** **node placement / exclusions / manual tasks** **without** **new scope packet version**?

**Why closed:** Resolved by bridge decision pack. Minor overrides (quantity, price, description) stay on the `QuoteLineItem`. Task-level structural changes (add/remove/reorder tasks) trigger a mandatory fork into a `QuoteLocalPacket`. The library packet is never modified from the quote editor. Promotion back to library is explicit and admin-reviewed. See `05-packet-canon.md`.

**Impacts:** Compose errors, support, drift of “standard” packets.

**MVP blocker?** **Medium** — need **guardrails** before **wide** release.

---

### O11 — Plan upload → line items

**Open question:** **First-class** pipeline from **uploaded plans** to **draft line items** — **scope** and **truth rules**.

**Why still open:** **Not proven** as unified v2 path; likely **greenfield**.

**Impacts:** AI + OCR scope, liability, review UX.

**MVP blocker?** **Defer-friendly** unless **GTM** requires it day one.

---

### O12 — Freeze storage shape

**Open question:** **Normalized tables** vs **versioned JSON** (or **hybrid**) for **commercial + plan + execution package**.

**Why still open:** **Engineering** tradeoff; **semantics** already **canon** in **`03`**.

**Impacts:** Migration cost, queryability, partial updates.

**MVP blocker?** **Implementation** — **not** product thesis.

---

### O13 — Task-level authorization

**Open question:** **Tenant membership** sufficient for MVP vs **capability matrix** for **start/complete** by role.

**Why still open:** v2 **sparse** proven capabilities.

**Impacts:** Compliance, subcontractor models.

**MVP blocker?** **GTM** — **internal** crews vs **multi-party** field.

---

### O14 — AI feature packaging (not truth rules)

**Open question:** **Which** assists ship **when** (ordering, structured extract, catalog draft).

**Why still open:** **Product scope**; **truth rules** settled in **`08`**.

**Impacts:** Cost, support, onboarding.

**MVP blocker?** **No** for **core** quote-to-execution; **yes** for **AI-first** GTM.

---

### O15 — Learning and costing governance

**Open question:** **Who approves** packet/definition updates from learning; **how deep** **GL** integration goes.

**Why still open:** **Org process** + **finance** strategy.

**Impacts:** Margin workflows, trust.

**MVP blocker?** **Defer-friendly** early v3.

---

### O16 — Signature provider scope

**Open question:** **Native** only vs **DocuSign** parity for MVP.

**Why still open:** **Commercial** requirement variance.

**Impacts:** Compliance, build timeline.

**MVP blocker?** **GTM** legal requirements.

---

### O17 — Portal capabilities

**Open question:** **View/sign** only vs **structured input completion** in **portal**.

**Why still open:** Affects **send** gating policy and **customer** workload.

**Impacts:** `REQUIRED_TO_SEND_QUOTE` vs later timings.

**MVP blocker?** **Yes** if **customer-entered** data is **required** before **send**.

---

### O18 — Enterprise: per-job template fork

**Open question:** Whether **any** tier allows **forked** process template **per job** as **exception**.

**Why still open:** **Canon** forbids **default**; **enterprise** exception is **business**.

**Impacts:** Authoring surface, versioning explosion.

**MVP blocker?** **Defer-friendly** for **trade** wedge.

---

### O19 — JobTask legacy read window

**Open question:** **How long** **read/migrate** support for **legacy JobTask**-based jobs continues.

**Why still open:** **Tenant** commitments, not architecture.

**Impacts:** Support, dual-path code lifetime.

**MVP blocker?** **Migration** planning only.

---

### O20 — UX labels: static DETOUR node vs DetourRecord

**Open question:** Customer-facing **terms** distinguishing **template detour branch** vs **runtime detour**.

**Why still open:** **UX**; **technical** distinction **canon** in **`06`**.

**Impacts:** Training, support.

**MVP blocker?** **Low** — fix before **wide** field rollout.

---

## Summary

| Category | Count | Typical MVP stance |
|----------|-------|---------------------|
| **Must decide before core build** | O1, O3, O5, O8, O17 (conditional) | Blocker or conditional |
| **Defer-friendly for wedge** | O2, O4, O11, O14, O15, O18 | Phase 2+ |
| **Implementation / governance** | O6, O7, O9, O10, O12, O13, O16, O19, O20 | Plan with owners |

---

## See also

- `00-canon-index.md` — Canonical model paragraph  
- `09-banned-v2-drift-patterns.md` — Hard bans regardless of open items
