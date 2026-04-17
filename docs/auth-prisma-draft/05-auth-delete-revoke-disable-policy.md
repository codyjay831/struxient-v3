# Auth Delete, Revoke, and Disable Policy

**Status:** Defined behaviors for account/membership lifecycle events.

---

## 1. Internal Staff Models

### Account Suspension (Soft-Disable)
- **Action:** Set `Account.status = SUSPENDED`.
- **Effect:** User is blocked globally. 
- **Cascade:** The application layer must ignore or delete all `InternalSession` rows for this `accountId`.
- **Hard Delete:** Not recommended for `Account` as it may break audit trails of historical actions (e.g., `createdBy`).

### Membership Deactivation (Soft-Disable)
- **Action:** Set `TenantMembership.status = DEACTIVATED`.
- **Effect:** User can still log in globally but cannot access this specific tenant.
- **Cascade:** Delete all `InternalSession` rows linked to this `membershipId`.

### Invite Revoke
- **Action:** Set `Invite.status = REVOKED`.
- **Effect:** The `AuthToken` linked to the invite (if any) must be immediately marked as `usedAt` or deleted.
- **Hard Delete:** Safe for pending `Invite` rows that have never been used.

---

## 2. Customer Portal Models

### Portal Disable (Soft-Disable)
- **Action:** Set `PortalAccount.status = DISABLED`.
- **Effect:** Homeowner is blocked from the portal.
- **Cascade:** Delete all `PortalSession` rows linked to this `portalAccountId`.

### Contact Deletion
- **Action:** Delete `Contact` row.
- **Cascade:** `PortalAccount` and its `PortalSession` records must be **hard deleted** (Cascade Delete enforced in Prisma).
- **Why:** Portal accounts are ephemeral and anchored strictly to the `Contact`. If the person is removed, their access should be wiped.

### Customer Archival
- **Action:** `Customer` status set to `ARCHIVED` (not deleted).
- **Effect:** `PortalAccount.status` should be automatically set to `DISABLED` for all portal users under this customer.

---

## 3. Session and Token Revocation

### Logout
- **Action:** Hard delete the specific `InternalSession` or `PortalSession` row by `tokenHash`.

### Password Reset
- **Action:** Consuming the `PASSWORD_RESET` token must trigger a global session wipe for that `accountId`.

### Token Expiration
- **Action:** Application must ignore rows where `expiresAt < now()`.
- **Cleanup:** A periodic job (or background task) should hard delete expired tokens and sessions to keep tables lean.

---

## 4. Audit Requirements

Every lifecycle change must be logged in `AuthAuditEvent`:
- **Subject:** `accountId` or `portalAccountId`.
- **Action:** `SUSPEND`, `DEACTIVATE`, `REVOKE`, `DISABLE`.
- **Actor:** `accountId` of the person performing the change (e.g., the Admin).
- **Timestamp:** Mandatory.
