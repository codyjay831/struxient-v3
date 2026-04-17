# Struxient v3 — Schema / API planning open issues (strict list)

**Status:** **Small** list of items that **still change** table shapes, **public** API parameters, or **cross-service** transactions.  
**Rule:** If an issue does **not** materially affect schema/API planning, **it does not belong here** (keep in epics or backlog).

---

## 1. Freeze storage shape (**O12**)

**Why it matters:** Whether **GeneratedPlan** and **ExecutionPackage** are **JSON blobs**, **normalized tables**, or **hybrid** changes indexing, partial migrations, reporting SQL, and audit export (epics 31–32, 57).

**Settled semantically:** Artifacts exist, immutable at send (`canon/03`).  
**Open structurally:** Physical storage (`canon/10` O12).

**Decision owner:** Engineering + performance spike.  
**Canon change required?** **No** — documentation cross-reference only.

---

## 2. Multi-flow / fan-out (**O2**)

**Why it matters:** Affects whether **`jobId` → flow** is **1:1**, cardinality of **`flowId`** on **PaymentGateTarget**, **Hold**, **activation** outputs, and API defaults (`planning/04` activation/execution).

**Settled for wedge:** Single-flow MVP may **assume** one active flow.  
**Open for scale:** Multi-flow breaks **implicit** “derive flow from job” shortcuts.

**Decision owner:** Product + architect.  
**Canon change required?** **Yes** if MVP scope expands — currently **open** in `canon/10`.

---

## 3. Payment gate **ALL vs ANY** for multi-target gates (`decisions/02` open)

**Why it matters:** Schema is **mostly** unaffected (still **N** target rows), but **constraints** + **API** validation + **UI** must encode the rule; **incorrect default** causes **false unblock** or **false block**.

**Settled:** Targets are **explicit** skeleton/runtime ids (`decisions/02`).  
**Open:** Satisfaction aggregation rule.

**Decision owner:** Product (finance + ops).  
**Canon change required?** **No** — decision pack already marks open.

---

## 4. Pre-activation deposits when **runtime ids** do not exist (`decisions/02` open)

**Why it matters:** Determines whether **`PaymentGateTarget` rows** may exist **pre-activation** with **skeleton-only** targets, whether **gate creation** must be **deferred**, or whether a **coarse non-task** anchor is allowed (product-specific).

**Settled:** No string bridges; no JobTask (`canon/09`, `decisions/02`).  
**Open:** **Which** executable ids exist **when** relative to **sign/activate**.

**Decision owner:** Product + finance GTM.  
**Canon change required?** **No**.

---

## 5. Portal + signature depth (**O16**, **O17**) — only where it **gates** freeze

**Why it matters:** If **customers must** supply `REQUIRED_TO_SEND` inputs **only via portal**, the **send** transaction must **wait** on portal submissions (epics 12, 55). That impacts **async send** (epic 12) and **API** choreography.

**Settled:** AI cannot silently freeze (`canon/08-ai`).  
**Open:** Portal feature parity for **send gating** vs office-only commit.

**Decision owner:** Product / legal.  
**Canon change required?** **O17** in `canon/10` (already open).

---

## 6. InstallItem / multi-commodity anchor (**O4**) — **only if MVP needs it**

**Why it matters:** Optional **`installItemId`** (or successor) on **runtime tasks**, scheduling rollups, and search indexing (epics 35, 46, 58).

**Settled:** Not required for single-commodity wedge (`canon/10`).  
**Open:** If first customer is **multi-system**, schema adds anchor early.

**Decision owner:** Product GTM.  
**Canon change required?** **O4** already open.

---

## 7. Task-level authorization matrix (**O13**) — **only if it changes row visibility**

**Why it matters:** If **subcontractor** mode requires **row-level** scoping beyond tenant membership, **queries** and **search** must enforce consistent filters (epics 39, 41, 58, 59).

**Settled:** Tenant isolation.  
**Open:** Whether **field** users are **assigned-only** by default.

**Decision owner:** Product GTM + security.  
**Canon change required?** **O13** already open.

---

## Explicitly **not** listed here (handled elsewhere)

- **Rich text vs markdown** for notes (epic 05) — UI/editor, not schema blocker.  
- **PWA vs native push** (epic 43) — client infra.  
- **Search engine choice** (epic 58) — infra.  
- **Video file limits** (epic 06) — policy constant.  
- **O7 customer vs site canonical display** — **governance**; affects **portal copy** more than core table needs (still important, but **not** a schema blocker if **both** addresses persist as today).

---

## Next action

Close or **temporarily freeze** items **1–4** before **DDL** lock for **freeze/activate/payment** vertical slice; treat **2** as **“assume single flow until disproven”** if wedge shipping is immediate (`planning/04` documents the shortcut **must be explicit** in APIs).
