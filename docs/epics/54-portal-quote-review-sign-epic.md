# Epic 54 — Portal quote review and sign

## 1. Epic title

Portal quote review and sign

## 2. Purpose

Define **customer** experience to **view** **sent** quote version **presentation**, download PDF, and **sign/accept** per **epic 13** — **read-only** truth, **no** internal editor exposure.

## 3. Why this exists

**Signature** is the **authorization event** for execution binding (`03`); portal is the primary **delivery** channel.

## 4. Canon alignment

- Customer sees **frozen** presentation; **no** **draft** access (`03`, `08`).
- **O16** signature provider scope may extend methods — core behavior here is **provider-agnostic** fields.

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Customer** | Review, sign, decline (optional) with reason. |

## 6. Primary object(s) affected

- Uses **QuoteVersion** presentation snapshot; **Signature** (13).

## 7. Where it lives in the product

- `/portal/quotes/:versionId` (token scoped).

## 8. Create flow

- Office **send** (12) generates **portal link** + email (56).

## 9. Read / list / detail behavior

- **Proposal** pages mirror **PDF** sections (10 groups).
- **Totals** with tax disclaimers as configured.
- **Line items** respect **customer visibility** flags (09).
- **Decline** optional flow captures **reason**; notifies office (56); **does not** void version automatically — **policy** configurable (default **notify only**).

## 10. Edit behavior

- **None** for proposal content.

## 11. Archive behavior

- If version **void** (14), portal shows **withdrawn** message.

## 12. Delete behavior

- N/A.

## 13. Restore behavior

- N/A.

## 14. Required fields

For sign: acceptance checkboxes per **legal** template (13).

## 15. Optional fields

`customerComment` on sign.

## 16. Field definitions and validations

- **Version** must be `sent` and **not void**; **clock** skew handled server-side.

## 17. Status / lifecycle rules

Customer session **authorized** only for **specific** `versionId` + **customer** match.

## 18. Search / filter / sort behavior

- List **open** vs **signed** proposals on portal dashboard.

## 19. Relationships to other objects

- **QuoteVersion**, **Signature**, **Files** proposal PDF.

## 20. Permissions / visibility

- **Token** scoped; **no** browsing other versions unless linked.

## 21. Mobile behavior

- **Signing** optimized (13, 43 patterns).

## 22. Notifications / side effects

- Office notified **signed** / **declined**.

## 23. Audit / history requirements

- Portal **view** events optional privacy-light logging; **sign** mandatory (13).

## 24. Edge cases

- Customer opens **two** browsers: **first sign wins**; second sees **already signed** (`13`).

## 25. What must not happen

- Showing **internal** compose warnings (32) to customer.

## 26. Out of scope

- **In-person** sign capture (office device) — covered in 13 as alternative channel.

## 27. Open questions

- **O16** DocuSign vs native — extends **Signature.method** enum only.
