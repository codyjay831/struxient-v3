# Epic: Production Storage Provider Pass

## 1. Summary of Changes
This pass replaces the development-only disk storage provider with a production-safe, multi-provider architecture. It introduces a concrete **S3-compatible Storage Provider** suitable for real deployments (AWS S3, Minio, DigitalOcean Spaces, etc.) while preserving the **Disk Storage Provider** for local development. A factory pattern handles provider selection based on environment variables, ensuring zero code changes are needed when moving from development to production.

## 2. Technical Implementation

### A. S3-Compatible Storage Provider (`src/server/media/s3-storage-provider.ts`)
- **AWS SDK Integration**: Implemented using `@aws-sdk/client-s3` for reliable, industry-standard object storage interaction.
- **Atomic Operations**: Uses `PutObjectCommand` and `GetObjectCommand` for secure upload and retrieval.
- **Secure Metadata**: Leverages S3 metadata (e.g., `original-name`) to store evidence properties alongside the binary data, matching the disk provider's sidecar JSON pattern.
- **S3-Compatible Support**: Configured for generic S3 endpoints (Minio/DO), including path-style URL support.

### B. Storage Provider Factory (`src/server/media/get-storage-provider.ts`)
- **Singleton Pattern**: Ensures a single storage provider instance is used across the application life cycle.
- **Provider Selection**: Defaults to `DISK` for local development. Switches to `S3` when `STRUXIENT_STORAGE_PROVIDER=S3` is set in the environment.
- **Config-Driven**: All provider settings (bucket names, regions, credentials) are managed via standard environment variables.

### C. Clean Abstraction (`src/server/media/disk-storage-provider.ts`)
- **Refactoring**: Decoupled the disk provider from the global `getStorageProvider` factory, making the abstraction cleaner and more testable.
- **Stability**: Maintained the existing `StorageProvider` contract, ensuring that the `completionProof` attachment model and `storageKey` stability remain intact.

### D. Security & Environment
- **Private-by-Default**: Both providers remain app-mediated. Media is never exposed via public bucket URLs; access is always authorized through the application's secure retrieval endpoint (`GET /api/media/[storageKey]`).
- **Configuration Hygiene**: Added comprehensive storage and S3 configuration sections to `.env.example`.

## 3. Execution Semantics Preserved
- **Storage Keys**: The `generateStorageKey` logic remains consistent across providers, ensuring that database references created in dev remain valid if migrated to a production-safe disk or object store.
- **Authorization**: The tenant-level authorization logic in the download API remains the source of truth for media access, regardless of the underlying storage backend.

## 4. Tests
- **`scripts/integration/media-infrastructure.integration.test.ts`**: Updated to verify the factory's provider selection logic and ensure that both upload and download remain functional through the new abstraction layer.

## 5. Known Gaps & Follow-ups
- **Bucket Provisioning**: The provider assumes the bucket/directory exists; it does not automatically provision cloud infrastructure.
- **Multipart S3 Uploads**: Large file uploads (>5MB) currently use single-part puts; multi-part upload support for massive files is a future optimization.

## 6. Next Recommended Epic
**Field Media UX Hardening (Thumbnails & Gallery)**: With a production-safe storage foundation in place, the application is ready to layer visual improvements like image thumbnails, a gallery viewer, and better field-feedback for uploaded evidence.
