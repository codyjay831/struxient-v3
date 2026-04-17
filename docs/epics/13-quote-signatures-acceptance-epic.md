# Epic 13 — Quote signatures and acceptance

## 1. Epic title

Quote signatures and acceptance

## 2. Purpose

Define **customer acceptance** of a **frozen sent quote version**: capture **signature** (or approved alternative), timestamp, **signer identity**, transition **version status** to `signed`, and trigger **job ensure** per **`04-job-anchor-timing-decision`** default.

## 3. Why this exists

**Sign** authorizes execution binding; **activation** requires **signed** (per policy). Legally and operationally, acceptance must be **auditable** and **immutable**.

## 4. Canon alignment

- **`03`:** Sign does not replace freeze; scope already frozen at send.
- **`04`:** Default **job shell by end of sign** for payment/reporting readiness.
- **`09`:** No string bridges; signer references **contact** ids where possible.

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Customer** | Sign via portal (54) or **in-person** capture on office device. |
| **Office** | Send **sign request**, mark **signed offline** with **uploaded** executed PDF (policy-gated, audited). |
| **Admin** | Void signature only via **void** workflow (14). |

## 6. Primary object(s) affected

- **QuoteSignature** (`quoteVersionId`, `method`, `signerName`, `signerContactId`, `signedAt`, `ip`, `userAgent`, `artifactFileId`).
- **Job** ensure side effect (epic 34).

## 7. Where it lives in the product

- **Portal signing** flow; **Office** “Record signature” dialog with **compliance** checklist.

## 8. Create flow (sign)

1. Customer opens **magic link** or logs in (53).
2. Reviews **immutable** proposal (54).
3. **Consent checkboxes** (terms, scope acknowledgement) per legal template.
4. **Signature capture:** draw, type, or **click accept** per **O16** provider choice.
5. Submit → server validates version still `sent` and **not void**.
6. Record **Signature** row; set version `signed`, `signedAt`.
7. Call **`ensureJobForFlowGroup`** if `company.createJobOnSign` default true (decision `04`).
8. Notify office (56).

## 9. Read / list / detail behavior

- **Signature card** on version header: signer, time, method, **download certificate** (optional PDF).
- **Audit** link.

## 10. Edit behavior

- **No edit** to signature record; **correct** via **void + new version** only.

## 11. Archive behavior

- Not applicable.

## 12. Delete behavior

- **No delete**; voiding version **marks** signature as **voided** contextually in UI.

## 13. Restore behavior

- Not applicable.

## 14. Required fields

| Field | Type | Why |
|-------|------|-----|
| `quoteVersionId` | FK | What was signed. |
| `signerIdentity` | structured | Legal evidence. |
| `signedAt` | timestamp | Ordering vs activation. |
| `method` | enum | eSign vs wet vs clickwrap. |

## 15. Optional fields

`signerTitle`, `witnessUserId` (office), `providerEnvelopeId` (DocuSign etc.).

## 16. Field definitions and validations

- Reject sign if **version ≠ sent** (unless policy allows **draft sign** — **not** default).
- **IP** stored for fraud review; GDPR retention policy in admin (60).

## 17. Status / lifecycle rules

Version: `sent` → `signed` once; duplicate sign attempts **idempotent error** with message.

## 18. Search / filter / sort behavior

- Quote list filter **Signed date**; **unsigned sent** aging report.

## 19. Relationships to other objects

- **Signature 1—1 QuoteVersion** (single acceptance per version default; **counter-sign** future).
- **Job** created/ensured (34).

## 20. Permissions / visibility

- **Customer** sees own signature artifact only.
- **Office** sees all for tenant.

## 21. Mobile behavior

- Portal signing **mobile-optimized**; touch signature pad.

## 22. Notifications / side effects

- Webhook `quote.signed`; payment gate setup may begin (47).

## 23. Audit / history requirements

- **Append-only** signature log; **tamper-evident** hash optional.

## 24. Edge cases

- **Sign then customer rescinds** before activation: **void** flow (14); job shell may remain — policy.
- **Concurrent sign** from two devices: first wins; second gets **already signed**.

## 25. What must not happen

- **Activation** without signed when policy requires sign.
- **Signature** on **wrong** version id — server must **bind** to URL version.

## 26. Out of scope

- Full **DocuSign** parity (O16) — provider-specific epic may extend.

## 27. Open questions

- **O16** provider scope for MVP — business decision.
