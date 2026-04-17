# Auth Security Boundary Rules

**Status:** Forced schema-affecting security rules for developers.

---

## 1. Session-Derived Identifiers

### Rules
- **`tenantId`:** Must be derived from the `InternalSession` or `PortalSession`.
- **`accountId`:** Must be derived from the `InternalSession`.
- **`membershipId`:** Must be derived from the `InternalSession`.
- **`portalAccountId`:** Must be derived from the `PortalSession`.

### What Not To Do
- **NEVER** accept `tenantId` from a client-provided request body for data-fetching.
- **NEVER** trust `customerId` from the frontend when querying portal data.

---

## 2. Row-Level Filtering

### Internal Staff
- **Rule:** Every query must include `WHERE tenant_id = session.tenant_id`.
- **Exception:** Global admins accessing multi-tenant reports.

### Customer Portal
- **Rule:** Every query must include `WHERE customer_id = session.customer_id`.
- **Enforcement:** The `PortalSession` table must include `customerId` (derived from the `PortalAccount`) to enable this filtering without complex joins.

---

## 3. Authorization Checks

### Membership-Based (Staff)
- **RBAC:** Roles must be checked against the `MembershipRole` table linked to the active `membershipId`.
- **Stance:** A user with `ADMIN` in Tenant A is **NOT** an `ADMIN` in Tenant B unless they have an explicit `MembershipRole` in both.

### Portal-Account-Based (Homeowner)
- **Constraint:** Portal accounts have no "roles" in Slice 1. All portal users see all data permitted for their parent `customerId`.

---

## 4. Backend-Only Responsibilities

The following logic must be executed **only** on the server:
1.  **Password Hashing:** Use Argon2/bcrypt on the server (never client-side).
2.  **Token Generation:** Secrets must be generated using cryptographically secure PRNGs.
3.  **Role Inheritance:** Any role-based hierarchy must be resolved by the backend service.
4.  **Row visibility:** The client is purely for display; the server is the source of truth for visibility.
