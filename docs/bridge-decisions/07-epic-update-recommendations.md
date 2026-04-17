# 07 — Epic Update Recommendations

**Status:** Prioritized plan for updating the Struxient v3 Epic set.

---

## 1. High-Priority Updates (Mandatory for Slice 1)

These address the "Pre-Quote Execution Gap" and "Packet-Forking Gap" before implementation begins.

| Epic | Update Type | What needs to be added |
| :--- | :--- | :--- |
| **01 Leads** | Moderate | Add "Qualify & Create FlowGroup + PreJobTask (Survey)" flow. |
| **07 Quotes** | Moderate | Add "Review PreJobTask Evidence" as a primary editor input. |
| **15 Scope Packets** | Moderate | Add `QuoteLocalPacket` and "Fork on Edit" behavior. |
| **11 Quote Editing**| Light | Add "Fork Packet" and "Promote to Global Library" UI actions. |
| **45 Scheduling** | Light | Add "Schedule PreJobTask" (Survey) before Job exists. |
| **39 Workstation** | Light | Add `PRE_JOB` task badge and filter for field users. |

---

## 2. Moderate-Priority Updates (Before Slice 2)

These address the "AI Authoring" and "Audit History" gaps.

| Epic | Update Type | What needs to be added |
| :--- | :--- | :--- |
| **21 AI Authoring** | Moderate | Specify that all AI output is created as `QuoteLocalPacket`. |
| **22 AI Quoting** | Moderate | Specify that AI-drafted scope follows the "Review & Apply" flow. |
| **31 Generated Plan**| Light | Clarify that `Plan v1` is generated from `QuoteLocalPacket` + `ScopePacketRevision`. |
| **34 Job Anchor** | Light | Clarify that `Job` can reference `PreJobTask` history. |
| **37 Change Orders**| Moderate | Clarify that change orders use `QuoteLocalPacket` for "Ad Hoc" scope mutation. |

---

## 3. Light Updates (Deferred/Best Practice)

| Epic | Update Type | What needs to be added |
| :--- | :--- | :--- |
| **03 FlowGroup** | Light | Define `FlowGroup` as the anchor for `PreJobTask` (Surveys). |
| **12 Send Freeze** | Light | Clarify that `QuoteLocalPacket` is frozen with the quote version. |
| **57 Audit History** | Light | Log "Packet Promotion" as a global admin-level audit event. |

---

## 4. Why this matters
- **Focused Effort:** Teams can prioritize updates to the core "Lead-to-Job" flow first.
- **No Missing Logic:** Ensures that every epic reflects the new "Bridge" architecture.
- **Ready for Implementation:** Provides a clear checklist for the next "Epic Rewrite" phase.

---

## 5. Summary
The "Pre-Job" and "Packet-Fork" logic is now the new standard. Epics 01, 07, and 15 are the most critical for immediate update.
