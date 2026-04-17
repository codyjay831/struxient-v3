# Auth Relations and Boundaries

**Status:** Defined cardinalities and hard architectural boundaries.

---

## 1. Internal Staff Relations

### Account ↔ TenantMembership
- **Cardinality:** 1 : N
- **Description:** One global `Account` can have many `TenantMembership` records (e.g., a subcontractor working for multiple GCs).
- **Invariant:** A user can only belong to a tenant once (`accountId + tenantId` is unique).

### TenantMembership ↔ MembershipRole
- **Cardinality:** 1 : N
- **Description:** A membership can have one or more roles assigned (e.g., `OFFICE` + `ESTIMATOR`).
- **Settled Stance:** Roles are many-to-one per membership record.

---

## 2. Customer Portal Relations

### PortalAccount ↔ Contact
- **Cardinality:** 1 : 1
- **Description:** A `PortalAccount` is anchored to exactly one `Contact`.
- **Constraint:** One `Contact` can only have one `PortalAccount` per tenant.
- **Dependency:** If the `Contact` is deleted, the `PortalAccount` must be revoked/archived.

### Contact ↔ Customer
- **Cardinality:** N : 1
- **Description:** Multiple contacts can exist under one `Customer`. Each contact can potentially have its own `PortalAccount`.
- **Visibility:** Access is restricted to data linked to the parent `customerId`.

---

## 3. Hard Boundaries

### Internal Account vs. Portal Account
- **Model Separation:** An internal `Account` and a `PortalAccount` are distinct tables. 
- **Shared Email Behavior:** An email address can exist in the `Account` table (as staff) and the `PortalAccount` table (as a customer). These are separate login contexts.
- **Why:** Prevents accidental privilege escalation. A homeowner who is also an estimator at a different company should not see their home solar proposal in their work dashboard.

### Session Isolation
- **`InternalSession`** records only point to `AccountId` and `MembershipId`.
- **`PortalSession`** records only point to `PortalAccountId`.
- **No Overlap:** There is no "unified session" that allows a user to act as both staff and customer simultaneously via the same token.

---

## 4. Invariant Map

| Source | Target | Rule |
| :--- | :--- | :--- |
| `InternalSession` | `TenantMembership` | Session `tenantId` must match Membership `tenantId`. |
| `PortalAccount` | `Customer` | Must inherit `tenantId` from the anchored `Contact`. |
| `Invite` | `TenantMembership` | Creating a membership from an invite must validate email matching. |
| `AuthToken` | `Account` | Reset tokens must be linked to a valid `Account`. |
