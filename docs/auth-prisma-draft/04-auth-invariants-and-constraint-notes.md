# Auth Invariants and Constraint Notes

**Status:** Forced integrity rules for auth schema and implementation.

---

## 1. Database-Enforced Invariants (Prisma/DB)

### Internal Staff Uniqueness
- **`Account.email` (Global):** Strictly unique across the entire platform. One human = one `Account`.
- **`TenantMembership(accountId, tenantId)`:** A human can only be a member of a tenant once.
- **`MembershipRole(membershipId, roleKey)`:** A member cannot have the same role twice in the same tenant.

### Customer Portal Uniqueness
- **`PortalAccount.contactId`:** Strictly one-per-contact. 
- **Wait!** If multiple contacts share an email under one customer, can they both have portal access?
    - **Decision:** Yes, but they must be managed as separate contacts. The magic link will target the specific `contactId`.

### Session/Token Integrity
- **`InternalSession.tokenHash` / `PortalSession.tokenHash`:** Strictly unique to prevent session collisions.
- **`AuthToken.tokenHash`:** Strictly unique.

---

## 2. Application-Enforced Invariants (Code/Logic)

### Email Normalization
- **Rule:** Every email must be `trim().toLowerCase()` before any DB operation.
- **Why:** Prevent "User@Example.com" and "user@example.com" from being treated as different identities.

### Token Single-Use
- **Rule:** `AuthToken` must be marked as `usedAt` immediately upon successful verification.
- **Enforcement:** The auth service must check `usedAt == null` before proceeding.

### Portal Boundary
- **Rule:** `PortalAccount.customerId` must match `Contact.customerId`.
- **Enforcement:** The service creating the `PortalAccount` must validate this linkage.

### Invite-Account Linkage
- **Rule:** Creating a `TenantMembership` from a `STAFF` invite must use the `accountId` matching the invite email.
- **Enforcement:** If no `Account` exists, create it first; if it exists, verify the email matches exactly.

---

## 3. Session Invalidation Rules

### Automatic Triggers
The application **must** implement logic to delete or ignore session rows in these scenarios:

| Event | Required Invalidation |
| :--- | :--- |
| **Password Change** | All `InternalSession` rows for the `AccountId`. |
| **Account Suspension** | All `InternalSession` rows for the `AccountId`. |
| **Membership Deactivation** | All `InternalSession` rows for the `MembershipId`. |
| **Portal Account Disabled** | All `PortalSession` rows for the `PortalAccountId`. |
| **Invite Revoked** | The corresponding `AuthToken` and `Invite` record must be invalidated. |

---

## 4. Visibility Constraints

### Staff Visibility
- **Rule:** All queries for staff data **must** be scoped by `tenantId` derived from the `InternalSession`.
- **Global Admin:** Only users with a `PlatformAdmin` role (defined in code or global metadata) can bypass this scoping.

### Portal Visibility
- **Rule:** All queries for homeowner data **must** be scoped by `customerId` derived from the `PortalSession`.
- **Enforcement:** The `PortalSession` table includes `customerId` explicitly to simplify this filtering.
