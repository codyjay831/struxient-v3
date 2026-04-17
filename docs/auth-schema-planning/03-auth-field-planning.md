# Auth Field Planning

**Status:** Minimum field requirements for auth/account entities.

---

## 1. Internal Identity & Credentials

### `Account`
| Field | Purpose | Required | Mutable | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | PK | Yes | No | CUID recommended. |
| `email` | Unique login. | Yes | Yes | Lowercase, trimmed. |
| `name` | Global display name. | Yes | Yes | |
| `status` | Global lockout. | Yes | Yes | `ACTIVE`, `SUSPENDED`. |
| `mfaSecret` | TOTP storage. | No | Yes | Encrypted at rest. |

### `AccountCredential`
| Field | Purpose | Required | Mutable | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `accountId` | Parent link. | Yes | No | FK to Account. |
| `hashedPassword`| Secure secret. | Yes | Yes | Argon2/bcrypt result. |
| `type` | Credential kind. | Yes | No | `PASSWORD`, `OAUTH`. |

---

## 2. Membership & Roles

### `TenantMembership`
| Field | Purpose | Required | Mutable | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | PK | Yes | No | |
| `accountId` | User link. | Yes | No | FK to Account. |
| `tenantId` | Company link. | Yes | No | FK to Tenant. |
| `status` | Active status. | Yes | Yes | `ACTIVE`, `DEACTIVATED`. |
| `invitedEmail`| Original email. | Yes | No | From the `Invite`. |

### `MembershipRole`
| Field | Purpose | Required | Mutable | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `membershipId` | Parent link. | Yes | No | |
| `roleKey` | Permission set. | Yes | Yes | Enum: `ADMIN`, `FIELD`, etc. |

---

## 3. Portal Entities

### `PortalAccount`
| Field | Purpose | Required | Mutable | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | PK | Yes | No | |
| `contactId` | CRM anchor. | Yes | No | FK to Contact. |
| `customerId` | Visibility anchor.| Yes | No | FK to Customer (for query optimization). |
| `status` | Auth state. | Yes | Yes | `INVITED`, `ACTIVE`, `DISABLED`. |
| `lastLoginAt` | Audit. | No | Yes | |

---

## 4. Sessions & Tokens

### `InternalSession` / `PortalSession`
| Field | Purpose | Required | Mutable | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `tokenHash` | Lookup key. | Yes | No | Hashed version of client token. |
| `expiresAt` | Expiration. | Yes | No | |
| `ipAddress` | Security audit. | No | No | |
| `userAgent` | Security audit. | No | No | |

### `AuthToken`
| Field | Purpose | Required | Mutable | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `tokenHash` | Lookup key. | Yes | No | |
| `purpose` | Token type. | Yes | No | `MAGIC_LINK`, `RESET`, `VERIFY`. |
| `usedAt` | Single-use flag.| No | Yes | |
| `expiresAt` | Validity window. | Yes | No | |
