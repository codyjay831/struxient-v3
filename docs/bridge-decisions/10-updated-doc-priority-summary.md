# 10 — Updated Doc Priority Summary

**Status:** Post-integration assessment of documentation readiness.

---

## 1. Highest-Value Docs Updated

| Doc | Why it matters most |
| :--- | :--- |
| **`02-core-primitives.md`** | Added two new primitives (`PreJobTask`, `QuoteLocalPacket`) that affect schema, API, and UI design across the product. |
| **`05-packet-canon.md`** | Fully defines the fork/promotion model that determines how scope authoring works in practice. |
| **`15-scope-packets-epic.md`** | The most operationally impactful epic update — contains the full fork rules table and promotion flow that developers will implement. |
| **`39-work-station-actionable-work-feed-epic.md`** | Now includes PreJobTask in the field worker feed, which is the primary mobile surface. |
| **`01-leads-epic.md`** | Updated to anchor the FlowGroup at lead conversion, which is the entry point for pre-job work. |

---

## 2. Docs Now Safe for Implementation

These docs are now consistent with the bridge decisions and can be used as authoritative implementation specs:

| Doc | Ready for |
| :--- | :--- |
| **Canon 00–08** | Architecture alignment, code review, prompt context. |
| **Epic 03 (FlowGroup)** | Schema design for `FlowGroup` + `PreJobTask` relationship. |
| **Epic 09 (Line Items)** | Schema design for `QuoteLineItem` + `QuoteLocalPacket` reference. |
| **Epic 15 (Scope Packets)** | Implementation of the fork/promotion flow in the packet editor. |
| **Epic 17 (Task Definitions)** | Implementation of the task library with curation guardrails. |
| **Epic 31 (Generated Plan)** | Plan expansion logic that handles both library and local packets. |
| **Epic 33 (Activation)** | Activation logic that references PreJobTask evidence. |
| **Epic 34 (Job Anchor)** | Job creation rules with clear pre-job work boundary. |
| **Epic 39 (Workstation)** | Feed query that includes PreJobTask records. |

---

## 3. Docs That May Need Further UX Refinement

| Doc | What still needs work |
| :--- | :--- |
| **Epic 11 (Quote Editing)** | The "Site Evidence" sidebar panel (showing PreJobTask photos/measurements) needs UX wireframes. The fork badge ("Forked from [Packet Name]") needs visual design. |
| **Epic 21 (AI Packet Authoring)** | The distinction between "AI authoring a library packet" and "AI drafting a QuoteLocalPacket during quoting" needs UX clarity so the user understands which mode they are in. |
| **Epic 22 (AI Quote Drafting)** | The voice-to-quote and document-to-quote flows that create QuoteLocalPackets need more detailed UX specification. |
| **Epic 01 (Leads)** | The lead conversion flow that creates a FlowGroup and optionally triggers a PreJobTask ("Schedule Site Survey") needs a step-by-step UX spec. |

---

## 4. Recommended Next Step

### **Schema planning pass for PreJobTask and QuoteLocalPacket.**

**Why:** With the canon and epics now aligned, the next step is to define the Prisma/schema models for these two new entities. This includes:
- `PreJobTask` model (fields, relations to `FlowGroup`, lifecycle states).
- `QuoteLocalPacket` model (fields, relations to `QuoteLineItem`, `ScopePacketRevision` origin, promotion status).
- Updates to the existing `QuoteLineItem` model to support a `quoteLocalPacketId` FK.
- Updates to the existing `FlowGroup` model to support the `PreJobTask` relationship.

This schema pass should be scoped as a focused extension of the existing Slice 1 schema planning docs.
