# Auth and Accounts Synthesis

**Purpose:** Summarize the current scattered auth and account assumptions across Struxient v3 documentation, identify what is already clear, where documentation is scattered, and where decisions are still missing.

---

## Current State of Auth Assumptions

Documentation for authentication, accounts, and permissions is currently distributed across several epics and planning documents. While no single "Auth Epic" existed, the system's requirements for multi-tenancy, portal access, and role-based control are deeply embedded in the v3 core thesis.

### What is clear (Explicit assumptions)

1.  **Hard Tenant Isolation:** Every entity in the system is logically scoped by `tenantId`. APIs must enforce this boundary at every request.
2.  **Explicit Internal Roles:** Roles are well-defined across epics: `Admin`, `Office`, `Estimator`, `Field`, `Finance`. These gate specific actions (e.g., `quote.send`, `task.execute`).
3.  **Separate Portal Identity:** Portal users are distinct from internal staff. They are anchored to a `Customer` and authenticate primarily via magic links.
4.  **Audit Responsibility:** Every authentication event, role change, and portal invite must be logged in a central `AuditEvent` stream for compliance and support.
5.  **Ownership Requirement:** Struxient must own the "meaning" of an account and its relationship to the product logic, regardless of the low-level provider used for token issuance or hashing.

### Where it is scattered (Implicit patterns)

-   **User vs. Member:** Some docs refer to "Users" as tenant-local records, while others imply a person might have roles in multiple areas. The relationship between a global login and a tenant membership is not yet centralized.
-   **Contact-Portal Linkage:** `Epic 04 (Contacts)` and `Epic 53 (Portal)` both touch on how a person (Contact) becomes a user (PortalUser), but the exact "handshake" between a CRM contact and an active auth session is spread across the two docs.
-   **Session Lifecycles:** Requirements for session revocation, impersonation, and logout are mentioned in passing in `Epic 57 (Audit)` and `Epic 60 (Settings)` but lack a unified technical contract.

### Gaps and Missing Decisions

1.  **Identity vs. Membership Model:** Does Struxient have a "Global Account" that can belong to multiple "Tenants"? Or are they entirely siloed? (See `02-internal-account-model-decision.md`).
2.  **Portal-Internal Separation:** To what degree do internal staff and portal users share an underlying "Account" table? (See `03-portal-account-model-decision.md`).
3.  **Auth Flow Primitives:** The specific mechanics of "Invite → Verify → Set Password" are implied but not specified as a standard flow. (See `04-auth-flow-decisions.md`).
4.  **MFA Timing:** MFA is mentioned as a setting but its enforcement and implementation priority for MVP are undefined.

---

## Synthesis Conclusion

The v3 architecture is ready for a unified auth model. The "trade-first" thesis requires fast onboarding for crews (internal) and frictionless access for homeowners (portal). A model that separates **Identity** (who you are) from **Membership** (what you can do in a company) is the most consistent path forward for the Struxient v3 vision.
