# Epic 02 — Customers

## 1. Epic title

Customers

## 2. Purpose

Define the **customer** record in Struxient v3: the durable **party** (person or organization) that contracts for work, receives proposals, and is the anchor for billing and portal identity. Customers are distinct from **leads** (pre-sale), **quotes** (commercial documents), and **jobs** (business anchor tied to flow group per decision `04`).

## 3. Why this exists

Quotes, signatures, payment, and reporting require a stable **who we are doing business with**. Without a first-class customer object, contact data fragments across leads and quote headers; integrations (CRM, accounting) lack a consistent id. Customers centralize legal/display identity while **commercial truth** remains on **quote line items** (`02-core-primitives`).

## 4. Canon alignment

- **`02-core-primitives`:** Customer is **not** the owner of sold price (line items) or runtime execution.
- **`03-quote-to-execution`:** Quotes reference customer context; sign authorizes frozen proposal for that relationship.
- **`10-open-canon-decisions` O7:** Canonical source between **FlowGroup** site fields and **Customer** may still be coordinated; this epic defines **customer-owned** fields and states **display merge rules** under open questions where O7 is unresolved.
- **`09-banned-v2-drift`:** Customer must not collapse into **quote version**, **job**, or **lead**.

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Admin** | Full CRUD, archive, restore, merge assistance (if product ships merge), export, audit. |
| **Office / sales** | Create, view, edit customers they can see; archive (tenant policy); no hard delete unless admin. |
| **Estimator** | View and select customer on quote; create customer inline on quote if permitted. |
| **Field user** | View customer name and site contact on assigned job context; no edit unless tenant extends. |
| **Customer (portal)** | See **their own** customer profile subset (name, contact methods the company exposes); cannot see other customers. |

## 6. Primary object(s) affected

- **Customer** (tenant-scoped).
- **Contact**, **ContactMethod** (epic 04).
- **Lead** (conversion link from epic 01).
- **FlowGroup** / **Quote** (foreign keys).

## 7. Where it lives in the product

- **Nav:** Top-level **Customers** (or under **CRM** hub label — product chrome choice; must be reachable in ≤2 clicks from home).
- **Routes:** `/customers`, `/customers/:id`.
- **Embedded:** Customer picker on quote create; customer summary chip on quote header.
- **Mobile:** Customers list (read-heavy), customer detail; create/edit if tenant enables **mobile CRM**.

## 8. Create flow

1. User opens **New Customer** from customer list or **Add customer** from quote flow.
2. Form collects required fields (§14); optional fields (§15).
3. **Duplicate check** on email OR phone OR (legal name + billing zip) — **warn**, allow proceed (same policy as leads).
4. Save → customer `status = active`, `createdAt` set; audit entry **customer.created**.
5. Redirect to customer detail; toast **Customer created**.
6. If created from quote wizard, return to quote with **customerId** pre-filled.

**Partial create:** Minimum is **display name** OR (**firstName** or **lastName**) plus **customer type** (`person` | `organization`). Billing address optional at create.

## 9. Read / list / detail behavior

**List columns:** Display name, type, primary email, primary phone, city/state, **active quote count** (optional column), **open job count** (optional), `updatedAt`. Default sort: `displayName` ascending. Pagination: 25/50/100.

**Filters:** Type, tag, has portal access, created date range, **has open job**, **has unsigned quote**.

**Search:** `displayName`, `companyName`, `firstName`, `lastName`, primary email, primary phone — substring, case-insensitive, min 2 chars.

**Empty state:** “No customers yet” + **New Customer** + link to import doc if import exists (out of scope here).

**Detail sections:** Header (name, type, tags); **Contact methods** (epic 04); **Addresses** (billing, service site default pointer); **Related flow groups / jobs** (links); **Related quotes** (list); **Notes** (epic 05); **Files** (epic 06); **Activity** (audit feed).

**Actions:** Edit, Archive, **Open quote**, **View jobs**; Admin: Delete (guarded).

## 10. Edit behavior

- All non-system fields editable except **immutable ids** and **createdAt** / **createdBy**.
- Changing **displayName** does not retroactively rewrite **frozen quote PDF text** — frozen artifacts unchanged; **current** quote header may show new display name per product rule: **default:** draft quotes pick up new name; **sent/signed** quote versions show **snapshot** customer copy (see epic 08).
- **Concurrency:** last-write-wins for MVP.

## 11. Archive behavior

- **Archive** sets `status = archived`, `archivedAt`, `archivedBy`; hides from default list and pickers **unless** “Include archived” filter on.
- **Cannot archive** if tenant policy blocks when **open signed quote awaiting activation** — product rule: **warn** and require user to complete or void quote first (exact void epic 14).
- **Does not cascade** to quotes/jobs; those remain navigable.

## 12. Delete behavior

- **Hard delete: admin only**, and only when **no** quotes, **no** jobs, **no** payment records reference customer.
- Confirmation: type customer display name.
- If blocked, UI explains **Archive** instead.

## 13. Restore behavior

- **Admin** restores archived customer: clears archive fields, `status = active`, audit **customer.restored**.

## 14. Required fields

| Field | Type | Why |
|-------|------|-----|
| `customerType` | enum: `person`, `organization` | Drives form and legal display. |
| Identity | One of: non-empty `displayName`, or `firstName` and/or `lastName`, or `organizationName` (required when type=organization) | Must be addressable in UI and documents. |

## 15. Optional fields

`organizationName` (for person-type DBA), `billingAddress` (structured), `taxId` (encrypted at rest policy), `portalEmail` (login identifier), `tags[]`, `notesSummary` (deprecated if notes epic used), `preferredLanguage`, `marketingOptIn`.

## 16. Field definitions and validations

- **Email:** RFC 5322 simplified; max 254; stored lowercased.
- **Phone:** max 30; normalize digits for duplicate check.
- **Names:** max 100 each; unicode allowed.
- **TaxId:** tenant-configurable required for commercial jobs.
- **Tags:** max 50 tags, 50 chars each, trimmed, deduped lowercased.

## 17. Status / lifecycle rules

| Status | Meaning |
|--------|---------|
| `active` | Normal use. |
| `archived` | Hidden from default pickers; historical reference only. |

Transitions: `active` ↔ `archived` (restore). No other statuses required at MVP.

## 18. Search / filter / sort behavior

Covered in §9. Default filter: **active only**. Sort options: name, updated desc, created desc.

## 19. Relationships to other objects

- **Customer 1—* FlowGroup** (typically many sites/projects per customer over time).
- **Customer 1—* Quote** (quotes belong to customer context).
- **Customer 0—1 Lead** (optional back-link after conversion from lead).
- **Customer 1—* Contact** (epic 04).

On delete block: any quote or job reference prevents delete.

## 20. Permissions / visibility

- **Tenant isolation:** customers never cross tenants.
- **Office:** full list within tenant unless row-level rules added later (out of scope).
- **Field:** job-scoped read of customer **display** fields only on assigned work.
- **Portal customer:** only self customer record.

## 21. Mobile behavior

- List + detail + **quick call/email** actions on primary methods.
- Create/edit if enabled; otherwise read-only.
- Offline: read cached detail only if app supports offline (optional); no offline create without sync strategy (defer to mobile epic 43).

## 22. Notifications / side effects

- Webhook `customer.created` / `customer.updated` / `customer.archived` if integrations enabled.
- No email to customer on internal edit unless **portal invite** flow (epic 53).

## 23. Audit / history requirements

Log create, field changes (PII fields masked in export per policy), archive, restore, delete. Visible on customer detail **Activity** tab and global audit (epic 57).

## 24. Edge cases

- **Duplicate customers:** warn on create; no auto-merge in MVP.
- **Customer type change** org→person: require validation that `organizationName` not required.
- **Portal email collision** across customers: block second use with clear error.

## 25. What must not happen

- Using **customer** row as **line item pricing** store.
- **Silent delete** with orphaned quotes.
- **Collapsed vocabulary** with **lead** or **job**.

## 26. Out of scope

- Full **accounting** subledger, credit limits, collections workflows.
- **Customer merge** UI (optional future epic).
- **Multi-tenant** reseller hierarchies.

## 27. Open questions

- **O7 resolution:** Whether **service site address** on FlowGroup overrides customer default for **portal** display — needs single rule with epic 03.
- **Quote snapshot** of customer: exact copy fields on send — specified in epic 08; align when implementing.
