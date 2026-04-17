# 03 — Quote Authoring Journey

**User Role:** Estimator
**Starting Point:** Draft Quote v1 (Empty)
**Preconditions:** FlowGroup (Site address) and Customer are anchored.

---

## Main Success Path (Step-by-Step)

1.  **Opening the Editor:**
    -   **Action:** Estimator opens `Quote (v1)` in **Draft** mode.
    -   **Screen:** Quote Editor (Left: Scope Tree, Middle: Line Item Details, Right: AI/Packet Sidebar).
2.  **Adding a Scope Packet:**
    -   **Action:** Estimator searches for **"Roof Replacement"** in the sidebar.
    -   **Selection:** Clicks **"Add Packet"**.
    -   **Fields:** Selects `Tier` (e.g., "Silver" or "Platinum"), enters `Quantity` (e.g., "32 Squares").
    -   **System Decision:** Packet expansion happens (Epic 20).
    -   **Objects Created:** `QuoteLineItem` (**`scopePacketRevisionId`** → `ScopePacketRevision` on the library path).
    -   **Object Created:** `ProposalGroup` (default: "Main Scope").
3.  **Manual Line Item Addition:**
    -   **Action:** User clicks **"Add Manual Item"** for a one-off repair.
    -   **Fields:** Title, Description, Unit Price, Quantity, Unit (e.g., "LF").
    -   **Object Created:** `QuoteLineItem` (non-packet-backed line: **no** manifest scope pin — both `scopePacketRevisionId` and `quoteLocalPacketId` unset for this journey step).
4.  **AI Quote Drafting (Optional):**
    -   **Action:** User types/speaks: **"Add 40ft of white 6-inch seamless gutters with 4 downspouts."**
    -   **AI Point:** AI parses the text, finds the "Gutter Installation" packet, sets qty=40, and adds a sub-item for 4 downspouts.
    -   **Action:** User clicks **"Apply Suggestions"**.
5.  **Refining the Proposal:**
    -   **Action:** Estimator drags items into `ProposalGroups` (e.g., "Main Roof", "Optional Gutters").
    -   **Action:** Sets items as **"Optional"** or **"Included"**.
    -   **Outcome:** Real-time total updates (Total = Base + Included Optional).
6.  **Reviewing the Generated Execution Plan:**
    -   **Action:** Estimator clicks **"Preview Execution Plan"**.
    -   **Screen:** Read-only view of the `SkeletonTasks` and `Flow` that will be created if this quote is signed.
    -   **Outcome:** Estimator confirms the workflow logic (e.g., "Permit" -> "Demo" -> "Inspect").

---

## Alternate / Branch Paths

-   **Save to Library:** User creates a custom assembly on this quote and clicks **"Save as New Packet"** to reuse it later (Epic 21).
-   **Variant Change:** User changes the packet tier from "Silver" to "Gold". The `QuoteLineItem` is updated, and the child tasks are re-generated.
-   **Voice-to-Quote:** Estimator uses the mobile app to record notes while on-site; AI drafts the entire quote from the recording.

---

## Objects Touched or Created
-   `QuoteVersion` (v1)
-   `QuoteLineItem` (Create/Update)
-   `ProposalGroup` (Create/Update)
-   `ScopePacket` (Reference)
-   `ScopePacketRevision` (Reference)
-   `WorkflowVersion` (Reference)

---

## AI Assistance Points
-   **Natural Language to Scope:** Parsing text/voice into `QuoteLineItems`.
-   **Tier Suggestions:** Recommending a tier based on lead notes or budget.
-   **Inconsistency Detection:** "You added Gutters but no Downspouts; should I add them?"
-   **Photo Analysis:** AI suggests line items directly from survey photos (e.g., "Detected chimney flashing damage; add Flashing Repair packet?").

---

## Human Confirmation Points
-   Confirming AI-suggested items before they are added to the quote.
-   Verifying the final unit prices and quantities.
-   Approving the "Preview Execution Plan" logic.

---

## What the Customer Sees
-   Nothing yet. The quote is in **Draft**.
-   Estimator can toggle **"Customer Preview"** to see the draft proposal layout.

---

## What Unlocks Next
-   The **"Review & Send"** step becomes available once all required fields are filled.

---

## Failure / Error States
-   **Packet Version Expired:** The packet used in the draft was updated in the library. (Status: `NEEDS UPDATE`).
-   **Missing Pricing:** Some items are missing unit costs. (Status: `NOT READY FOR SEND`).

---

## Current Epic Coverage
-   `07-quotes-epic.md`: General quote shell.
-   `15-scope-packets-epic.md`, `16-packet-task-lines-epic.md`: Packet logic.
-   `22-ai-assisted-quote-drafting-epic.md`: AI drafting.
-   `09-quote-line-items-epic.md`: Line item specifics.

---

## Missing or Ambiguous Areas
-   **Quote-Local vs Library Packets:** If an estimator modifies a packet's tasks *only for this job*, where is that override stored? (Epic 15 says packets are revisions, but "Local Overrides" are not explicitly handled).
-   **Pricing Sources:** Does pricing come from the `ScopePacket` or a separate `PriceBook`? (Epic 09 mentions Unit Price, but source is unclear).

---

## Recommendation
-   Update `15-scope-packets-epic.md` to define a **"Fork Packet to Quote-Local"** mechanism for custom jobs.
-   Clarify the **Pricing Strategy** in a new Decision (Library Pricing vs. Estimator Overrides).
