# Epic 42 — Evidence, photos, and completion proof

## 1. Epic title

Evidence, photos, and completion proof

## 2. Purpose

Define **evidence attachments** required for **task completion** and **inspection** outcomes: capture, **metadata**, **PII safety**, **retention**, linkage to **TaskExecution** and **FileAsset** (06).

## 3. Why this exists

Trades need **proof**; regulators and disputes require **immutable** association to **execution events**, not loose photo galleries.

## 4. Canon alignment

- **Evidence** supports **folded inspection** model (`38`).
- **Not** a substitute for **scope** definition (`05`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Field** | Capture/upload per task requirements. |
| **QC / office** | **Reject** evidence with **request retake** (workflow optional). |

## 6. Primary object(s) affected

- **EvidenceItem** (`fileAssetId`, `taskId`+`kind`, `executionEventId`, `capturedAt`, `lat/long` optional).

## 7. Where it lives in the product

- **Task detail** gallery; **camera** capture flow (43).

## 8. Create flow

1. From **complete** dialog or **during** task: **Add photo/video/file**.
2. Upload (06); create **EvidenceItem** linking to **task** and optional **draft** session.
3. On **complete**, **finalize** links to **execution complete** id.

## 9. Read / list / detail behavior

- Thumbnail grid; **full screen** viewer; **download** permission controlled (59).

## 10. Edit behavior

- **Caption** editable pre-finalize; **replace** creates **new** asset revision; **keeps** old if task already **completed** — **admin** only.

## 11. Archive behavior

- **Archive** hides from default gallery; **retain** for retention period.

## 12. Delete behavior

- **Not allowed** post-complete for non-admin; **legal hold** flag blocks delete (60).

## 13. Restore behavior

- Admin restore archived evidence.

## 14. Required fields

`fileAssetId`, `linkedTaskId`, `linkedTaskKind`.

## 15. Optional fields

`caption`, `evidenceType` (`photo`, `video`, `document`, `signature`).

## 16. Field definitions and validations

- Enforce **min photo count** if template requires; **max** count to prevent abuse.

## 17. Status / lifecycle rules

`draft` | `submitted` | `rejected` | `accepted` (if review enabled).

## 18. Search / filter / sort behavior

- Job-level **Evidence** tab filters by **task**, **date**, **type**.

## 19. Relationships to other objects

- **FileAsset** (06), **TaskExecution**, **Runtime/Skeleton ids**.

## 20. Permissions / visibility

- Field **assigned**; customer **portal** visibility **off** by default unless **share** flag per file (53).

## 21. Mobile behavior

- **Camera** with **compression**; **background upload** with retry.

## 22. Notifications / side effects

- Notify office when **evidence rejected** (optional).

## 23. Audit / history requirements

- Log uploads, replacements, rejections.

## 24. Edge cases

- **GPS** denied: allow with **warning** banner on photo if **geo-required** template — block completion.

## 25. What must not happen

- **Evidence** stored **only** on device without server record.

## 26. Out of scope

- **Computer vision** auto-QC.

## 27. Open questions

- **Video** max length (06 OQ overlap) — pick product default.
