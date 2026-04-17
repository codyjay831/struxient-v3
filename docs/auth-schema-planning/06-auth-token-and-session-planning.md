# Auth Token and Session Planning

**Status:** Technical planning for session and token mechanics.

---

## 1. Session Model

### Separation Strategy
- **Settled:** `InternalSession` and `PortalSession` will use separate tables.
- **Why:** Simplifies schema constraints. `InternalSession` requires an `accountId` and `membershipId`, while `PortalSession` only requires a `portalAccountId`.

### Session Lifetimes
- **Internal:** 12 hours (sliding window).
- **Portal:** 2 hours (fixed or short sliding window).
- **"Remember Me":** Deferred for Slice 1. Assume standard expiration for now.

---

## 2. Token Model

### Unified `AuthToken` Table
Instead of separate tables for resets, magic links, and invites, use a unified `AuthToken` table with a `purpose` discriminator.

| Token Purpose | Linked Entity | Lifetime |
| :--- | :--- | :--- |
| **`INVITE`** | `Invite` | 7 Days |
| **`MAGIC_LINK`**| `PortalAccount` | 1 Hour |
| **`PASSWORD_RESET`**| `Account` | 1 Hour |
| **`EMAIL_VERIFY`**| `Account` | 24 Hours |

---

## 3. Revocation Semantics

### Token Invalidation
- **Single Use:** Tokens must be marked `usedAt` immediately upon verification.
- **Expiry:** Expired tokens must be rejected by the API.

### Session Invalidation Triggers
The following actions must immediately invalidate sessions:
1.  **Logout:** Direct deletion of the session record.
2.  **Password Change:** Deletes all active sessions for that account.
3.  **Membership Deactivation:** Deletes all sessions linked to that specific membership.
4.  **Account Suspension:** System ignores/deletes all sessions for that account globally.

---

## 4. Multi-Device Support

- **Deferred:** Device fingerprinting and session listing (e.g., "Log out of other devices") is out of scope for MVP.
- **Current Stance:** Multiple sessions per account are allowed (standard behavior).
