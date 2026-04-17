# Custom vs. Outsourced Auth Responsibility

**Purpose:** Draw a clear line between what Struxient owns conceptually (product identity) and what should use proven security primitives (low-level implementation).

---

## 1. What Struxient Conceptually Owns

Struxient owns the **meaning and relationship** of an identity to the trade-first quote-to-execution domain.

| Struxient Owns (Conceptual) | Why |
| :--- | :--- |
| **Account/Member Mapping** | The relationship between a person and multiple companies is a core v3 feature. |
| **Role/Permission Registry** | The specific permissions like `quote.send` or `task.execute` are unique to Struxient's engine. |
| **Portal Identity Anchor** | Linking a login to a CRM `Contact` and `Customer` is deeply tied to the data model. |
| **Invite & Onboarding UX** | The friction-free onboarding of field crews and homeowners is a product differentiator. |
| **Impersonation Logic** | How support staff interacts with client data requires custom audit and constraints. |

---

## 2. What Struxient Does NOT Reinvent

Struxient should use **proven security primitives and libraries** for the underlying mechanics.

| Proven Primitives (Outsourced/Library) | Recommended Approach |
| :--- | :--- |
| **Password Hashing** | Use Argon2 or bcrypt via a trusted library. Never write a custom hashing algorithm. |
| **Session Token Issuance** | Use JWT (for stateless parts) or Secure HTTP-only Cookie sessions managed by a stable framework (e.g., Lucia, NextAuth, or iron-session). |
| **Magic Link Generation** | Use high-entropy, short-lived tokens stored in a cache or DB with standardized email delivery. |
| **MFA Engines** | Use standard TOTP (Google Authenticator) or SMS providers (Twilio). |
| **OAuth/SSO Handshakes** | Use standard libraries for Google/Microsoft login handshakes rather than raw protocol implementation. |

---

## 3. The "No Clerk" Policy

The decision to not use Clerk is a decision to **own the data and the logic**, not a decision to **invent the crypto**.

**What to do:**
-   Model the `Account` and `Membership` tables in the Struxient schema.
-   Implement the business logic for "Can this user do X in tenant Y?"
-   Store session records in the Struxient database for easy revocation and audit.

**What not to do:**
-   Try to build a custom "Identity Provider" service that handles the raw protocol level if a library already exists.
-   Casually store plain-text or poorly hashed passwords "just for MVP."
-   Assume that "owning the accounts" means building a custom UI for every possible auth edge case (e.g., use standard components for login forms).

---

## Summary Stance

Struxient owns the **Account Records** and **Membership Truth**.
Struxient uses **Industry-Standard Libraries** for **Session Security** and **Credential Hashing**.
