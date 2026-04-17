# Auth Flow Decisions

**Decision:** Struxient v3 will implement standardized invite-driven onboarding for both internal staff and portal users, prioritizing email ownership as the primary verification signal.

---

## 1. Internal Staff Flows

### Internal Invite Flow
1.  **Trigger:** Admin enters email and selects Roles in `/settings/team`.
2.  **System Action:**
    -   Creates a `TenantMembership` record (status: `pending`).
    -   Sends an invite email with a unique `InviteToken`.
3.  **User Action:** Clicks link in email.

### Internal First Login (Onboarding)
1.  **Scenario A: New User (No Global Account)**
    -   User lands on "Join Company" page.
    -   User enters name and sets a password.
    -   System creates the `Account` and `AccountCredential`.
    -   System activates the `TenantMembership`.
2.  **Scenario B: Existing User (Has Global Account)**
    -   User lands on "Join Company" page.
    -   System recognizes the email and asks the user to log in with their existing password.
    -   System activates the new `TenantMembership`.

### Internal Password Reset
1.  User enters email on "Forgot Password" page.
2.  System sends email with `PasswordResetToken` (time-limited, single-use).
3.  User sets new password. All active `Sessions` for that account are revoked (security policy).

---

## 2. Customer Portal Flows

### Portal Invite Flow
1.  **Trigger:** Office staff clicks "Invite to Portal" on a **Contact** record.
2.  **System Action:**
    -   Creates a `PortalAccount` (status: `invited`).
    -   Sends email with `MagicLinkToken`.
3.  **User Action:** Clicks link in email.

### Portal First Access
1.  User clicks magic link.
2.  System verifies token, sets `PortalAccount.status = active`.
3.  User is prompted to verify/update their profile name.
4.  User is logged in to the portal session.

### Portal Return Login
1.  User enters email on portal login page.
2.  System checks if `PortalAccount` exists.
3.  **If yes:** Sends a new Magic Link.
4.  **If no:** (Security Policy) System shows a generic "Check your email for access instructions" message to prevent email probing. If no account exists, no email is sent.

---

## 3. Email/Identity Rules

| Question | Decision |
| :--- | :--- |
| **Email already exists?** | Internal: Link to existing Account. Portal: Block if email is used by a different Customer; Allow if it's the same Customer. |
| **Invite Expiration?** | 7 days for internal; 48 hours for portal magic links. |
| **Deactivated User?** | User can still log in to their global Account but sees a "No active memberships" or "Access denied" screen for that tenant. |
| **Revoke behavior?** | Revoking an invite deletes the pending `TenantMembership` or `PortalAccount` and invalidates the token. |

---

## 4. Security Primitives

-   **Password Policy:** Minimum 12 characters, complexity enforced.
-   **Token Storage:** All tokens (`InviteToken`, `MagicLinkToken`, `PasswordResetToken`) must be hashed in the database.
-   **Rate Limiting:** Aggressive rate limiting on login attempts, magic link requests, and password reset requests.
