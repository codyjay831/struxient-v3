# Auth Schema Planning Impact

**Purpose:** Translate auth and account decisions into specific entities for future schema planning.

---

## 1. Core Identity Entities

| Entity | Role | Key Fields |
| :--- | :--- | :--- |
| **Account** | Global person record | `id`, `email`, `name`, `status` (active/suspended), `mfaSecret` |
| **AccountCredential** | Secret storage | `accountId`, `hashedPassword`, `credentialType` (PASSWORD/OAUTH) |
| **TenantMembership** | Link Account to Tenant | `id`, `accountId`, `tenantId`, `status` (pending/active/deactivated) |
| **MembershipRole** | Active role binding | `membershipId`, `roleKey` (ADMIN/OFFICE/etc) |

---

## 2. Portal Entities

| Entity | Role | Key Fields |
| :--- | :--- | :--- |
| **PortalAccount** | Customer login | `id`, `contactId`, `customerId`, `status`, `lastLoginAt` |
| **PortalCredential** | Optional portal pass | `portalAccountId`, `hashedPassword` |

---

## 3. Session and Token Entities

| Entity | Role | Key Fields |
| :--- | :--- | :--- |
| **Session** | Active internal session | `id`, `accountId`, `membershipId`, `expiresAt`, `ip`, `userAgent` |
| **PortalSession** | Active portal session | `id`, `portalAccountId`, `expiresAt`, `ip` |
| **InviteToken** | Internal onboarding | `tokenHash`, `membershipId`, `expiresAt`, `usedAt` |
| **MagicLinkToken** | Portal login / verify | `tokenHash`, `portalAccountId`, `expiresAt`, `usedAt` |
| **PasswordResetToken** | Recovery | `tokenHash`, `accountId`, `expiresAt`, `usedAt` |

---

## 4. Audit and Control

| Entity | Role | Key Fields |
| :--- | :--- | :--- |
| **AuditEvent** | Auth & AuthZ history | `id`, `actorAccountId`, `impersonatorId`, `action`, `tenantId`, `metadata` (JSON) |
| **RateLimitBucket** | Security enforcement | `key` (IP/Email), `counter`, `resetAt` |

---

## Schema Invariants

1.  **Unique Emails:** `Account.email` must be unique globally. `PortalAccount.contactId` (via `Contact.email`) must be unique per `Tenant` but can overlap with `Account` emails.
2.  **Cascading Deactivation:** If `Account.status = suspended`, all related `Session` records must be ignored/revoked.
3.  **Strict Isolation:** `PortalSession` records must **never** contain a `membershipId`.
4.  **Role Validity:** `MembershipRole.roleKey` must exist in the system's `PermissionRegistry`.
