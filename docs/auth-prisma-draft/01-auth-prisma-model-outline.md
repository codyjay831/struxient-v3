# Auth Prisma Model Outline

**Status:** Normalized draft blueprint for auth/account models.

---

## Normalization Decisions

Before outlining models, these key inconsistencies have been resolved:

1.  **Token Model:** Unified `AuthToken` table with a `purpose` enum. No separate tables for different token types.
2.  **Pending Membership:** `TenantMembership` exists **only after** invite acceptance. Pending invites live exclusively in the `Invite` table.
3.  **Portal Uniqueness:** `PortalAccount` is strictly **one-per-Contact**.
4.  **Session Naming:** Standardized on `InternalSession` and `PortalSession`.

---

## 1. Internal Auth Models (Staff)

### Account
- **Purpose:** Global identity for a person.
- **Fields:** `id` (PK, CUID), `email` (String, unique), `name` (String), `status` (AccountStatus), `mfaSecret` (String, null), `createdAt`, `updatedAt`.
- **Relations:** 
    - `credentials` (1:N to `AccountCredential`)
    - `memberships` (1:N to `TenantMembership`)
    - `sessions` (1:N to `InternalSession`)
- **Uniqueness:** `email`.
- **Soft-disable:** Via `status = SUSPENDED`.

### AccountCredential
- **Purpose:** Secure storage of passwords/secrets.
- **Fields:** `id` (PK), `accountId` (FK), `hashedValue` (String), `type` (CredentialType), `createdAt`, `updatedAt`.
- **Relations:** `account` (N:1 to `Account`).
- **Unique:** `(accountId, type)`.

### TenantMembership
- **Purpose:** Links an `Account` to a `Tenant` with roles.
- **Fields:** `id` (PK), `accountId` (FK), `tenantId` (FK), `status` (MembershipStatus), `createdAt`, `updatedAt`.
- **Relations:** 
    - `account` (N:1 to `Account`)
    - `tenant` (N:1 to `Tenant`)
    - `roles` (1:N to `MembershipRole`)
- **Unique:** `(accountId, tenantId)`.
- **Soft-disable:** Via `status = DEACTIVATED`.

### MembershipRole
- **Purpose:** RBAC assignment within a membership.
- **Fields:** `id` (PK), `membershipId` (FK), `roleKey` (String), `createdAt`.
- **Relations:** `membership` (N:1 to `TenantMembership`).
- **Unique:** `(membershipId, roleKey)`.

---

## 2. Customer Portal Models

### PortalAccount
- **Purpose:** Customer-facing auth anchored to a `Contact`.
- **Fields:** `id` (PK), `contactId` (FK, unique), `customerId` (FK), `tenantId` (FK), `status` (PortalAccountStatus), `lastLoginAt`, `createdAt`, `updatedAt`.
- **Relations:**
    - `contact` (1:1 to `Contact`)
    - `customer` (N:1 to `Customer`)
    - `tenant` (N:1 to `Tenant`)
    - `sessions` (1:N to `PortalSession`)
- **Uniqueness:** `contactId`.
- **Delete Behavior:** Cascade delete if the parent `Contact` is deleted (security boundary).

### PortalSession
- **Purpose:** Active homeowner portal session.
- **Fields:** `id` (PK), `tokenHash` (String, unique), `portalAccountId` (FK), `customerId` (FK), `expiresAt`, `ipAddress`, `userAgent`, `createdAt`.
- **Relations:** `portalAccount` (N:1 to `PortalAccount`).
- **Unique:** `tokenHash`.

---

## 3. Onboarding & Shared Logic

### Invite
- **Purpose:** Pending onboarding requests for staff or portal users.
- **Fields:** `id` (PK), `email` (String), `tenantId` (FK), `type` (InviteType: STAFF/PORTAL), `targetRoles` (String[], only for staff), `targetContactId` (FK, only for portal), `status` (InviteStatus), `expiresAt`, `createdAt`, `updatedAt`.
- **Relations:** `tenant` (N:1 to `Tenant`).
- **Unique:** `(email, tenantId, type)` (prevent multiple pending invites of same type to same email in same tenant).

### AuthToken
- **Purpose:** Unified table for all secure short-lived tokens.
- **Fields:** `id` (PK), `tokenHash` (String, unique), `purpose` (AuthTokenPurpose), `email` (String, for lookup), `accountId` (FK, null), `portalAccountId` (FK, null), `usedAt`, `expiresAt`, `createdAt`.
- **Unique:** `tokenHash`.

### InternalSession
- **Purpose:** Active staff session.
- **Fields:** `id` (PK), `tokenHash` (String, unique), `accountId` (FK), `membershipId` (FK), `tenantId` (FK), `expiresAt`, `ipAddress`, `userAgent`, `createdAt`.
- **Unique:** `tokenHash`.
- **Indexes:** `accountId`, `membershipId`.

### AuthAuditEvent
- **Purpose:** Dedicated security audit log.
- **Fields:** `id` (PK), `type` (AuthEventType), `accountId`, `portalAccountId`, `ipAddress`, `metadata` (JSON), `createdAt`.
- **Relations:** Optional link to global `AuditEvent`.
