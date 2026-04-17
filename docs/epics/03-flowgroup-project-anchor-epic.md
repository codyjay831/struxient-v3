# Epic 03 — FlowGroup / project anchor

## 1. Epic title

FlowGroup (project / site anchor)

## 2. Purpose

Define the **FlowGroup** as the **project and site anchor** that groups quotes, job shell, and execution context for **one logical install or engagement** at a **place** under a **customer**. It is the structural prerequisite for **packaged activation** (quote requires `flowGroupId` in v2 evidence; v3 preserves the **one logical project** concept).

## 3. Why this exists

Contractors sell and execute work at **sites**. Multiple quotes, change orders, and a single job narrative attach to **one anchor** so reporting, payment gates (`jobId` / flow scoping), and field crews see **one project**. Without FlowGroup, quotes float without site context and activation cannot bind execution cleanly.

## 4. Canon alignment

- **`03-quote-to-execution`:** Flow group ties quote versions to **site** and **job** policy.
- **`04-job-anchor-timing-decision`:** Job ensured by **sign** default; FlowGroup is the **stable** grouping for that job; **activation never duplicates job** for same FlowGroup.
- **`02-core-primitives`:** FlowGroup is **not** scope packet, not line item, not runtime task.
- **O7:** Duplicated identity fields vs customer — **display rule** may remain split until O7 closes; epic states behavior explicitly.

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Admin** | Create, edit, archive, restore, reassign customer link (dangerous — audited). |
| **Office** | Create when starting quote or converting lead; edit site fields; archive if policy allows. |
| **Estimator** | Select existing FlowGroup or create inline during quote setup. |
| **Field** | Read site address and access instructions on job context. |
| **Customer** | Portal may show **project nickname** and **service address** (epic 53–54). |

## 6. Primary object(s) affected

- **FlowGroup**
- **Customer** (required parent)
- **PreJobTask** (site surveys, utility checks — anchored here before quote/sign)
- **Quote**, **Job** (downstream)

## 7. Where it lives in the product

- **Customer detail:** Tab **Projects / Sites** listing FlowGroups.
- **Quote create:** Step “Project & site” — select or create FlowGroup.
- **Job / execution:** Header shows FlowGroup **nickname** + address.
- **Routes:** `/customers/:id/projects`, `/projects/:flowGroupId` (if top-level route used).

## 8. Create flow

1. From quote wizard or customer detail: **New project**.
2. Required: `customerId`, **service site address** (at minimum `line1` + `city` + `state` + `postalCode` per tenant locale rules) OR tenant allows **address TBD** flag with **follow-up required** badge.
3. Optional: `nickname` (e.g. “Smith — Main Service Upgrade”), `accessNotes`, `latitude`/`longitude` (map pin).
4. Save → `createdAt`, audit **flowGroup.created**.
5. Redirect to FlowGroup detail or back to quote with selection.

**Address TBD:** If tenant allows, `addressCompleteness = incomplete`; quote **send** may be blocked until complete (tenant policy) — cross-ref epic 11/12.

## 9. Read / list / detail behavior

**List (under customer):** Nickname, service city/state, **active quote** badge, **job status** if job exists, `updatedAt`. Sort default: `updatedAt` desc.

**Filters:** Has active quote, has signed quote, has activated job.

**Search:** Nickname, address line1, city — substring.

**Detail:** Map preview (if coords), full address, access notes, linked quotes (versions summarized), job link, files (epic 06), notes (epic 05).

**Empty:** “No projects for this customer” + **New project**.

## 10. Edit behavior

- Address and notes editable; changing **customerId** is **admin-only** with strong confirm (risk of mis-attribution).
- **Concurrency:** last-write-wins.

## 11. Archive behavior

- Archive hides from **new quote** pickers; existing quotes keep reference.
- **Cannot archive** if **active flow** with incomplete closeout (tenant rule) — configurable; default **warn** only.

## 12. Delete behavior

- **No hard delete** if any quote exists; **admin** may hard delete **only** FlowGroup with **zero** quotes and **zero** jobs (rare cleanup).

## 13. Restore behavior

- Admin restores archived FlowGroup; returns to pickers.

## 14. Required fields

| Field | Type | Why |
|-------|------|-----|
| `customerId` | FK | Every project belongs to a customer. |
| `serviceSite` | structured address OR `addressTbd=true` with policy | Execution and proposals need a place; TBD path explicit. |

## 15. Optional fields

`nickname`, `accessNotes`, `geo`, `timezone` (override company default for scheduling display), `externalIds` (CRM).

## 16. Field definitions and validations

- Address fields: same validation as customer address; international state as free text.
- `nickname`: max 200 chars.
- **Geo:** optional; validate lat/long range.

## 17. Status / lifecycle rules

| Value | Meaning |
|-------|---------|
| `active` | Normal. |
| `archived` | No new quotes default. |

Optional future: `onHold` for commercial pause — out of scope unless merged with holds epic.

## 18. Search / filter / sort behavior

See §9. Global search (epic 58) should index FlowGroup nickname + address + customer name.

## 19. Relationships to other objects

- **Customer 1—* FlowGroup**
- **FlowGroup 1—* Quote** (over time)
- **FlowGroup 1—* PreJobTask** (site surveys, utility checks, feasibility work — completed before quoting; historical evidence survives after activation)
- **FlowGroup 1—1 Job** (business anchor per decision `04` — **one job** per flow group for default trade wedge; multi-flow O2 deferred)

## 20. Permissions / visibility

- Same tenant as customer.
- Field users see FlowGroups only for **assigned jobs**.

## 21. Mobile behavior

- Read-only detail with **directions** link (maps app).
- Photo capture for site (files epic).

## 22. Notifications / side effects

- Webhook on create/update when integrations enabled.

## 23. Audit / history requirements

Log create, address changes, customer reassignment, archive, restore.

## 24. Edge cases

- **Customer moved** (wrong project under wrong customer): admin-only relink + audit.
- **Duplicate projects** same address: allowed; warn **possible duplicate**.

## 25. What must not happen

- **Second Job** for same FlowGroup on packaged path (decision `04`).
- Using FlowGroup as **scope packet** or **workflow**.
- Creating a **Job** just to track a site survey or pre-job work (use `PreJobTask` instead).

## 26. Out of scope

- **Multi-flow fan-out** (O2).
- **InstallItem** (O4) optional anchors.

## 27. Open questions

- **O7:** Which fields are **canonical** for portal display when customer billing address differs from site — coordinate with epic 02 and 53.
