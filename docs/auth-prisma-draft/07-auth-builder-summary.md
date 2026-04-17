# Auth Builder Summary

**Status:** Implementation-facing handoff for auth schema and initial coding.

---

## 1. What to Code First (The "Auth Core")
The following must exist before any other features can be fully implemented:

1.  **Model Migrations:** Apply `schema.prisma` with the auth models.
2.  **Auth Service:** Create a centralized service (e.g., `auth.service.ts`) to handle:
    - Account creation/lookups.
    - Password hashing (Argon2/bcrypt).
    - Session issuance and token hashing.
3.  **Onboarding Middleware:** Logic to consume `Invite` records and create memberships.
4.  **Session Middleware:** Logic to extract `tokenHash` from cookies and verify sessions.

---

## 2. What Not to Code Yet (Deferred)
Avoid building these in Slice 1:

- **SSO/OAuth Flow:** Focus on email/password first.
- **MFA Recovery:** Only basic TOTP setup if needed.
- **Complex RBAC Inheritance:** Keep roles simple and flat (`ADMIN`, `OFFICE`, etc.).

---

## 3. Minimum Acceptance Tests for Auth Schema
A successful auth schema implementation must pass these tests:

- [ ] **Email Uniqueness:** Attempting to create a second `Account` with the same email fails.
- [ ] **Tenant Isolation:** A session from Tenant A cannot access rows in Tenant B.
- [ ] **Portal Isolation:** A portal session cannot access staff endpoints.
- [ ] **Token Single-Use:** A magic link token is invalidated immediately after use.
- [ ] **Cascade Delete:** Deleting a `Contact` automatically deletes its `PortalAccount`.

---

## 4. Most Dangerous Mistakes to Avoid

1.  **Storing Raw Tokens:** Never store a session or invite token in the DB without hashing it.
2.  **Trusting Client IDs:** Never trust a `tenantId` sent in a request body; always derive it from the `InternalSession`.
3.  **Conflating Staff and Portal:** Never reuse a staff `InternalSession` table for homeowner portal access.
4.  **Leaking Password Hashes:** Ensure the `AccountCredential` table is never returned in a standard "User" API response.
5.  **Skipping Email Normalization:** Failing to lowercase emails during both storage and lookup will lead to duplicate accounts and login failures.

---

## “If the auth implementation goes wrong, it will likely go wrong in these 5 ways”

1.  **Tenant Leakage:** A developer forgets to add the `tenantId` filter to a new API endpoint, allowing cross-tenant data access.
2.  **Stale Sessions:** A user's password is changed or their membership is deactivated, but their existing sessions remain valid because they weren't explicitly revoked.
3.  **Magic Link Spoofing:** Using low-entropy tokens or failing to hash them, allowing an attacker to guess a valid portal link.
4.  **Identity Confusion:** A user who is both a staff member and a homeowner gets logged into the wrong dashboard because the session lookup logic is too generic.
5.  **Broken Inverse Relations:** Failing to update the `PortalAccount.status` when the parent `Contact` or `Customer` changes, leaving "zombie" portal access alive.
