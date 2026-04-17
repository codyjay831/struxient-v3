# Internal Account Model Decision

**Decision:** Struxient v3 will use a **Global Account Identity + Tenant Membership** model for internal staff.

---

## The Model

### 1. Account (Global Identity)
-   **What it is:** A global record representing a person across all of Struxient v3.
-   **Owns:** Primary email, hashed password, MFA settings, global profile (name, avatar), and system-level status (active/suspended).
-   **Role:** Authentication anchor. You log in to your *Account*.

### 2. Tenant Membership (Local Relationship)
-   **What it is:** A record that binds a global `AccountId` to a specific `TenantId`.
-   **Owns:** Role assignments, tenant-specific settings (e.g., job assignment scope), and membership-level status (active/deactivated).
-   **Role:** Authorization anchor. After logging in, you operate within a *Membership*.

---

## Rationale

### Why this model?
1.  **Multi-Tenant Support:** Users (like independent consultants, multi-brand admins, or Struxient support staff) can belong to multiple tenants with a single login.
2.  **Clear Boundary:** It separates *who you are* (Account) from *what you can do here* (Membership).
3.  **Supportability:** Struxient staff can have a global account that is granted temporary membership in a client tenant for troubleshooting without creating a new "User" record every time.
4.  **Security Lifecycle:** Suspending a global account immediately blocks access across all tenants, while deactivating a membership only removes access to that specific company.

### What it enables
-   Single Sign-On (SSO) at the global level later.
-   A "Switch Tenant" UI for power users.
-   Global worker identities for future field-crew marketplaces.

### What it forbids
-   Creating multiple "User" records with the same email in different tenants (prevents email collisions and password-sync confusion).
-   Storing company-specific roles directly on the global account record.

---

## Decision Stance

-   **Decision:** **Global Identity + Memberships.**
-   **Recommendation:** Implement `Account` and `TenantMembership` as distinct relational tables.
-   **Avoid:** "One user per tenant" silo models where the same email must have separate passwords per company.
-   **Multi-tenant future:** Assume a user can have 1-to-N memberships.

---

## Membership Lifecycle

| Event | Effect |
| :--- | :--- |
| **Invite** | Creates a pending `TenantMembership` linked to an email. If an `Account` doesn't exist, it triggers account creation. |
| **Accept** | Links the `Account` to the `TenantMembership` and sets status to `active`. |
| **Deactivate** | Sets `TenantMembership.status = deactivated`. The `Account` remains active but cannot access that tenant. |
| **Suspend Account** | Sets `Account.status = suspended`. The user cannot log in at all, regardless of membership status. |
| **Role Change** | Updates the `Role` binding on the `TenantMembership`. |
