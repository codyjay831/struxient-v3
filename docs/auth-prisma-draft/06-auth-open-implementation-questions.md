# Auth Open Implementation Questions

**Status:** Remaining technical questions for first auth implementation.

---

## 1. Resolved (Decision Fixed in Draft)

- **Unified Token Table?** YES.
- **Pending Membership Model?** NO. Pending state lives only on `Invite`.
- **Portal Uniqueness?** Strictly **one-per-Contact**.
- **Separate Session Tables?** YES.

---

## 2. Open Questions (Implementation-Scoping)

### Question A: Token Hashing Algorithm
- **Question:** Should `AuthToken.tokenHash` be a fast SHA-256 (for short-lived links) or a bcrypt-style "peppered" hash for sessions?
- **Implication:** SHA-256 is enough for magic links (sent via email), but session tokens (stored in cookies) may benefit from bcrypt-style "one-way" protection even against database leaks.
- **Current Recommendation:** Fast SHA-256 for all; tokens are single-use or high-entropy enough.

### Question B: Session Expiration Mechanism
- **Question:** Use a background "cron" job or "on-read" cleanup for expired sessions?
- **Implication:** On-read cleanup (e.g., `DELETE WHERE expiresAt < now()` on every login) is easier but adds latency. A separate worker is cleaner but adds infrastructure.
- **Current Recommendation:** On-read cleanup for Slice 1.

### Question C: Audit Log Retention
- **Question:** How long to keep `AuthAuditEvent` rows before archiving?
- **Implication:** Auth logs can grow fast.
- **Current Recommendation:** No cleanup policy defined yet. Keep all for Slice 1.

### Question D: Multi-Contact Portal Choice
- **Question:** If two contacts for the same `Customer` have the same email address, do they both receive an invite?
- **Implication:** The magic link must target a specific `contactId`. If the emails are identical, the user might get two identical-looking emails and not know which is which.
- **Current Recommendation:** Enforce unique email per `Customer` for portal users if possible, or include "Contact Name" in the invite email to differentiate.

---

## 3. Deferred (Slice 2+)

- **MFA Recovery Codes:** Not in Slice 1.
- **OAuth Provider Management:** Schema has enums, but no implementation logic is planned for now.
- **Session "Device Name" detection:** Placeholder `userAgent` is enough.
