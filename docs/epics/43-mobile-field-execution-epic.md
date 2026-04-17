# Epic 43 — Mobile field execution

## 1. Epic title

Mobile field execution

## 2. Purpose

Define **mobile-first** constraints and capabilities for **work feed** (39), **task execution** (41), **evidence** (42), **offline** behavior, **push** deep links, and **device permissions** — aligned with **start eligibility** (30) and **scheduling non-authoritative** MVP (`01`).

## 3. Why this exists

Trade crews primarily work from **phones**; desktop assumptions **fail** in the field.

## 4. Canon alignment

- **No** **split-brain** scheduling claims (`01`, `9` #7).
- **Execution truth** server-authoritative (`03`, `07`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Field** | Primary user; **biometric** lock optional OS. |

## 6. Primary object(s) affected

- **Mobile client** behaviors; optional **DeviceRegistration** for push.

## 7. Where it lives in the product

- **iOS/Android** apps or **responsive PWA** — product chooses; epic defines **minimum** behaviors for either.

## 8. Create flow

- **Login** → **Work** tab; **select job** → tasks.

## 9. Read / list / detail behavior

- **Responsive** layouts: single column; **sticky** primary action **Start/Complete**.
- **Image** viewer pinch-zoom.

## 10. Edit behavior

- **Same** rules as desktop for **allowed** edits; **no extra** permissions on mobile.

## 11. Archive behavior

N/A.

## 12. Delete behavior

N/A.

## 13. Restore behavior

N/A.

## 14. Required fields

N/A.

## 15. Optional fields

`devicePushToken`, `platform`.

## 16. Field definitions and validations

- **Offline queue:** only **idempotent** actions allowed; **start/complete** require **online** unless explicit **offline mode** ships with **conflict** rules — **MVP default: online required** for **start/complete**; **view** offline cached.

## 17. Status / lifecycle rules

**Sync status** badge on job: `live`, `offline`, `sync_pending`.

## 18. Search / filter / sort behavior

- Same as 39 with **simplified** filters drawer.

## 19. Relationships to other objects

- Uses APIs from **30**, **41**, **42**, **56** push.

## 20. Permissions / visibility

- OS permissions for **camera**, **location** requested **in context** with explanation strings.

## 21. Mobile behavior

- **This epic is mobile** — defines haptics optional, **dark mode** support, **font scaling**.

## 22. Notifications / side effects

- **Push** taps route with **task id** + **job id**; **cold start** deep link validation.

## 23. Audit / history requirements

- Log **device** type on **execution events** optional metadata.

## 24. Edge cases

- **App killed** mid-upload: **resume** uploads on next open; show **retry** UI for evidence.

## 25. What must not happen

- **Showing** calendar block as **cannot start** reason (`1`).

## 26. Out of scope

- **Fully offline execution** with **merge** — phase 2 unless explicitly prioritized.

## 27. Open questions

- **PWA vs native** push reliability — GTM decision.
