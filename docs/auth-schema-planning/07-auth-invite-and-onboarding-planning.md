# Auth Invite and Onboarding Planning

**Status:** Data requirements for the onboarding lifecycle.

---

## 1. Internal Invite Flow

### Data Captured at Creation
When an admin invites a staff member:
- `email`: Required (lowercase).
- `tenantId`: Derived from the admin session.
- `targetRoles`: List of roles to grant upon acceptance.
- `metadata`: Optional (e.g., first/last name hint).

### Acceptance Mechanics
1. User clicks the link containing the `InviteToken`.
2. System checks if an `Account` already exists for that email.
3. **If NO Account:** User is prompted for `name` and `password`. System creates `Account`, `AccountCredential`, and `TenantMembership`.
4. **If Account EXISTS:** User is prompted to log in. System creates `TenantMembership` linked to the existing `Account`.

---

## 2. Customer Portal Invite Flow

### Data Captured at Creation
When office staff invites a homeowner:
- `contactId`: The specific CRM contact being granted access.
- `customerId`: Derived from the contact.
- `tenantId`: Derived from the staff session.

### Acceptance Mechanics
1. User clicks the magic link.
2. System creates/activates the `PortalAccount` for that `contactId`.
3. System transitions the user directly to the portal dashboard.

---

## 3. Re-send and Expiry Behavior

- **Re-send:** Invalidates the previous token and issues a new one. Does not create a duplicate `Invite` record (updates existing).
- **Expiry:** If a user clicks an expired link, the system shows "Invite expired" with a "Request new link" option (if policy allows).

---

## 4. Existing Email Behavior

| Scenario | Logic |
| :--- | :--- |
| **New Invite for Existing Account** | Allow. Just adds another `TenantMembership`. |
| **Portal Invite for Email with Staff Account** | Allow. These are separate tables and login contexts. |
| **Duplicate Pending Invite** | Reject. Update the existing invite instead. |
