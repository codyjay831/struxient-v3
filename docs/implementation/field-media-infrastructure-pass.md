# Epic: Field Media Infrastructure

## 1. Summary of Changes
This pass implements the **Field Media Infrastructure**, providing the durable storage, upload, and retrieval pipeline required for field completion proof attachments. It introduces a storage provider abstraction, a local filesystem implementation for development, and secure API endpoints for handling media. It also bridges the frontend UI to allow real file selection and upload during the task completion process.

## 2. Technical Implementation

### A. Storage Abstraction (`src/server/media/`)
- **`StorageProvider` Interface**: Defined a minimal contract for uploading and downloading binary content with metadata.
- **`DiskStorageProvider`**: Implemented the interface using the local filesystem (`fs/promises`). It stores files in a configurable directory (defaulting to `./storage`) and maintains sidecar `.meta.json` files for content type and original filename persistence.

### B. API Routes (`src/app/api/media/`)
- **`POST /api/media/upload`**: 
    - Secure endpoint requiring `field_execute` capability.
    - Handles `multipart/form-data` uploads.
    - Returns a durable `storageKey` and file metadata (size, type, name).
- **`GET /api/media/[storageKey]`**:
    - Secure endpoint requiring a valid principal.
    - Verifies that the requested media belongs to the user's `tenantId` by checking the `CompletionProofAttachment` record in the database.
    - Streams the file content with appropriate headers (`Content-Type`, `Content-Disposition`, `Cache-Control`).

### C. Completion Proof Integration
- **Mutation Update**: Updated `completeRuntimeTaskForTenant` to accept a structured array of attachment objects (including size and content type) instead of just keys.
- **Frontend UI (`ExecutionWorkItemCard`)**:
    - Replaced the "Attachments coming soon" placeholder with a functional "📎 Add Photo" button.
    - Implemented immediate background upload upon file selection.
    - Added a preview/staging list for uploaded files with the ability to remove them before final confirmation.
    - Integrated real `storageKey` and metadata into the final completion mutation call.

### D. Security & Authorization
- **Private by Default**: Media is not accessible via public URLs.
- **Tenant Isolation**: The download API explicitly filters by `tenantId`, ensuring workers or admins cannot access media from other tenants even if they know the storage key.
- **Role-Based Upload**: Only roles with `field_execute` or higher can upload completion evidence.

## 3. Execution Semantics Preserved
- **Atomic Completion**: The task completion and evidence linkage remain a single transactional operation on the server.
- **Backbone Contract**: The `CompletionProof` and `CompletionProofAttachment` models remain the source of truth for evidence metadata.

## 4. Tests
- **`scripts/integration/media-infrastructure.integration.test.ts`**: New integration test verifying:
    1. Direct interaction with `DiskStorageProvider` (upload/download).
    2. Successful task completion with real media metadata.
    3. Read model correctly surfacing the download-ready attachment info.

## 5. Known Gaps & Follow-ups
- **Cloud Storage**: The `DiskStorageProvider` is for development; a `CloudStorageProvider` (e.g., AWS S3 or Azure Blob) should be implemented for production environments.
- **Image Processing**: No server-side thumbnail generation or image compression was implemented in this backbone pass.
- **Multipart Cleanup**: Abandoned uploads (files uploaded but never linked to a completed task) currently remain in storage and require a periodic cleanup worker.

## 6. Next Recommended Epic
**Field Media UX Hardening (Thumbnails & Gallery)**: Now that the infrastructure is durable and secure, the next step is to improve the user experience by adding image thumbnails, a lightweight gallery viewer, and better visual feedback for uploaded evidence.
