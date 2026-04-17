# Epic 04 — Contacts and contact methods

## 1. Epic title

Contacts and contact methods

## 2. Purpose

Define **contacts** (people roles) and **contact methods** (phone, email, etc.) attached to **customers**, **FlowGroups**, and optionally **leads**, so quoting, portal invites, and field communication use **explicit** channels instead of duplicating strings on every document.

## 3. Why this exists

Jobs have **site superintendents**, **billing contacts**, and **homeowners**. Storing one email on the customer conflates roles. Normalized contacts support **portal login**, **SMS**, and **audit** of who was notified.

## 4. Canon alignment

- Supports **O7** by allowing **role-tagged** methods without claiming canon resolution.
- Does **not** own **commercial truth** (quotes) or **execution truth**.

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Admin / office** | CRUD contacts and methods on customers and projects. |
| **Estimator** | Select **primary proposal recipient** from contacts on send (epic 12). |
| **Field** | View **site contact** on job. |
| **Customer** | Manage own profile methods in portal if allowed (epic 53). |

## 6. Primary object(s) affected

- **Contact** (person record scoped to parent).
- **ContactMethod** (0—* per contact: type, value, flags).

## 7. Where it lives in the product

- **Customer detail** → **Contacts** tab.
- **FlowGroup detail** → **Site contacts** section (may **reference** customer contact or create **project-local** contact).
- **Lead detail** (epic 01) → mirror of contact fields or linked contacts when lead converts.

## 8. Create flow

**Contact:**  
1. **Add contact** on parent.  
2. Required: `displayName` OR (`firstName` and/or `lastName`).  
3. Optional: `role` enum (`billing`, `site`, `owner`, `other`), `isPrimaryForRole` per role category.  
4. Save → contact id; user may **add methods** inline.

**Contact method:**  
1. Pick type: `email`, `mobile`, `phone`, `fax`, `portal_username` (if distinct).  
2. Value per type validation.  
3. Flags: `isPrimary`, `okToSms`, `okToEmail`.  
4. Save → audit **contactMethod.created**.

## 9. Read / list / detail behavior

**List:** Table of contacts with name, role badges, primary email, primary phone, **portal status** (invited/active).

**Detail drawer:** Methods list with verify badges (email verified / unverified).

**Empty:** “No contacts — add a billing or site contact.”

## 10. Edit behavior

- Edit name, role, flags; **primary** uniqueness: **one primary email per parent**; setting new primary clears old.
- Methods: edit value with re-validation; **history** of value change for compliance (optional retained prior in audit).

## 11. Archive behavior

- **Soft-archive contact** hides from pickers; keeps historical quote snapshot references.
- Methods archive with contact.

## 12. Delete behavior

- Delete contact only if **not referenced** as **signer** on immutable quote version; else archive-only. Admin override with **break glass** + audit (product policy).

## 13. Restore behavior

- Restore archived contact; methods return.

## 14. Required fields

| Object | Field | Why |
|--------|-------|-----|
| Contact | Identity as in §8 | Addressable person. |
| ContactMethod | `type`, `value` | Method has no meaning without both. |

## 15. Optional fields

`title`, `notes`, `timezone`, `photoUrl` (files epic link).

## 16. Field definitions and validations

- Email: RFC simplified, max 254, lowercase.
- Phone: E.164 storage recommended; display formatting locale-aware.
- **Duplicate method value** on same parent: **warn**, allow (shared phone in household).

## 17. Status / lifecycle rules

Contact: `active` | `archived`.  
Method: `active` | `archived` | `bounced` (email delivery flag, optional).

## 18. Search / filter / sort behavior

Search contacts by name, email, phone within **parent** context. Filter by role. Sort by name.

## 19. Relationships to other objects

- **Contact** belongs to **Customer** and/or **FlowGroup** (cardinality: implement as `parentType` + `parentId` OR separate join tables — **implementation**; behavior: **must not** duplicate same person as two records without **link** if product adds linking later).

## 20. Permissions / visibility

- Office: full within tenant.
- Field: **site contacts** on assigned jobs only.
- Portal: customer sees contacts **they are allowed** to see (usually self + co-owner).

## 21. Mobile behavior

- Tap-to-call, tap-to-email on methods.
- Add **site contact** quick action for crew with permission (tenant flag).

## 22. Notifications / side effects

- Adding **portal email** may trigger invite (epic 53).
- SMS opt-in flags must be respected (compliance).

## 23. Audit / history requirements

Log contact/method CRUD, primary changes, portal invite sends.

## 24. Edge cases

- **Two primaries:** enforce single primary per type per parent transactionally.
- **Signer contact deleted** after sign: immutable snapshot retains copy on quote version (epic 08).

## 25. What must not happen

- Using **unverified** email as sole proof of identity for **payment** without extra auth.
- **Collapsed** contact into **customer.displayName** only for **signed** documents — snapshot required.

## 26. Out of scope

- Full **marketing automation** list management.
- **LDAP / SCIM** directory sync.

## 27. Open questions

- **Project-local vs customer-shared contacts:** default **copy-on-convert** from lead vs **reference** — product choice; document when implementing quote wizard.
