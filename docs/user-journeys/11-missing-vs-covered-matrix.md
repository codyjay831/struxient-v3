# 11 — Missing vs. Covered Matrix

**Status:** Analysis of user journey coverage across the existing Struxient v3 Epic set.

---

## Coverage Matrix

| Journey | Covered Well | Partially Covered | Missing Logic |
| :--- | :--- | :--- | :--- |
| **01 Lead to Quote** | Epics 01, 02, 07 | Epic 03 (Project Site) | Site Survey trigger location. |
| **02 Site Survey** | Epics 45, 46, 43 | Epics 01, 07 | Survey Task object vs Job object. |
| **03 Quote Authoring** | Epics 15, 16, 22 | Epics 07, 09, 11 | Quote-local vs Library packet overrides. |
| **04 Review & Send** | Epics 12, 31, 32 | Epic 30 (Eligibility) | Final Checklist UX definition. |
| **05 Customer Sign** | Epics 13, 53, 54 | Epics 04, 55 | Deposit requirement at sign-time. |
| **06 Activation** | Epics 33, 34, 39 | Epics 23, 26, 31 | Task-level staff assignment logic. |
| **07 Task Execution** | Epics 35, 41, 42 | Epics 50, 49 | Multi-actor task collaboration. |
| **08 Payment Holds** | Epics 29, 47, 48 | Epics 53, 54 | Payment Provider (Stripe) webhook mapping. |
| **09 Change Orders** | Epics 14, 37, 28 | Epics 35, 36 | Plan v1 vs Plan v2 history (Audit). |
| **10 Closeout** | Epics 38, 47, 57 | Epics 34, 53 | Warranty Package data model. |

---

## Detailed Gap Analysis

### 1. The "Pre-Job" Execution Gap (Journeys 01, 02)
- **Problem:** Epics assume execution (Tasks) starts *after* a Quote is signed and a Job is activated. However, **Site Surveys** are "Work" that happens *before* the quote.
- **Missing:** A "Pre-Job Task" model or a way to anchor tasks to a `FlowGroup` before a `Job` exists.

### 2. The "Packet-Fork" Gap (Journey 03)
- **Problem:** Estimators often need to tweak a standard packet's tasks for one specific job.
- **Missing:** Logic for "Quote-Local" task overrides that don't pollute the global library.

### 3. The "Team Construction" Gap (Journey 07)
- **Problem:** Epics often assume a single actor (Tech) for a Task. Real roofing is done by a crew.
- **Missing:** "Joint Start/Complete" logic for multiple staff on one task instance.

### 4. The "Payment-to-Work" Bridge (Journey 08)
- **Problem:** We have "Gates" and "Payments", but the "Webhook to Release" logic is implicit.
- **Missing:** Explicit mapping of payment provider statuses to Gate/Hold release events.

### 5. The "Closeout Artifact" Gap (Journey 10)
- **Problem:** The "Warranty Package" is mentioned as a customer benefit but not defined as a system object.
- **Missing:** A `CloseoutPackage` entity that aggregates photos, signatures, and PDFs.

---

## Summary of Coverage
- **Core Entities:** Extremely well-covered (Leads, Customers, Quotes, Tasks, Jobs).
- **Static Rules:** Well-covered (Status transitions, Role permissions).
- **Dynamic Workflow:** **Missing key bridges** where one module hands off to another (e.g., Survey to Quote, Quote to Job, Payment to Hold Release).
