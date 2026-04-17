# Struxient v3 — Banned v2 drift patterns

**Canon:** The following patterns are **forbidden** in v3 **design, docs, and new integrations**. Legacy v2 **may still contain** some until migration; **new work must not extend** them.

---

## 1. Collapsed task vocabulary

**Ban:** Using **one undifferentiated “task”** for **library meaning**, **packet lines**, **skeleton spec**, **plan rows**, **package slots**, and **runtime instances** in **UX copy, APIs, or canon docs**.

**Require:** Terms from **`04-task-identity-and-behavior.md`**.

**Rationale from v2 evidence:** Task system deep dive; pain doc §11.1.

---

## 2. Packet / bundle / package naming drift

**Ban:** Calling the **catalog scope template** a **“package”** interchangeably with **execution package**, or mixing **bundle** vs **packet** without definition.

**Require:** **Scope packet** (catalog) vs **execution package** (frozen per quote version) — **`05-packet-canon.md`**.

---

## 3. Workflow-first sales thinking

**Ban:** Positioning **process template** as **the primary object** for **what we sell**, or training estimators to **author graphs before line items**.

**Require:** **Line items + scope packets** first; **template** selects **railway**.

**Rationale from v2 evidence:** Quote UI is bundle-first; foundation thesis.

---

## 4. Per-job workflow authoring as default

**Ban:** **Default** expectation that every job gets a **custom** node graph authored **at quote time**.

**Require:** **Published templates** + **freeze/activate** population; **exceptions** are **advanced/enterprise** only.

---

## 5. JobTask-style legacy bridging for new execution

**Ban:** **New** features that **create** or **require** **JobTask**-class rows for **execution truth** or **gating**.

**Require:** **Runtime task instances** + **skeleton tasks** + **stable ids** per **`02-core-primitives.md`**.

**Rationale from v2 evidence:** Schema deprecates JobTask; packaged activation skips JobTask creation.

---

## 6. String-based payment mapping

**Ban:** Matching **payment** or **gates** using **(jobId, nodeName, taskName)** string equality to **legacy** rows.

**Require:** **Stable task identity** (skeleton id or manifest instance id) + explicit **PaymentGate** linkage rules — **exact mapping table** may remain **open** but **must not** be string-name-based.

**Rationale from v2 evidence:** `legacy-payment-bridge.ts`; pain doc §11.6.

---

## 7. Split-brain scheduling ambiguity

**Ban:** **Simultaneously** implying **calendar blocks are authoritative** for **when work may start** while **central start eligibility** **ignores** scheduling **without** documenting that gap.

**Require:** **Explicit canon** choice: **enforce**, **non-authoritative intent**, or **hybrid with clear rules** — until chosen, **new UX** must **not** imply enforcement silently.

**Rationale from v2 evidence:** `task-start-eligibility` defers scheduling; schedule blocks exist.

---

## 8. Ambiguous progress truth

**Ban:** **Multiple** **incompatible** **percent complete** formulas for the **same job** without **declared execution mode**.

**Require:** **Single** **derivation** for **v3-native** jobs; legacy read-only path **labeled** if data exists.

**Rationale from v2 evidence:** Dual `computeFlowspecJobProgress` vs `computeLegacyJobProgress`.

---

## 9. AI outputs as freeze/activation truth without commit

**Ban:** **Any** pipeline that writes **snapshot/plan/package** or **activates** from **unreviewed** AI output.

**Require:** **`08-ai-assistance-canon.md`** commit walls.

---

## 10. Runtime overlay breaking routing

**Ban:** **Manifest** tasks **influencing** **gate** evaluation or **node routing** in violation of **routing isolation** invariant.

**Require:** **Effective snapshot** rules preserve **gate** semantics — **only** **explicit** product changes may alter this with **new canon**.

**Rationale from v2 evidence:** `effective-snapshot.ts` comments; pain §11.11.

---

## 11. Detour as scope edit

**Ban:** Using **detours** to **replace** **formal change orders** when **sold scope** or **commercial** agreement **changes**.

**Require:** **Change order** (or **new quote version**) for **scope truth**; **detour** for **correction path** within **executed** work.

---

## 12. Silent reroute without visibility

**Ban:** **Product behavior** that **moves** manifest work to **fallback nodes** **without** **surfacing** **compose warnings/errors** to **authoring users**.

**Require:** **Visible** integrity signals at **send** (v2 composer already distinguishes error vs warn patterns — v3 **must not** regress **honesty**).

**Rationale from v2 evidence:** Composer reroute warnings.

---

## Enforcement posture

**Canon:** Code review and **canon checks** treat the above as **hard bans** for **new** surfaces. **Migration** of existing tenants may temporarily **read** legacy patterns — **not** **extend** them.
