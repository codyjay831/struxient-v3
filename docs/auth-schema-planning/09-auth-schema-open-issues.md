# Auth Schema Open Issues

**Status:** Minor unresolved questions for the first auth schema pass.

---

## 1. Resolved (Closed)

| Issue | Resolution |
| :--- | :--- |
| **Unified User Model?** | **NO.** Internal `Account` and `PortalAccount` are separate tables. |
| **Magic Link for Staff?** | **NO.** Staff use standard passwords; portal users use magic links. |
| **Global Profile?** | **YES.** `Account` owns the global profile (name, avatar, etc.). |

---

## 2. Open Issues (Small/Specific)

### Issue A: `InternalSession` + `TenantMembership` Join
- **Question:** Should `InternalSession` carry a copy of `tenantId` to avoid a join to `TenantMembership` for every query?
- **Implication:** If `YES`, we need a sync mechanism if a user changes tenants. If `NO`, every authorized request requires an extra join.
- **Current Recommendation:** Carry `tenantId` in the session record for performance.

### Issue B: `PortalAccount` for Multiple Contacts
- **Question:** If two contacts have the same email under one `Customer`, should they have separate `PortalAccount` records?
- **Implication:** If `YES`, the magic link needs to choose which contact to act as. If `NO`, we must decide which `Contact` "owns" the portal identity.
- **Current Recommendation:** One `PortalAccount` per email per customer (effectively collapsing the identity if emails match).

### Issue C: Audit Log Integration
- **Question:** Use a dedicated `AuthAuditEvent` table or the generic `AuditEvent` table?
- **Implication:** `AuthAuditEvent` is easier to query for security monitoring. Generic `AuditEvent` is easier for a unified timeline.
- **Current Recommendation:** Start with a dedicated `AuthAuditEvent` table for security-critical events (logins, failures, password resets).

---

## 3. Deferred (Slice 2+)

- **SSO/OAuth Support:** Schema placeholders only.
- **MFA Enforcement Policy:** Settings-based later.
- **Device Fingerprinting:** Out of scope.
