# Epic 22 — AI-assisted quote drafting

## 1. Epic title

AI-assisted quote drafting

## 2. Purpose

Define **AI assistance** for **quote line ordering**, **descriptions**, **structured input candidates**, and **assembly hints** — all as **draft** until **accepted onto quote version** and **send** remains **human-triggered** (`08-ai`).

## 3. Why this exists

Speeds estimator work **without** breaking **freeze integrity**.

## 4. Canon alignment

- **Line suggestions** draft until accept (`08-ai`).
- **Structured inputs** draft until commit (`18`).
- **Ordering assistant** cosmetic only — must not change **scope** silently (`08-ai` what not to do).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Estimator** | Run assistants; accept per row. |
| **Admin** | Feature flags, data handling policy. |

## 6. Primary object(s) affected

- **AiQuoteAssistJob**; temporary **suggestion rows** attached to `quoteVersionId`.

## 7. Where it lives in the product

- Quote editor **Assist** menu: “Improve descriptions”, “Suggest upsell lines”, “Extract inputs from notes”.

## 8. Create flow

1. User selects scope (whole quote or one line).
2. AI returns suggestions with **confidence** and **rationale** text (optional).
3. User **Accept** per suggestion → writes to **draft** line fields or **draft** structured answers.
4. **Reject** discards suggestion record.

## 9. Read / list / detail behavior

- **Suggestions panel** with pending count; **diff** for line description changes.

## 10. Edit behavior

- Accepted content becomes normal **draft** editable fields.

## 11. Archive behavior

- Clear pending suggestions on **send** if not accepted — **confirm** dialog “Discard N pending AI suggestions?”

## 12. Delete behavior

- User clears suggestion history.

## 13. Restore behavior

- Not applicable.

## 14. Required fields

Job: `quoteVersionId`, `requestedBy`.

## 15. Optional fields

`lineItemId` scope, `prompt`.

## 16. Field definitions and validations

- **Line adds** should use **valid packet+tier** when possible — AI checks catalog first.
- When AI needs to draft scope that does **not** exist in the library (e.g., from voice/text describing a novel task pattern), it creates a **QuoteLocalPacket** instead of inventing a nonexistent packet key. The `QuoteLineItem` is linked to the local packet.

## 17. Status / lifecycle rules

Suggestion: `pending` | `accepted` | `rejected` | `expired` (TTL 7 days).

## 18. Search / filter / sort behavior

- N/A globally.

## 19. Relationships to other objects

- **QuoteVersion**, **Line items**, **Files** for upload extract.

## 20. Permissions / visibility

- **ai.quote_assist**; no customer visibility of internal prompts.

## 21. Mobile behavior

- Not MVP.

## 22. Notifications / side effects

- None required.

## 23. Audit / history requirements

- Log accepts with **before/after** for line text; **do not** log customer PII in prompts if policy disables.

## 24. Edge cases

- **Price suggestions:** **disabled by default** — commercial numbers are **human** unless tenant explicitly enables **suggest price** with **bright red** review UI.

## 25. What must not happen

- **Auto-send** after AI (`08-ai`).
- Conflating **reorder lines** with **scope** changes (`08-ai`).

## 25a. AI-drafted scope: local-first rule

All AI-drafted scope during quoting — whether from text prompts, voice notes, or uploaded documents — is created as a **QuoteLocalPacket** when the scope does not match an existing library packet. This prevents AI from polluting the curated global library.

The estimator reviews and applies. Useful patterns can be promoted to the global library through the standard admin review process (see Epic 15, §25a).

## 26. Out of scope

- Voice assistant, autonomous quoting.

## 27. Open questions

- **O14** packaging ordering vs catalog AI priority.
