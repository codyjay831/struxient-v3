# Struxient v3 User Journey Index

**Purpose:** This pack defines the end-to-end user experiences for Struxient v3. It bridges the gap between static entity definitions (Epics) and real-world application behavior.

---

## Why Journeys?

While **Epics** define *what* exists (entities, fields, rules), **Journeys** define *how* users interact with those entities over time. Journeys help verify:
- **Logical Flow:** Does one step actually lead to the next?
- **State Transitions:** Are objects updated correctly as users act?
- **User Experience:** Does the app feel coherent for different roles (Office, Field, Customer)?
- **Gaps:** What logic is missing from the Epics that is required for a functioning app?

---

## How to Use This Pack

1.  **Validation:** Use these journeys to "mental-test" the current design before writing code.
2.  **Implementation Guide:** Developers should use these flows to understand the context of the models they are building.
3.  **Missing Logic Detection:** If a journey cannot be completed with the current Epic logic, it indicates a needed Epic update or a new Decision.
4.  **UX Consistency:** Ensure that different modules (Leads, Quotes, Execution) share a common interaction language.

---

## The Journey List

| # | Journey | Key Focus |
| :--- | :--- | :--- |
| **01** | [Lead to Quote](./01-lead-to-quote-journey.md) | Intake, qualification, and initial object anchoring. |
| **02** | [Site Survey Decision](./02-site-survey-decision-and-scheduling-journey.md) | When and how surveys happen before quoting. |
| **03** | [Quote Authoring](./03-quote-authoring-journey.md) | AI assistance, packet reuse, and manual scope building. |
| **04** | [Review & Send](./04-quote-review-preview-send-journey.md) | Estimator verification and the "Sent" freeze transaction. |
| **05** | [Customer Response](./05-customer-response-and-sign-journey.md) | Portal experience, signing, and version behavior. |
| **06** | [Activation](./06-activation-and-workstation-journey.md) | Turning a signed quote into an actionable Job. |
| **07** | [Task Execution](./07-task-execution-journey.md) | Field worker workflow, evidence capture, and completion. |
| **08** | [Payment & Holds](./08-payment-holds-homeowner-request-journey.md) | Intersection of work progress and payment requirements. |
| **09** | [Change Orders](./09-change-order-and-detour-journey.md) | Mid-job adjustments and detours. |
| **10** | [Closeout](./10-final-inspection-closeout-journey.md) | Final inspection, payment, and archiving. |

---

## Assessment Tools

- [Missing vs. Covered Matrix](./11-missing-vs-covered-matrix.md)
- [High-Risk UX Gaps](./12-high-risk-ux-gaps.md)
- [Recommended Next Fixes](./13-recommended-next-fixes.md)
