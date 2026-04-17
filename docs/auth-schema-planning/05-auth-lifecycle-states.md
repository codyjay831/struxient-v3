# Auth Lifecycle States

**Status:** Finite State Machines (FSM) for auth and account entities.

---

## 1. Account States (Global)

| State | Meaning |
| :--- | :--- |
| **ACTIVE** | User can log in and access all active memberships. |
| **SUSPENDED**| User is blocked globally. All sessions are invalid. |

**Transitions:**
- `ACTIVE` → `SUSPENDED`: Triggered by platform admin or fraud detection.
- `SUSPENDED` → `ACTIVE`: Triggered by platform admin only.

---

## 2. Tenant Membership States (Local)

| State | Meaning |
| :--- | :--- |
| **ACTIVE** | Member has access to the tenant under assigned roles. |
| **DEACTIVATED**| Member no longer has access to this specific tenant. |

**Transitions:**
- `ACTIVE` → `DEACTIVATED`: Triggered by tenant admin or member leaving.
- `DEACTIVATED` → `ACTIVE`: Triggered by tenant admin (reactivation).

---

## 3. Invite States

| State | Meaning |
| :--- | :--- |
| **PENDING** | Invite sent, waiting for acceptance. |
| **ACCEPTED** | User accepted invite and account/membership is active. |
| **REVOKED** | Admin cancelled the invite before acceptance. |
| **EXPIRED** | Time window closed. |

**Transitions:**
- `PENDING` → `ACCEPTED`: User clicks link and completes onboarding.
- `PENDING` → `REVOKED`: Admin action.
- `PENDING` → `EXPIRED`: System automated (e.g., after 7 days).

---

## 4. Portal Account States

| State | Meaning |
| :--- | :--- |
| **INVITED** | Homeowner has been invited but never logged in. |
| **ACTIVE** | Homeowner has authenticated at least once. |
| **DISABLED** | Access revoked by office staff. |

**Transitions:**
- `INVITED` → `ACTIVE`: First magic-link authentication.
- `ACTIVE` → `DISABLED`: Office staff revokes access.
- `DISABLED` → `ACTIVE`: Office staff restores access.

---

## 5. Token/Session Validity

| Attribute | Validity Condition |
| :--- | :--- |
| **Is Session Valid?**| `currentTime < expiresAt` AND `tokenHash` matches AND user is `ACTIVE`. |
| **Is Token Valid?** | `currentTime < expiresAt` AND `usedAt` is NULL AND `tokenHash` matches. |
