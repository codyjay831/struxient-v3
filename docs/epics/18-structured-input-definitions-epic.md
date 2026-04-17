# Epic 18 — Structured input definitions

## 1. Epic title

Structured input definitions

## 2. Purpose

Define **structured input templates** attached to **task definitions** (and optionally **quote-level** aggregates): field types, **timing semantics** (quote vs activation vs execution), validation, **required-to-send** vs **required-to-activate** gating per `08-ai` and `03` send policy.

## 3. Why this exists

Trades capture **measurements and choices** deterministically; these feed **plan generation** and **field forms** without ad-hoc PDF fields.

## 4. Canon alignment

- **Commit walls:** only **committed** values count toward **send** gating (`08-ai`, v2 `REQUIRED_TO_SEND_QUOTE` precedent).
- **Does not** replace line item commercial truth.

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Catalog author** | Define templates on definitions. |
| **Estimator** | Fill **quote-time** inputs on draft version. |
| **Customer** | Portal may fill per **O17** (55). |
| **Field** | Activation/execution-time inputs on runtime tasks. |

## 6. Primary object(s) affected

- **StructuredInputTemplate** (`definitionId`, `key`, `label`, `fieldType`, `requiredPhase`, `validation`).
- **StructuredInputAnswer** (`quoteVersionId` or `runtimeTaskId`, `templateKey`, `value`, `committed` flag).

## 7. Where it lives in the product

- **Definition editor** fields tab; **Quote editor** “Job details” panel; **Runtime task** form (41).

## 8. Create flow (template)

1. Add field → pick type (`text`, `number`, `select`, `boolean`, `date`, `address`, `file_ref`).
2. Set **requiredPhase:** `QUOTE_DRAFT` | `REQUIRED_TO_SEND` | `REQUIRED_TO_ACTIVATE` | `EXECUTION`.
3. Configure options JSON for select; min/max for numbers.
4. Save on definition **draft** → publish with definition revision.

## 9. Read / list / detail behavior

- **Quote:** show **completion meter** (% required fields committed).
- **Portal:** customer sees subset based on **visibility** flags.

## 10. Edit behavior

- **Draft answers** editable freely; **Commit** action (per field or **Commit all**) locks for **send** validation — exact UX: **explicit button** “Commit answers” or auto-commit on blur — product picks **one**; must be documented. **Default:** explicit commit for **high-risk** fields, auto-commit for trivial fields — configurable per template.

## 11. Archive behavior

- Template deprecation: old answers remain; new quotes use new templates.

## 12. Delete behavior

- Cannot delete template if answers exist; **deprecate** only.

## 13. Restore behavior

- Undeprecate template on new definition revision.

## 14. Required fields

Template: `key` unique per definition, `label`, `fieldType`.

## 15. Optional fields

`helpText`, `defaultValue`, `visibility` (`office`, `customer`, `field`).

## 16. Field definitions and validations

- **key:** `^[a-z][a-z0-9_]*$` max 64.
- **value JSON** schema validated per type.

## 17. Status / lifecycle rules

Answers: `draft` | `committed` | `corrected` (post-activation correction epic 37 policy).

## 18. Search / filter / sort behavior

- Quote list filter **missing required inputs** for send.

## 19. Relationships to other objects

- Templates on **TaskDefinition**; answers on **QuoteVersion** (aggregated per line) and **RuntimeTaskInstance**.

## 20. Permissions / visibility

- Customer visibility per field; **PII** masked in logs.

## 21. Mobile behavior

- **Field** execution forms responsive; offline queue with sync (43).

## 22. Notifications / side effects

- **Blocked send** reason lists missing keys.

## 23. Audit / history requirements

- Log **commit** events with before/after for **corrections** post-freeze.

## 24. Edge cases

- **Template change** after answers: **migration wizard** or **warn** on send.

## 25. What must not happen

- **AI** auto-commit without user (`08-ai`).

## 26. Out of scope

- **OCR** auto-fill production pipeline — optional AI draft (22).

## 27. Open questions

- **O17** portal depth — if portal cannot collect, all `REQUIRED_TO_SEND` must be office-committed before send.
