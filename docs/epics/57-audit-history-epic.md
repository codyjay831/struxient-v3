# Epic 57 — Audit and history

## 1. Epic title

Audit and history

## 2. Purpose

Define **tenant-wide audit logging**: **who** did **what** **when** to **which entity**, **field-level diffs** where applicable, **retention**, **export**, and **UI** surfaces — unifying **object-level** audits referenced across epics.

## 3. Why this exists

Compliance, support, and **dispute resolution** require **one** **credible** **history** story.

## 4. Canon alignment

- **Append-only** execution truth separate, but **audit** may reference **execution events** (`03`).
- **AI** actions logged with **model** metadata when present (`08-ai`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Admin** | View **global** audit; **export**; set retention (60). |
| **Office** | View audit for **objects** they can read. |
| **Auditor** (optional role) | Read-only cross-object. |

## 6. Primary object(s) affected

- **AuditEvent** (`actorUserId`, `impersonatorId?`, `action`, `entityType`, `entityId`, `diff`, `ip`, `userAgent`, `createdAt`).

## 7. Where it lives in the product

- **Object** **Activity** tabs (05 overlap — **either** merge **notes+system** or **link**; **default:** **single** timeline component fed by **notes** + **audit** queries).
- **Admin** `/settings/audit`.

## 8. Create flow

- **Automatic** on instrumented mutations; **no user create**.

## 9. Read / list / detail behavior

**Global list:** filters: user, action, entity type, date range, **full-text** on diff JSON (careful performance).

**Detail:** JSON diff **pretty** view; **PII** masked for non-admin roles per field policy.

**Empty:** “No audit entries.”

## 10. Edit behavior

- **No edit**; **annotation** admin-only optional (separate table).

## 11. Archive behavior

- **Cold storage** move after **hot** retention (e.g. 1 year online) — configurable.

## 12. Delete behavior

- **No delete** in hot store except **GDPR** tooling with **legal** process.

## 13. Restore behavior

- **Restore from cold** admin support ticket workflow — out of scope tool.

## 14. Required fields

`actorUserId` or `system`, `action`, `entityType`, `entityId`, `createdAt`.

## 15. Optional fields

`correlationId` for tracing multi-step transactions (send, activation).

## 16. Field definitions and validations

- **Clock** NTP-synced servers; **tamper** checksum optional HMAC chain for **high** compliance tenants.

## 17. Status / lifecycle rules

N/A.

## 18. Search / filter / sort behavior

- Default sort `createdAt` desc; **export** CSV **limited** to 100k rows per job with **email** link when ready.

## 19. Relationships to other objects

- **All** entities; **soft** foreign keys only for flexibility.

## 20. Permissions / visibility

- **audit.view** tiered global vs object-scoped.

## 21. Mobile behavior

- **Read-only** recent **job** audit subset for **PM**.

## 22. Notifications / side effects

- **Security** alert on **suspicious** mass exports (56).

## 23. Audit / history requirements

- **This epic is audit** — ensure **bootstrap** events for **admin** access changes.

## 24. Edge cases

- **High volume** jobs: **sample** mode for UI with **download full** async.

## 25. What must not happen

- **Logging** secrets or **full** payment PAN.

## 26. Out of scope

- **SIEM** vendor specifics — provide **webhook** optional.

## 27. Open questions

- **Retention** legally required minimums per region — legal.
