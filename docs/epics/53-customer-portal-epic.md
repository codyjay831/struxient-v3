# Epic 53 — Customer portal

## 1. Epic title

Customer portal

## 2. Purpose

Define **customer-facing portal** **shell**: **authentication** (magic link + optional password), **tenant branding**, **landing** after login, **visibility** of which **jobs/quotes** belong to **this** customer, and **PII** boundaries — supporting **O17** depth variants.

## 3. Why this exists

Customers must **review and sign** proposals (54) and may **submit structured inputs** (55) without accessing **internal** CRM objects (`02` FlowSpec not CRM).

## 4. Canon alignment

- **Portal** does **not** expose **execution package** internals or **catalog** editor (`06`).
- **AI** outputs not committed without human on **office side**; customer commits **their** entries under policy (`08-ai`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Customer user** | Access **assigned** quotes/jobs only. |
| **Office** | Invite portal users, reset access. |

## 6. Primary object(s) affected

- **PortalUser** (`customerId`, `email`, `authProvider`, `status`).
- **PortalSession** / magic link tokens.

## 7. Where it lives in the product

- **Subdomain** `tenant.struxient.app` or custom domain (60).
- Routes: `/portal`, `/portal/quotes`, `/portal/jobs`.

## 8. Create flow

1. Office sends **invite** email with **magic link** token (time-limited).
2. Customer sets **password** optional; **verify email** with code.
3. Lands on **dashboard** listing **open proposals** and **active projects** (limited fields).

## 9. Read / list / detail behavior

**Dashboard cards:** Quote **awaiting signature**, **project status** high-level (dates **intent** only — label per `01` if shown).

**Empty:** “No open items.”

## 10. Edit behavior

- Customer can update **profile** fields allowed (name display) — **not** billing identity without **verification** (policy).

## 11. Archive behavior

- **Deactivate** portal user; **cannot login**; historical signatures remain (`13`).

## 12. Delete behavior

- **GDPR delete** request workflow admin — out of scope detail; **must retain** **signature audit** references anonymized.

## 13. Restore behavior

- Reactivate portal user.

## 14. Required fields

`customerId`, `email`, `tenantId`.

## 15. Optional fields

`phoneMfa`, `locale`.

## 16. Field definitions and validations

- Rate limit magic link requests; **token** single-use.

## 17. Status / lifecycle rules

`invited` | `active` | `disabled`.

## 18. Search / filter / sort behavior

- Portal internal search **quotes** by # only.

## 19. Relationships to other objects

- **Customer**, **Quote versions** visible subset, **Job** status subset.

## 20. Permissions / visibility

- **Strict** row-level: **only** entities linked to **customerId**; **never** other customers’ data.

## 21. Mobile behavior

- **Responsive** portal required; **same** auth flows.

## 22. Notifications / side effects

- Email invites, password resets (56).

## 23. Audit / history requirements

- Login events, invite sends, **failed** auth.

## 24. Edge cases

- **Shared email** across two customers: **block** or **force** separate accounts — **default block** with message.

## 25. What must not happen

- **Leaking** internal notes (05) to portal.

## 26. Out of scope

- **White-label mobile app** separate from web.

## 27. Open questions

- **O7** canonical display address when customer vs site differs — portal **should** show **service address** from FlowGroup and **billing** separately labeled.
