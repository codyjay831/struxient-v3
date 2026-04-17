# Auth Schema Planning Summary

**Status:** Final summary of the auth schema-planning artifact set.

---

## 1. Internal Staff Model
Struxient will use a **Global Account Identity + Tenant Membership** model.
- `Account` records are unique by email globally.
- `TenantMembership` records define the user's relationship to a specific company/tenant.
- Permissions are assigned to `MembershipRole` records, ensuring multi-tenant isolation.
- `InternalSession` records are linked to both an `Account` and a `Membership`.

## 2. Customer Portal Model
The portal uses a **Separate Portal Account** model, anchored to the CRM `Contact`.
- Identity is separate from staff. No `Account` rows are created for homeowners.
- Magic-link-first authentication is the primary login method.
- `PortalSession` records are anchored to a `PortalAccount` and its parent `Customer`.
- Row-level security is enforced via `customerId` derived from the session.

## 3. Core Entities for First Migration
The following entities must be defined in the first auth/schema pass:
1.  **`Account`** (Global Identity)
2.  **`AccountCredential`** (Password secrets)
3.  **`TenantMembership`** (Linkage to Tenant)
4.  **`MembershipRole`** (RBAC assignment)
5.  **`InternalSession`** (Staff session)
6.  **`PortalAccount`** (Homeowner auth)
7.  **`PortalSession`** (Homeowner session)
8.  **`AuthToken`** (Unified magic link/reset/verify table)
9.  **`Invite`** (Onboarding management)

## 4. Key Invariants
- **Email Uniqueness:** Global for staff, scoped to `Customer` for portal users.
- **Session Integrity:** `tenantId` and `customerId` must be derived from the session record, never from the client.
- **Isolation:** Staff and portal auth/sessions must remain in separate tables to prevent privilege escalation.

---

## 5. Readiness for Prisma Drafting
The project is now **READY** for the first Prisma schema draft. The entity relationships, field lists, and unique constraints are defined clearly enough for implementation.

---

## “Recommended next step”

### **Prisma/auth schema draft**

**Why:** With the schema-planning pack complete, the next logical step is to write the actual `schema.prisma` definitions for these entities. This will enable the first migration and provide the types necessary for implementing the authentication logic.
