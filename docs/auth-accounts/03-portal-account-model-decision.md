# Customer Portal Account Model Decision

**Decision:** Portal users will use a **Separate Portal Account** model, distinct from internal staff accounts, anchored to **Contacts**.

---

## The Model

### 1. PortalAccount
-   **What it is:** A specialized auth record for customer-facing access.
-   **Tied to:** Exactly one **Contact** record under a **Customer**.
-   **Owns:** Portal-specific credentials (magic link tokens, optional portal-only password), status (`invited`, `active`, `disabled`), and `lastLoginAt`.
-   **Role:** Access to the Customer Portal for a specific customer entity.

### 2. Contact Linkage
-   Portal identity is derived from a **Contact** (defined in `Epic 04`).
-   A Customer may have multiple Contacts, and each Contact can be granted its own portal access.
-   **Visibility Boundary:** A `PortalAccount` inherits the `customerId` from its parent Contact and is strictly isolated to that customer's data.

---

## Rationale

### Why separate internal and portal accounts?
1.  **Security Boundaries:** Internal staff accounts have high-privilege role assignments and access to sensitive admin UIs. Portal users have low-privilege, row-isolated access. Keeping them separate prevents accidental privilege escalation (e.g., a customer finding an internal API route).
2.  **Auth Experience:** Portal users typically expect **magic link** (no password) access by default for frictionless quote signing. Internal staff require more robust password + MFA policies.
3.  **Identity Meaning:** An internal user *is* an employee/member of the company. A portal user *is* a customer representative. Their lifecycles (hiring vs. contracting) are entirely different.
4.  **PII Privacy:** Customer portal data may need different encryption or masking rules than internal CRM data.

### Relationship to Customer and Contact
-   **One Portal Login per Contact:** Each person (Contact) gets their own login.
-   **Multiple Portal Users per Customer:** A business customer can have a "Billing Manager" and a "Project Manager" both logged in to the portal, seeing the same quote history but with different contact method audit trails.

---

## Login Method Recommendation

-   **Primary:** **Magic Link.** The user enters their email, receives a time-limited token, and is logged in.
-   **Optional:** **Password.** After the first magic-link login, the user may *optionally* set a password for faster return access if they prefer.
-   **Rationale:** Homeowners sign quotes once every few years; they will forget passwords. Commercial contractors sign quotes every week; they may want a password.

---

## Portal Row-Visibility

-   **Enforcement:** Every API request from a portal session **must** include a `customerId` filter derived from the session's `PortalAccount`.
-   **Internal Leakage Prevention:** Portal accounts **never** have a `TenantMembership` record. They are entirely outside the internal role/permission matrix.

---

## Decision Stance

-   **Decision:** **Separate Portal Accounts.**
-   **Recommendation:** Do not use the `Account` table for portal users initially. Create a dedicated `PortalAccount` entity.
-   **What to avoid:** Cascading portal access to internal staff accounts (e.g., an employee who is also a customer of their own company should have two separate logins to ensure role separation).
