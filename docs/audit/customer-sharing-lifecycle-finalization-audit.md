# Customer Sharing Lifecycle Finalization Audit

## Mission
Perform a final cross-epic verification and audit pass for the customer-sharing lifecycle to ensure coherence, safety, and production-readiness.

## Lifecycle Map

1.  **Governance (`FlowShare`)**: 
    - `PUBLISH`: Generates token, sets status to `PUBLISHED`.
    - `REVOKE`: sets status to `UNPUBLISHED` (access blocked).
    - `REGENERATE`: New token, resets customer responses (acknowledged, clarification).
    - `SET_EXPIRATION`: Sets or clears time-bound access.
2.  **Delivery (`FlowShareDelivery`)**:
    - Pre-fills from `Customer` record.
    - Validates `PUBLISHED` state.
    - Records intent, executes provider, handles reliability (retries, idempotency).
    - Content is method-specific and follow-up aware.
3.  **Access (Portal & Media)**:
    - Enforces: Token lookup, `PUBLISHED` status, and `expiresAt` < `now`.
    - Records telemetry (view count, first/last seen) on valid access.
4.  **Interaction (Customer Response)**:
    - Acknowledge Receipt.
    - Request Clarification (structured reason).
    - Checks Token/Status/Expiry before recording.
5.  **Resolution (Office Resolution)**:
    - Explicit `RESOLVED` status with optional note.
    - New clarification requests automatically reopen the status.
    - Notifications derived from response timestamps vs `notificationLastSeenAt`.

## Verified Behaviors & Edge Cases

| Scenario | Behavior | Verified |
| :--- | :--- | :---: |
| **Unpublished Token** | Portal returns 404; Responses blocked. | ✅ |
| **Expired Token** | Portal returns 404; Media returns 404; Responses blocked. | ✅ |
| **Regenerated Token** | Old token returns 404; Responses reset to null. | ✅ |
| **Media Security** | Access requires valid token + published + not expired OR office auth. | ✅ |
| **Idempotency** | Duplicate sends within 1m return existing record. | ✅ |
| **Follow-up Trigger** | UI detects sent-but-never-viewed or viewed-but-unresolved. | ✅ |
| **Clarification Loop** | Request reopens resolved state; Resolution clears alerts. | ✅ |
| **Telemetry** | Only valid portal page-loads increment count. | ✅ |

## Issues Found & Fixed

### 1. Expiration Bypass in Responses
- **Issue**: `acknowledgeFlowShareReceipt` and `requestFlowShareClarification` only checked for `PUBLISHED` status, not the `publicShareExpiresAt` field.
- **Fix**: Added expiration check to both mutation lookup filters in `src/server/slice1/mutations/flow-share-response.ts`.

## Remaining Intentional Limitations
- **Manual Resolution**: Clarification resolution is an internal signal; it does not automatically send an email/SMS back to the customer.
- **Per-Flow "Seen" State**: Notification "seen" status is tracked at the Flow level, not per-individual-office-user.
- **No Default Expiry**: Expiration must be set manually per share; no tenant-wide default policy.

## Production-Readiness Verdict
**PASSED**: The customer-sharing lifecycle is robust, auditable, and secure. Governance rules are enforced at all boundary points (portal, media, mutations).

## Next Recommended Epic
**Field Evidence Delivery (Batch Export & Multi-Flow Portals)**: Now that the individual flow sharing is hardened, the next logic step is to allow customers to view evidence across multiple flows (a full Project view) or export batches of verified evidence as a single archive.
