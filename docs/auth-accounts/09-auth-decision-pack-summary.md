# Auth Decision Pack Summary

**Purpose:** Provide a one-page summary of the auth/accounts architecture for Struxient v3.

---

## 1. Executive Summary

Struxient v3 will move away from hosted identity providers (like Clerk) to an **Owned Identity Architecture**. This model provides the necessary control for multi-tenant staff management and homeowner portal access, while maintaining security through the use of industry-standard libraries.

---

## 2. The Internal Model: Identity + Membership
-   **Structure:** A global `Account` (Identity) linked to 1-to-N `TenantMembership` records (Authorization).
-   **Benefit:** Allows users to work across multiple companies with one login.
-   **Security:** Global account suspension immediately revokes all access.

## 3. The Portal Model: Contact-Anchored
-   **Structure:** Dedicated `PortalAccount` records tied to CRM `Contacts`.
-   **Auth:** Magic-link primary login for a frictionless homeowner experience.
-   **Isolation:** Strict row-level filtering based on `customerId` embedded in the portal session.

## 4. Key Security Stance
-   **Logic Ownership:** Struxient owns the "Who can do what" logic.
-   **Implementation Outsourcing:** Low-level tasks like password hashing, session tokens, and magic links are handled by proven libraries, not custom-invented logic.
-   **Invite-Only:** Onboarding is strictly invite-driven for the initial v3 phase.

---

## Conclusion

The project is now ready for **Auth Schema Planning**. The conceptual boundaries between internal staff and customer portal users are fixed, and the multi-tenant membership relationship is clearly defined.

---

## Recommended next step

**Auth Schema Planning.**

**Why:** With the architectural decisions closed, the next step is to define the exact relational schema (PostgreSQL/Prisma) for the `Account`, `Membership`, and `Session` entities. This schema will form the foundation for all subsequent feature implementations.
