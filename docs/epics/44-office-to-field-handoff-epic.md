# Epic 44 — Office-to-field handoff

## 1. Epic title

Office-to-field handoff

## 2. Purpose

Define the **operational moment** when office **hands off** an **activated** job to field: **crew assignment**, **start expectations**, **documentation pack**, **safety notes**, and **communication** — bridging **activation** (33) and **field** work (39–43).

## 3. Why this exists

**Activation** alone does not communicate **who**, **when** (intent), and **what** the crew should read first — reducing **first-day** chaos.

## 4. Canon alignment

- **Handoff** does **not** change **frozen** scope (`03`).
- **Schedule** times are **intent** only MVP (`01`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **PM / dispatcher** | Create **handoff checklist**, assign **crew lead**, send **notifications**. |
| **Crew lead** | Acknowledge handoff. |

## 6. Primary object(s) affected

- **HandoffRecord** (`jobId`, `activatedFromQuoteVersionId`, `assignedCrewIds[]`, `briefingNotes`, `acknowledgedAt`, `attachments[]`).

## 7. Where it lives in the product

- **Job** tab **Handoff**; **post-activation** wizard prompt “Start handoff now?”.

## 8. Create flow

1. After activation (or on first open by PM), **Create handoff**.
2. Select **crew** (users or **crew entity** if exists — else users).
3. Attach **files** (06) **required** if tenant policy (e.g. **site hazard** PDF).
4. Send → **notifications** (56) + **tasks** appear in crew feeds (39).

## 9. Read / list / detail behavior

- **Handoff status** badge on job list: `pending`, `sent`, `acknowledged`.
- Detail shows **who acknowledged** when.

## 10. Edit behavior

- **Editable** until **acknowledged**; then **append notes** only.

## 11. Archive behavior

- Superseded by **new** handoff if **crew** changes — keep history.

## 12. Delete behavior

- **Delete** only if **not acknowledged** and **admin**.

## 13. Restore behavior

- N/A.

## 14. Required fields

`jobId`, `createdBy`.

## 15. Optional fields

`scheduledStartIntent` (datetime) — **labeled** “planning only — does not block start” (`01`).

## 16. Field definitions and validations

- If **required attachments** missing, **block send** of handoff.

## 17. Status / lifecycle rules

`draft` | `sent` | `acknowledged`.

## 18. Search / filter / sort behavior

- Filter jobs **handoff pending**.

## 19. Relationships to other objects

- **Job**, **Users**, **Files**, **Activation**.

## 20. Permissions / visibility

- **handoff.send**; field crew sees **their** jobs’ handoffs.

## 21. Mobile behavior

- **Push** “New job briefing”; **one-tap acknowledge** with **checkbox** “I reviewed safety doc”.

## 22. Notifications / side effects

- Email + push (56).

## 23. Audit / history requirements

- Log send, edits, acknowledgements with **device** metadata optional.

## 24. Edge cases

- **Crew reassigned** after ack: **new** handoff revision.

## 25. What must not happen

- **Handoff** changing **task definitions** or **snapshot** (`03`).

## 26. Out of scope

- **Union** dispatch rules; **union** out of scope.

## 27. Open questions

- **Crew** entity vs flat **user tags** — data model choice.
