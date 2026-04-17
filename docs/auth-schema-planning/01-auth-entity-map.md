# Auth Entity Map

**Status:** Settled planning map for auth/account entities.

---

## 1. Internal Auth Entities (Global & Tenant-Scoped)

These entities support the **Global Identity + Tenant Membership** model for staff.

| Entity | Purpose | Ownership | Context |
| :--- | :--- | :--- | :--- |
| **Account** | Global person record. | Email, global profile, global status. | Global |
| **AccountCredential** | Secret storage (password hashes). | Password hash, salt (if needed), algo type. | Global |
| **TenantMembership** | Binds an Account to a specific Tenant. | Membership status, join date. | Tenant-Scoped |
| **MembershipRole** | RBAC assignment within a tenant. | Role key (e.g., ADMIN, ESTIMATOR). | Tenant-Scoped |
| **InternalSession** | Active authenticated staff session. | Token, Account/Membership pointers, metadata. | Global/Tenant |

---

## 2. Customer Portal Entities

These entities are isolated from internal staff and anchored to CRM contacts.

| Entity | Purpose | Ownership | Context |
| :--- | :--- | :--- | :--- |
| **PortalAccount** | Customer auth record anchored to a Contact. | Portal status, last login. | Tenant-Scoped |
| **PortalCredential** | Optional password for return portal users. | Password hash. | Tenant-Scoped |
| **PortalSession** | Active authenticated homeowner session. | Token, PortalAccount pointer, metadata. | Tenant-Scoped |

---

## 3. Onboarding & Recovery Entities

Shared logic for invites and security tokens.

| Entity | Purpose | Ownership | Context |
| :--- | :--- | :--- | :--- |
| **Invite** | Pending onboarding request. | Email, target role, target tenant, status. | Cross-cutting |
| **AuthToken** | Hashed short-lived tokens. | Token hash, purpose (MAGIC_LINK, RESET, VERIFY). | Cross-cutting |

---

## 4. Entity Boundaries

### What an entity must NOT own:
- **Account** must not own **Permissions**. Permissions are derived from the `MembershipRole`.
- **TenantMembership** must not own **Email**. The email belongs to the `Account`.
- **PortalAccount** must not own **Billing Info**. That belongs to the `Customer` record.
- **InternalSession** must not be reused for **Portal** access.

### Cross-cutting vs. Shared:
- **`AuthToken`** is a shared utility table for various secret-based flows.
- **`Invite`** handles both staff and portal onboarding but carries metadata to distinguish them.
- **`Account`** is the only truly "Global" entity (accessible across tenants). All other records carry a `tenantId`.
