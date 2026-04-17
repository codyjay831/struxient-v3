# Epic 19 — Packet tiers and variant handling

## 1. Epic title

Packet tiers and variant handling

## 2. Purpose

Define **tier** selection for **scope packets** (`05`): GOOD/BETTER/BEST style variants, **exactly one resolved template** per `key + tier` at quote time, tier-specific **task line sets** and **pricing hints**, and **picker UX** on line items (09).

## 3. Why this exists

Trades sell **good/better/best** without maintaining separate unrelated SKUs for every depth level.

## 4. Canon alignment

- **`05`:** Tier chooses **which** packet variant applies; **no ambiguous** resolution.

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Catalog author** | Define tiers per packet; map lines per tier (subset/superset). |
| **Estimator** | Pick tier per line. |

## 6. Primary object(s) affected

- **PacketTier** (`packetRevisionId`, `tierCode`, `displayName`, `ordinal`).
- **TierScopedLines** (implementation: separate line sets OR line flags — behavior: **effective lines** differ by tier).

## 7. Where it lives in the product

- **Packet editor** “Tiers” tab; **Quote line** tier dropdown filtered by packet.

## 8. Create flow

1. Author defines **enum** of tier codes for packet (min 1).
2. For each tier, **enable/disable** each packet task line row OR maintain **tier-specific line list** — product picks **one** model:
   - **Model A (recommended):** single line list with **tier inclusion matrix** columns.
3. Publish packet revision.

## 9. Read / list / detail behavior

- **Compare tiers** preview for sales: side-by-side **line diff** and **default hours** totals.

## 10. Edit behavior

- Draft only; changing tier matrix **invalidates** quotes in draft with **warn** (not block).

## 11. Archive behavior

- Deprecating a tier: **block** if used on **sent** quotes — allow but **warn** on new lines only.

## 12. Delete behavior

- Cannot delete tier in published revision; **new revision** removes tier if unused.

## 13. Restore behavior

- Via new revision.

## 14. Required fields

Per packet: ≥1 tier; each tier **code** unique per packet.

## 15. Optional fields

`marketingLabel`, `badgeColor`.

## 16. Field definitions and validations

- `tierCode` max 32; uppercase snake case recommended.

## 17. Status / lifecycle rules

Tiers version with packet revision.

## 18. Search / filter / sort behavior

- Catalog filter **packets with ≥3 tiers**.

## 19. Relationships to other objects

- **QuoteLineItem** stores `tier` + `packetKey` + **pinned revision**.

## 20. Permissions / visibility

- Catalog roles.

## 21. Mobile behavior

- Tier visible read-only on proposal.

## 22. Notifications / side effects

- None.

## 23. Audit / history requirements

- Packet revision audit includes tier matrix changes.

## 24. Edge cases

- **Quote line tier change** regenerates plan preview; user acknowledges **price** not auto-updated unless **pricebook** link says so (out of scope).

## 25. What must not happen

- **Multiple** resolved templates for same key+tier without explicit rule (`05`).

## 26. Out of scope

- **Dynamic pricing engine** per tier.

## 27. Open questions

- **Model A vs separate line lists** — pick one implementation strategy before schema.
