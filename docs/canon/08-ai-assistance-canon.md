# Struxient v3 — AI assistance canon

**Canon:** AI is an **accelerator** for **drafting and structuring**; it is **not** a **silent source of truth** for **freeze** or **activation**.

**Rationale from v2 evidence:** Ordering assistant, structured-input AI drafts (explicit non-truth until commit), catalog package AI draft routes (`10-automation-ai-inventory.md`).

---

## What AI is allowed to draft

**Canon — allowed draft targets (pre-commit)**

- **Scope packet** content proposals (task lines, text, estimates — subject to review).  
- **Quote line item** suggestions (ordering, grouping, descriptions) — **draft**.  
- **Structured input** candidate values from uploaded text — **draft** until accepted.  
- **Node placement suggestions** for **packet task lines** — **draft** only; **human** must commit to **catalog** (wrong placement breaks **compose**).

**What not to do:** Auto-apply AI **placement** to **published catalog** without **compatibility check** against **process templates**.

---

## What AI is not allowed to silently commit

**Canon**

- **Frozen quote snapshot** (commercial + plan + **execution package**).  
- **Activation** / **runtime instantiation** decisions.  
- **Published process template** version **publish** (template changes remain **human-governed**).  
- **Payment / hold** state.

**Rationale from v2 evidence:** Schema and routes treat AI extractions as **draft** pipelines.

---

## Can AI create scope packets?

**Canon:** **Yes, as drafts.** **No**, as **immutable catalog truth** without **explicit publish** workflow. Same as any **catalog authoring** change.

### AI at quote-time: QuoteLocalPacket-first

**Canon:** When AI drafts scope **during quoting** (from voice notes, text descriptions, uploaded plans/documents), all output is created as a **QuoteLocalPacket** — local to that specific quote, invisible to other quotes, and not in the global library. The estimator reviews, edits, and applies the suggestions to their draft. This prevents AI from silently polluting the curated library catalog.

If the AI-drafted pattern proves useful, the estimator may later **promote** the `QuoteLocalPacket` to the global library through the standard admin review process.

---

## Can AI create line items?

**Canon:** **Yes, as draft rows** or **suggestions** requiring **accept** into **quote version**. **Send** remains a **human-triggered** freeze gate in canon (product may add validations).

---

## Can AI suggest node placement?

**Canon:** **Yes**, as **suggestion only**. **Committed placement** lives on **packet task lines** under **human** catalog authority.

---

## Can AI assist structured inputs?

**Canon:** **Yes**, under **explicit** “draft → review → commit” semantics; **completeness gating** for send uses **committed** values only.

**Rationale from v2 evidence:** `REQUIRED_TO_SEND_QUOTE` style gating on committed structured inputs in send pipeline.

---

## Human approval boundary before freeze/activation truth

**Canon**

1. **Catalog:** AI output → **draft** → **review** → **publish** (scope packet / task definition changes).  
2. **Quote:** AI output → **draft** → **accept on version** → **send** freezes.  
3. **Activation:** Only **frozen + signed** (per policy) inputs **drive** instantiation — **no AI side channel**.

**Locked assumption 10:** AI is **evaluated**, not automatic canon — **satisfied** by **commit walls** above.

---

## What not to do

- **Stream** AI suggestions **directly** into **TaskExecution** or **CostEvent**.  
- **Skip** compose validation because “AI said so.”  
- **Conflate** **ordering assistant** cosmetic reorder with **scope** or **pricing** authority.

---

## MVP stance (canon-level, not backlog)

**Canon:** **v3 does not require** any specific AI feature for **core quote-to-execution integrity**. **If** AI ships, it **must** obey this doc. **Which** AI features ship first is **product scope** — **`10-open-canon-decisions.md`** for packaging, not for **truth rules** above.
