# Epic 60 — Admin settings and tenant configuration

## 1. Epic title

Admin settings and tenant configuration

## 2. Purpose

Define **company/tenant** settings: **branding**, **IDs**, **defaults** (`createJobOnSign` per `04`), **feature flags** (`enforceCommittedScheduleBlocks` future per `01`), **limits** (file upload, AI), **localization**, **tax display**, **note redaction policy** (05), **HoldType** subset (`29`, `O9`), **integration** webhooks, **security** (MFA policy) — the **control plane** for other epics.

## 3. Why this exists

**Distributed** defaults across code constants recreate **v2** drift; **one** **settings** contract enables **support** and **enterprise** deals.

## 4. Canon alignment

- Settings **cannot** override **canon** (e.g., cannot enable **workflow-first** mode flag — **banned**); only **policy within** canon.
- **AI** flags respect `08-ai` **commit walls** even if “enabled.”

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Admin** | Edit **tenant** settings. |
| **Owner** | Billing, plan limits. |

## 6. Primary object(s) affected

- **TenantSettings** key-value with **typed** schema per key; **SettingsRevision** optional.

## 7. Where it lives in the product

- `/settings/company`, `/settings/security`, `/settings/integrations`, `/settings/features`.

## 8. Create flow

- **Tenant provisioning** seeds defaults; **import** settings JSON **admin** only.

## 9. Read / list / detail behavior

- Grouped **forms** with **inline** validation; **preview** branding on portal.

## 10. Edit behavior

- **Save** per section; **danger zone** for **destructive** changes requires **typing** tenant slug.

## 11. Archive behavior

- **Settings history** optional — store last **10** revisions.

## 12. Delete behavior

- **Reset to defaults** per section with **confirm**.

## 13. Restore behavior

- **Restore** from revision if enabled.

## 14. Required fields

`tenantId`, `companyLegalName`, `planningTimeZone` (`01`).

## 15. Optional fields

100+ keys — **minimum** documented set:
- `createJobOnSign` boolean (`04`)
- `maxUploadMb`, `allowedMimeTypes` (`06`)
- `aiFeaturesEnabled` map (`08`, `O14`)
- `holdTypesEnabled[]` (`O9`)
- `portal.customerStructuredInputs` policy (`O17` bridge)
- `jobNumberPrefix`, `quoteNumberPrefix`

## 16. Field definitions and validations

- **Typed** validation per key; **reject** unknown keys in API **unless** `allowExperimentalKeys` internal.

## 17. Status / lifecycle rules

N/A.

## 18. Search / filter / sort behavior

- **Search settings** keys in admin UI.

## 19. Relationships to other objects

- **All** modules **read** **cached** settings with **TTL** + **invalidation** on save.

## 20. Permissions / visibility

- **settings.manage** admin; **billing** separate.

## 21. Mobile behavior

- **Read-only** critical settings **not** recommended; **no** mobile admin MVP.

## 22. Notifications / side effects

- Notify all admins when **security** settings change (56).

## 23. Audit / history requirements

- **Every** settings change audited with **diff** (57).

## 24. Edge cases

- **Invalid** timezone change: **confirm** meeting **cron** effects.

## 25. What must not happen

- **Secret keys** displayed in full after save — **mask**; **rotate** flow.

## 26. Out of scope

- **Multi-tenant** reseller billing.

## 27. Open questions

- **O9** hold types list for MVP — finalize with support playbook.
