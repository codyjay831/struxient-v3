# Auth Open Questions

**Purpose:** Track truly unresolved auth and account questions that materially affect schema or implementation planning.

---

## 1. Multiple Contact Portal Access
**Question:** If multiple contacts under one customer have portal access, do they see a shared dashboard of all quotes for that customer, or only quotes they were the primary contact for?
**Context:** Current `PortalAccount` is anchored to a `Contact`, but visibility is usually `customerId`.
**Impact:** Affects portal API query design.

## 2. Global Account creation without Invite
**Question:** Should Struxient allow "public" account creation (sign up for a global account without being invited to a tenant)?
**Recommendation:** No. Keep it invite-only for MVP. Global accounts are created only during the first tenant invite acceptance.
**Impact:** Simplifies onboarding logic.

## 3. Subcontractor Membership
**Question:** How should a person who is an employee of "Company A" (a sub) but has been granted "Field" role in "Company B" (the GC) be modeled?
**Current Stance:** The model supports this via multiple `TenantMembership` records. However, the UX for "Switching Context" while in the field needs a spike.
**Impact:** UX and mobile navigation.

## 4. Phone-first Portal Login
**Question:** Should homeowners be able to log in via SMS Magic Link instead of Email?
**Context:** `Epic 04` defines phone numbers as contact methods.
**Impact:** Requires SMS provider integration (Twilio) and additional `SmsToken` entity.
