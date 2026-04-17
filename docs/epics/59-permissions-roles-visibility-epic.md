# Epic 59 — Permissions, roles, and visibility

## 1. Epic title

Permissions, roles, and visibility

## 2. Purpose

Define **role templates** (Admin, Office, Estimator, Field, Finance, Customer portal), **permission keys** referenced across epics (`quote.send`, `task.execute`, `hold.apply`, etc.), **row-level** options (assigned jobs only), and **tenant** overrides — addressing **`O13`** with a **default** stance.

## 3. Why this exists

Without explicit **ACL**, each team **hardcodes** checks inconsistently.

## 4. Canon alignment

- **Start eligibility** separate from **role** (30) but **roles** gate **who may attempt** actions.
- **No** **JobTask** permission paths (`9`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Admin** | Assign roles, configure **custom** role bundles (optional). |
| **Member** | Operates under **assigned** roles. |

## 6. Primary object(s) affected

- **Role**, **Permission**, **UserRoleAssignment**, optional **ResourcePolicy** (row-level).

## 7. Where it lives in the product

- **Settings → Team & roles** `/settings/roles`.

## 8. Create flow

1. Admin **invites user** with **role set**.
2. User accepts invite → **assignments** active.

## 9. Read / list / detail behavior

- **Matrix** UI permissions × roles (read-only templates + toggles for custom).

## 10. Edit behavior

- Changing role **effective immediately** with **audit** (57); **socket** refresh sessions optional.

## 11. Archive behavior

- **Deactivate user** removes **all** assignments; **re-enable** restores prior roles if configured.

## 12. Delete behavior

- **Hard delete user** rare; **anonymize** PII per policy.

## 13. Restore behavior

- Reactivate user.

## 14. Required fields

`userId`, `roleId`, `tenantId`.

## 15. Optional fields

`scope` JSON for row-level: `{jobs:"assigned_only"}`.

## 16. Field definitions and validations

- **Permission keys** **versioned** registry in repo; **unknown keys** rejected at build in CI for drift detection — engineering practice.

## 17. Status / lifecycle rules

Assignment `active` | `suspended`.

## 18. Search / filter / sort behavior

- User list filter by role.

## 19. Relationships to other objects

- **All** features **declare** required permissions in **epic** text **and** **registry**.

## 20. Permissions / visibility

- **Meta:** only **admin** manages roles.

## 21. Mobile behavior

- **No** full matrix on mobile; **view** own roles.

## 22. Notifications / side effects

- Notify user when **roles** change (56).

## 23. Audit / history requirements

- **Mandatory** audit for role grants/revokes (57).

## 24. Edge cases

- **Last admin** demotion **blocked** with error.

## 25. What must not happen

- **Client-only** authz checks without **server** enforcement.

## 26. Out of scope

- **ABAC** full policy engine; **SCIM**.

## 27. Open questions

- **O13** capability matrix depth for **subcontractor** model — **MVP:** tenant-wide field crew + **optional** `jobs.assigned_only` flag for **Field** role.
