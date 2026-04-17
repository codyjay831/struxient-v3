# Epic 06 — Files, photos, documents

## 1. Epic title

Files, photos, and documents

## 2. Purpose

Define **file attachments** (binary objects with metadata) linked to **leads, customers, FlowGroups, quotes, quote versions, plan tasks, runtime tasks, notes**, and **catalog** entities where authorized. Supports **evidence** (epic 42), **proposals PDFs**, and **field photos**.

## 3. Why this exists

Construction work is **document-heavy**. Files must be **permissioned**, **audited**, and **discoverable** without overloading database rows as blobs in random columns.

## 4. Canon alignment

- **Execution evidence** ties to **runtime task** and **TaskExecution** context (`07-time-cost`, epic 42).
- **Freeze** stores **references** to customer-facing artifacts as appropriate; **immutable** quote version may **pin** file ids or hashes (epic 08/12).
- **AI** may **propose** file-to-field associations as **draft** (`08-ai-assistance`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Admin** | All files; configure max upload size, allowed MIME types. |
| **Office** | Upload to quotes, customers, projects; delete **draft** attachments; cannot delete **frozen** version pins without new version workflow. |
| **Field** | Upload to **assigned** runtime tasks and job context. |
| **Customer** | Portal upload only where explicitly allowed (epic 55). |

## 6. Primary object(s) affected

- **FileAsset** (storage key, mime, size, hash, `parentType`, `parentId`, `category`).

## 7. Where it lives in the product

- **Files** tab on parent detail.
- **Camera capture** entry on mobile task screen (epic 43).
- **Proposal PDF** slot on quote version header.

## 8. Create flow

1. User clicks **Upload** or drags files.
2. Client validates **size ≤ tenant.maxFileMb** and **MIME ∈ allowlist** (images, PDF, common office — tenant config epic 60).
3. Upload to **object storage** with virus scan hook (if enabled).
4. Record **FileAsset** with `uploadedBy`, `createdAt`, optional `caption`, `category` (`photo`, `document`, `proposal_pdf`, `evidence`, `other`).
5. Success: thumbnail for images; icon for PDF; toast **Uploaded**.

**Chunked upload** for large files if product supports.

## 9. Read / list / detail behavior

**List:** Grid or table — thumbnail, name, size, uploaded by, date, category. Sort default **newest first**.

**Filters:** Category, uploader, date range.

**Detail:** Full preview (inline PDF viewer, image zoom), download link, **linked parent** breadcrumb.

**Empty:** “No files — upload plans, photos, or signed documents.”

## 10. Edit behavior

- **Caption** and **category** editable; **replace file** creates **new** FileAsset version pointer (retain old if **immutable** parent — quote version).

## 11. Archive behavior

- **Archive** hides file from default list; **does not** delete storage until retention job (configurable).

## 12. Delete behavior

- **Draft** quote: uploader or office may delete if policy allows.
- **Frozen** quote version file: **no delete** — only **supersede** via new quote version.
- **Evidence** on completed task: **no delete** for non-admin; admin **redact** flow similar to notes.

## 13. Restore behavior

- Restore archived file if retention permits; audit.

## 14. Required fields

| Field | Type | Why |
|-------|------|-----|
| `storageKey` | string | Locates blob. |
| `mimeType` | string | Safety and preview. |
| `sizeBytes` | int | Quotas. |
| `parentType`, `parentId` | | Anchor (or nullable for **orphan upload** staging — if staging used, must GC). |

## 15. Optional fields

`caption`, `category`, `hashSha256`, `capturedAt` (EXIF), `geoTag`, `runtimeTaskId` for evidence linkage.

## 16. Field definitions and validations

- Max filename 255 chars; sanitize path traversal in displayed name.
- Block executable MIME for safety.
- **Quota per tenant** and **per job** optional warnings.

## 17. Status / lifecycle rules

`active` | `archived` | `pending_scan` | `rejected` (failed virus scan).

## 18. Search / filter / sort behavior

- Search by **caption** and **original filename** substring.
- Filter by category, date, uploader.

## 19. Relationships to other objects

- Polymorphic parent; optional **second** link to **runtime task** for evidence index.

## 20. Permissions / visibility

- Inherit parent read; **field** only **job-scoped** files.
- **Portal** files strictly **customer-visible** category only.

## 21. Mobile behavior

- Capture photo/video; **compress** client-side if over size threshold.
- Offline queue uploads with **retry** (epic 43).

## 22. Notifications / side effects

- Webhook `file.uploaded` for integrations.
- Large virus scan failure notifies uploader.

## 23. Audit / history requirements

Log upload, metadata edit, archive, delete, download (optional **download audit** for sensitive tenants).

## 24. Edge cases

- **Duplicate hash:** allow (two photos same hash possible); optionally **dedupe hint**.
- **Partial upload failure:** rollback DB row or mark `failed`.

## 25. What must not happen

- **Serving** files across tenants (ID guessing).
- **Deleting** evidence that **payment** or **regulatory** retention requires — respect retention flags.

## 26. Out of scope

- Full **DAM** (digital asset management), **OCR** pipeline (unless epic 22/11 covers separately).
- **eSignature** binary storage specifics (epic 13).

## 27. Open questions

- **Video** support and max duration — tenant policy vs product default.
