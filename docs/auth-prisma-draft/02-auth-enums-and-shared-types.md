# Auth Enums and Shared Types

**Status:** Defined enums and shared conventions for auth.

---

## 1. Auth Enums

### AccountStatus
- `ACTIVE`: Normal operation.
- `SUSPENDED`: Global lockout (manual or security-triggered).

### MembershipStatus
- `ACTIVE`: Access granted to tenant.
- `DEACTIVATED`: Access revoked for this tenant.

### PortalAccountStatus
- `INVITED`: Account created but never logged in.
- `ACTIVE`: Authenticated at least once.
- `DISABLED`: Access revoked by office staff.

### InviteStatus
- `PENDING`: Sent, waiting.
- `ACCEPTED`: Invite consumed.
- `REVOKED`: Admin cancelled.
- `EXPIRED`: Time window closed.

### AuthTokenPurpose
- `INVITE`: Used for onboarding links.
- `MAGIC_LINK`: Used for passwordless portal entry.
- `PASSWORD_RESET`: Used for recovery.
- `EMAIL_VERIFY`: Used for identity confirmation.

### CredentialType
- `PASSWORD`: Argon2/bcrypt hash.
- `OAUTH_GOOGLE`: Google provider token reference (deferred).
- `OAUTH_MICROSOFT`: Microsoft provider token reference (deferred).

### AuthEventType
- `LOGIN_SUCCESS`: Successful authentication.
- `LOGIN_FAILURE`: Invalid credentials or blocked account.
- `PASSWORD_CHANGE`: User updated their password.
- `MFA_SETUP`: Configured TOTP.
- `INVITE_SENT`: New invite created.
- `INVITE_ACCEPTED`: Invite successfully consumed.

---

## 2. Shared Conventions

### Email Normalization
- All email addresses **must** be normalized to lowercase and trimmed before storage and comparison.
- `Prisma Client` should handle this via a dedicated helper service or middleware.

### Token Hashing Rules
- **Rule:** Never store raw authentication tokens in the database.
- **Implementation:** Store a SHA-256 (or better) hash of the token. The raw token is only sent to the client once (via email or response).
- **Lookup:** Query by `tokenHash` to verify.

### Session Token Storage
- **Internal:** Store in a secure, HTTP-only cookie (`__Host-session`).
- **Portal:** Store in a separate secure, HTTP-only cookie (`__Host-portal-session`).
- **CSRF:** Use `SameSite=Lax` or `Strict` as a baseline.

### ID Conventions
- All IDs use `CUID` strings for global uniqueness and URL-safety.
- Tenant isolation is enforced via mandatory `tenantId` fields on all non-global models.

### Timestamp Conventions
- Use `DateTime @default(now())` for `createdAt`.
- Use `DateTime @updatedAt` for `updatedAt`.
- All timestamps are UTC in the database.
