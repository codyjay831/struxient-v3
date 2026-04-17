# Epic 55 — Portal structured input collection

## 1. Epic title

Portal structured input collection

## 2. Purpose

Define **customer-entered** **structured inputs** on **sent** proposals when **`visibility=customer`** per template (18), including **commit** semantics, **gating** interaction with **send** vs **sign** vs **activate** per **`O17`** and **`08-ai`**.

## 3. Why this exists

Some trades require **homeowner-provided** measurements before **office** can finalize scope; portal offloads data entry **safely**.

## 4. Canon alignment

- **Committed** values only count toward **gating** (`08-ai`, `18`).
- **No** portal writes to **frozen** commercial snapshot fields (`03`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Customer** | Fill **permitted** fields on **sent** version. |
| **Office** | Review **submissions**, **reject** with comment requesting fix. |

## 6. Primary object(s) affected

- **StructuredInputAnswer** rows with `source=portal_user` and **commit** state (`18`).

## 7. Where it lives in the product

- Portal **Job details** or **Proposal** tab **“Information needed”** section.

## 8. Create flow

1. Customer opens fields; edits values.
2. **Save draft** autosaves optional.
3. **Submit** → `submitted` pending office **acceptance** OR **auto-commit** if policy — **pick one**:
   - **MVP recommended:** **Submit** → office **Verify** → **Commit** (two-step) for high-risk fields.
   - **Low-risk** fields may **auto-commit** on submit per tenant flag (60).

## 9. Read / list / detail behavior

- **Progress** bar for **required customer fields**; blockers list.

## 10. Edit behavior

- Customer may **edit** until **office committed** or **sign** locks per policy — **default:** editable until **customer signs** if fields required **before sign**; if required **before activate**, editable until **activate** — **must configure** per field phase (`18`):
  - `REQUIRED_TO_SEND` **cannot** be satisfied by **customer** unless **O17** allows portal before send — **if not**, office must collect. **Document** clearly in implementation matrix.

## 11. Archive behavior

- Superseded answers kept for audit when **new version** (14).

## 12. Delete behavior

- Customer cannot delete committed; **office** may **reopen** with audit rare.

## 13. Restore behavior

- N/A.

## 14. Required fields

Per template definitions (18).

## 15. Optional fields

`customerAttachment` file refs (06).

## 16. Field definitions and validations

- Same validation as office; **spam** throttle on submit.

## 17. Status / lifecycle rules

`draft` | `submitted` | `committed` | `rejected`.

## 18. Search / filter / sort behavior

- Office **inbox** “Portal submissions pending review”.

## 19. Relationships to other objects

- **QuoteVersion**, **Customer**, **PortalUser**.

## 20. Permissions / visibility

- **Field-level** visibility flags; **PII** minimization.

## 21. Mobile behavior

- **Large** inputs, camera attach for measurements.

## 22. Notifications / side effects

- Office notified on **submit**; customer notified on **reject** or **accept** (56).

## 23. Audit / history requirements

- All commits with **who** (customer user id).

## 24. Edge cases

- **Customer submits** after **version void** — **reject** with message.

## 25. What must not happen

- **Portal** editing **prices** (`02`).

## 26. Out of scope

- **E-signature** on each field — use overall proposal sign (54).

## 27. Open questions

- **O17** portal depth — drives whether `REQUIRED_TO_SEND` can be customer-sourced; **if portal limited**, gate must be office-only.
