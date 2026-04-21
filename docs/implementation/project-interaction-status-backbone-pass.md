# Project Interaction Status Backbone

## Mission
Implement the smallest durable derived-status layer for project-level customer interaction state.

## What Changed

### A. Core Read Model & DTO
- **DTO**: Updated `ProjectEvidenceRollupDto` in `src/lib/project-evidence-rollup-dto.ts` to include:
    - `interactionStatus`: A single derived enum summarizing the project state.
    - `requiresAttention`: Boolean flag for immediate office attention.
    - `shareAccessStatus`: Enum for access state (ACTIVE, EXPIRED, etc.).
- **Read Model**: Updated `getProjectEvidenceRollupReadModel` in `src/server/slice1/reads/project-evidence-rollup.ts` to:
    - Include `publicShareTokenGeneratedAt` in the database select.
    - Implement a centralized `calculateInteractionStatus` helper that derives the new contract from existing durable truths.
    - Fixed a bug where office-side views (by `tenantId`/`flowGroupId`) were being filtered out by expiration logic intended for the customer-portal only.

### B. Office UI
- **Share Controls**: Updated `ProjectShareControls` in `src/components/report/project-share-controls.tsx` to display the derived `interactionStatus` instead of the raw `publicShareStatus`, providing better clarity on whether the customer has viewed, acknowledged, or requested clarification.

### C. Customer UI
- **Portal View**: Updated `ProjectEvidenceRollupView` in `src/components/report/project-evidence-rollup-view.tsx` to use the derived `interactionStatus` for button visibility and status banners, ensuring consistency between what the office sees and what the customer sees.

## Derived Status Contract

| Status | Share Status | Token | View Count | Responses |
| :--- | :--- | :---: | :---: | :--- |
| `PENDING_PUBLISH` | `UNPUBLISHED` | N/A | 0 | N/A |
| `PUBLISHED` | `PUBLISHED` | Yes | 0 | None |
| `VIEWED` | `PUBLISHED` | Yes | > 0 | None |
| `ACKNOWLEDGED` | `PUBLISHED` | Yes | > 0 | `acknowledgedAt` is latest |
| `CLARIFICATION_REQUESTED`| `PUBLISHED` | Yes | > 0 | `clarificationRequestedAt` > `resolvedAt` |
| `CLARIFICATION_RESOLVED` | `PUBLISHED` | Yes | > 0 | `resolvedAt` >= `clarificationRequestedAt` |
| `REVOKED` | `UNPUBLISHED` | Yes | N/A | (Only if previously published) |
| `EXPIRED` | `PUBLISHED` | Yes | N/A | (If `expiresAt < now`) |

**`requiresAttention`** is `true` if:
- `isClarificationUnresolved` (Office has not resolved the request) OR
- `notificationPriority === "URGENT"` (Unseen activity)

## Tests Added
- `scripts/integration/project-interaction-status.integration.test.ts`: Verified all 8 derived status states and the `requiresAttention` logic across combinations of durable project truth.

## What was Intentionally Left Out
- **New Persistence**: No new database fields were added; the contract is entirely derived from existing durable truths.
- **Project Management States**: No "In Progress", "On Hold", or "Delayed" statuses; only interaction/customer-sharing states.
- **Threaded Conversation**: Status remains a point-in-time summary.

## Known Follow-up Gaps
- **History Tracking**: No audit log of status transitions (e.g., when it moved from VIEWED to ACKNOWLEDGED).
- **Notification Engine**: While `requiresAttention` is derived, it doesn't automatically trigger external alerts (SMS/Email) beyond the existing notification backbone.
