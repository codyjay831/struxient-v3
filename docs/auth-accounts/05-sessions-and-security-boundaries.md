# Sessions and Security Boundaries

**Decision:** Internal and Portal environments will use separate session types and strict server-side authorization enforcement.

---

## 1. Separate Session Models

| Feature | Internal Session | Portal Session |
| :--- | :--- | :--- |
| **Identity Entity** | `Account` + `TenantMembership` | `PortalAccount` |
| **Duration** | 12 hours (sliding window) | 2 hours (aggressive expiration) |
| **Security Level** | High (MFA possible) | Medium (Magic-link verified) |
| **Scopes** | Role-based (Admin, Office, etc.) | Row-based (`customerId` only) |

**Why separate?**
Prevents session hijacking across environments. A compromised portal session cannot be used to access internal admin routes, even if the user is the same person.

---

## 2. Impersonation and Support Access

-   **Policy:** Struxient Support or Tenant Admins may "View Portal as Customer" for troubleshooting.
-   **Execution:** This must create a **special audit-logged impersonation session**.
-   **Constraint:** The impersonator **must not** have the ability to "Sign" a quote while impersonating. Signing requires the actual `PortalAccount` owner's verification.
-   **Audit:** `AuditEvent` must log both the `actorUserId` (impersonator) and the `subjectPortalId`.

---

## 3. Session Revocation

-   **Global Revoke:** Revoking an `Account` session kills all memberships.
-   **Local Revoke:** Deactivating a `TenantMembership` kills only sessions for that tenant.
-   **Portal Revoke:** Office staff can "Kill Portal Sessions" for a customer contact at any time.

---

## 4. Security Boundaries (What not to delegate)

### What must never be delegated to the client:
1.  **Authorization Logic:** The frontend should hide buttons based on permissions, but the **backend must validate** the `PermissionKey` for every mutation.
2.  **Row-Level Filtering:** The frontend must never pass a `customerId` to a portal API and expect it to be trusted. The `customerId` **must be derived** from the authenticated `PortalSession` on the server.
3.  **Role Inheritance:** The client must not tell the server which role it is using. The server determines active roles from the `TenantMembership`.

### Security Failures Handling
-   **Lockout:** After 5 failed password attempts, the `Account` is locked for 15 minutes.
-   **Rate Limits:** Login endpoints must use per-IP and per-account rate limits to prevent brute-force attacks.

---

## 5. MFA Timing

-   **Decision:** MFA is **deferred** for portal users.
-   **Recommendation:** Internal staff MFA (TOTP/SMS) should be available as a tenant-level policy (`Epic 60`) but is not required for Slice 1.
-   **Why:** Trade estimator speed vs. security. Admins should be encouraged to enable MFA for office staff.
