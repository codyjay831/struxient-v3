# Struxient v3 — First UI slice (recommendation)

**Goal:** Fastest **human-visible** proof that v3 is **line-item-fronted** and **freeze-honest**, not another workflow builder.  
**Companion:** `02-vertical-slices.md` (**V2**), `06-first-api-slice.md`.

---

## Build first: **Quote workspace (draft → preview compose → send)**

**Route target (illustrative):** `/quotes/:quoteId/versions/:versionId`

### Why this UI first (not catalog, not field)

| Alternative first UI | Why deprioritize |
|----------------------|------------------|
| **Catalog editor** | Delays the **commercial spine**; seeds + admin JSON suffice early (`01-v3-build-sequence.md` Phase 2). |
| **Process template canvas** | Same — necessary in maturity, not first **wedge demo**. |
| **Field work feed** | Cannot exist honestly until **activation**; building it first invites **mock tasks**. |
| **Customer portal** | Blocked on **O16/O17** and not needed if office signs (`03-mvp-critical-path.md`). |

The **quote workspace** is where **`canon/01`** is **felt**: line items, packet selection, totals, **send** gate.

---

## Screens / components in the first UI slice

### 1) **Quote header**

- Customer + project (FlowGroup) **read-only** after pick; **change** only in draft pre-send.
- Version badge (`draft`), **Save** state, **last compose preview** timestamp.

### 2) **Line items grid (MVP)**

- Add/remove rows **draft only**.
- Columns: description, qty, unit price, extended, **packet key + tier** (picker), **execution mode** (even if only 2 options initially).
- **No** workflow drag-drop as primary path (`canon/09#3`).

### 3) **Process template picker**

- Select **published** `workflowVersionId` (label = template name + version).
- **Validate** selection **before** preview: “compatible with selected packets” if you ship basic checks early.

### 4) **Compose preview panel** (non-modal is fine)

- Button **Run preview**.
- Show **errors** (block) and **warnings** (require acknowledgement checkboxes) matching `epic 12`.
- Show **node breakdown** counts: “N tasks on NODE_MOBILIZE” — builds trust (`epic 32`).

### 5) **Send**

- Disabled until **no compose errors** and **required acknowledgements** checked.
- On success: **read-only** view + clear “Sent at …” banner.

**Stub:** proposal PDF viewer — show **JSON/HTML preview** toggle for internal users only.

---

## UX copy guardrails (prevent banned drift)

- Never label catalog scope as **“package”** (`canon/05`, `canon/09#2`).
- Never imply **calendar controls start** (`decisions/01`) — scheduling UI absent or labeled **planning only** if present.

---

## Second UI slice (immediately after send works)

**Signature + activate developer panel** (internal):

- Buttons: **Mark signed (office)** + **Activate** with explicit Preconditions checklist (`epic 13`, `epic 33`).
- Shows resulting **`jobId`**, **`flowId`**, **runtime task count** — turns **V4** into a **visible** milestone.

This can be **ugly**; it must be **correct**.

---

## Third UI slice

**Task execution detail** (`/jobs/:jobId/…` or `/flows/:flowId/tasks/...`) with **Start/Complete** — depends on **V5**.

---

## Accessibility / mobile stance for first slice

- **Desktop-first** is acceptable for **office** quoting (`epic 11`).
- Mobile quote editing **not** required to prove spine (`epic 43`).

---

## Summary one-liner

**Ship the quote workspace with compose preview + send as the first UI**, because it is the fastest honest demonstration of v3’s commercial + freeze core.
