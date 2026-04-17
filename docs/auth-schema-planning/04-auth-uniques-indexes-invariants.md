# Auth Uniques, Indexes, and Invariants

**Status:** Critical integrity rules for the auth schema.

---

## 1. Uniqueness Rules

| Entity | Constraint | Purpose |
| :--- | :--- | :--- |
| **Account** | `UNIQUE(email)` | Primary login key (Global). |
| **TenantMembership** | `UNIQUE(accountId, tenantId)` | Prevent duplicate memberships. |
| **PortalAccount** | `UNIQUE(contactId)` | Exactly one portal account per CRM contact. |
| **MembershipRole** | `UNIQUE(membershipId, roleKey)` | Prevent duplicate role assignments. |
| **InternalSession** | `UNIQUE(tokenHash)` | Prevent session collisions. |
| **Invite** | `UNIQUE(email, tenantId, type)`| Prevent duplicate pending invites. |

---

## 2. Critical Indexes

| Table | Index Columns | Why |
| :--- | :--- | :--- |
| `TenantMembership`| `(tenantId, status)` | Fast lookup of active team members. |
| `InternalSession` | `(accountId, expiresAt)`| Fast session cleanup/revocation. |
| `PortalAccount` | `(customerId, status)` | Filter active portal users for a customer. |
| `AuthToken` | `(tokenHash, usedAt)` | Fast token verification. |

---

## 3. Hard Invariants

### Membership ↔ Account Linkage
- **Rule:** A `TenantMembership` cannot be created for an email that is already a `SUSPENDED` global `Account`.
- **Reason:** Suspended users are banned from the entire platform.

### Portal Account Boundary
- **Rule:** `PortalAccount.customerId` must equal `Contact.customerId`.
- **Reason:** Prevents a contact from "Company A" being granted portal access to "Company B" data.

### Token Integrity
- **Rule:** `AuthToken` records must be hashed in the database.
- **Reason:** Even with a database leak, attackers cannot spoof magic links or password resets.

---

## 4. Suspension and Removal Invariants

| Action | Required Effect |
| :--- | :--- |
| **Suspend Account** | All active `InternalSession` records for that `AccountId` must be ignored or immediately deleted. |
| **Deactivate Membership** | Only `InternalSession` records for that specific `MembershipId` must be invalidated. |
| **Delete Contact** | The linked `PortalAccount` and all its `PortalSession` records must be deleted or archived. |
| **Revoke Invite** | The `InviteToken` must be immediately invalidated. |
