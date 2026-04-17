# Struxient v3 — Schema planning pack

**Status:** **Planning only** — entity-level persistence guidance. **No** Prisma/SQL DDL.  
**Authority:** `docs/canon/*`, `docs/decisions/*`, `docs/epics/*`.  
**Companion:** `01-id-spaces-and-identity-contract.md`, `02-core-entity-map.md`.

---

## How to read this document

- **Purpose** = why the row exists (canon/epic).
- **Required fields** = minimum credible v3 record; **not** every UI field from epics.
- **Likely relations** = FK direction hints.
- **Lifecycle** = create/mutate rules.
- **Immutability** = hard constraints from canon.
- **Source** = whether the driver is primarily **canon** (structural) vs **epic** (product surface).

---

## CRM / intake

### Customer

| Aspect | Content |
|--------|---------|
| **Purpose** | Durable contracting party (`canon/02`, epic 02). |
| **Required fields** | `id`, `tenantId`, `customerType`, identity fields per epic, `createdAt`. |
| **Likely relations** | `FlowGroup` 1—*, `Contact` 1—*, `Quote` 1—*, `PortalUser` 1—*. |
| **Lifecycle** | Active/archived; **no** silent delete if quotes exist (epic 02). |
| **Immutability** | `id`; created audit; **frozen quote customer snapshot** separate from mutable customer (epic 08). |
| **Source** | Epic + O7 governance (display rules). |

### FlowGroup (project / site)

| Aspect | Content |
|--------|---------|
| **Purpose** | Site/project anchor (`canon/03` pipeline, epic 03, `decisions/04`). |
| **Required fields** | `id`, `tenantId`, `customerId`, service address or `addressTbd` policy flag. |
| **Likely relations** | `Quote` 1—*, `Job` 1—1 (MVP default), `File`, `Note`. |
| **Lifecycle** | Active/archived; quotes may still reference. |
| **Immutability** | Moving `customerId` admin-only (epic 03). |
| **Source** | Epic + job timing decision. |

### Lead, Contact, ContactMethod, Note, FileAsset

| Aspect | Content |
|--------|---------|
| **Purpose** | Intake + communications + artifacts (epics 01, 04–06). |
| **Required fields** | `tenantId` + parent polymorphic (`parentType`, `parentId`) or typed FKs per chosen pattern. |
| **Likely relations** | Polymorphic to Customer, FlowGroup, Quote, Job, RuntimeTask, etc. |
| **Lifecycle** | Per epic; notes **append/redact** policies. |
| **Immutability** | Evidence and signatures may **forbid delete** post milestone. |
| **Source** | Primarily **epics**; canon requires **separation** from execution truth. |

---

## Quote domain

### Quote

| Aspect | Content |
|--------|---------|
| **Purpose** | Container + navigation (`canon/03`, epic 07). |
| **Required fields** | `id`, `tenantId`, `customerId`, `flowGroupId`, `quoteNumber`, `currentVersionId?`. |
| **Likely relations** | `QuoteVersion` 1—*, optional `leadId`. |
| **Lifecycle** | Archive/void policies; **delete** rare (epic 07). |
| **Immutability** | `quoteNumber` policy after first send (epic 07). |
| **Source** | Epic; canon defines **version** immutability not shell. |

### QuoteVersion

| Aspect | Content |
|--------|---------|
| **Purpose** | Mutable draft vs immutable sent/signed (`canon/03`, epic 08). |
| **Required fields** | `id`, `quoteId`, `versionNumber`, `status`, `currency`, `createdAt`. |
| **Likely relations** | `workflowVersionId` (pin), `lineItems`, `groups`, `signature`, `snapshot blobs` or child tables (O12). |
| **Lifecycle** | `draft`→`sent`→`signed`; `void`/`superseded` (epic 14). |
| **Immutability** | **Hard immutability** for commercial + freeze payloads after `sent` (`canon/03`, epic 12). |
| **Source** | **Canon** immutability; **epic** fields. |

### QuoteLineItem

| Aspect | Content |
|--------|---------|
| **Purpose** | Commercial + packet selection (`canon/02`, epic 09). |
| **Required fields** | `quoteVersionId`, ordering key, `executionMode`, commercial money fields; for manifest lines, **scope pin XOR** (`scopePacketRevisionId` *or* `quoteLocalPacketId`) per `04` / `planning/01`. |
| **Likely relations** | **`scopePacketRevisionId`** *or* **`quoteLocalPacketId`** (manifest scope **XOR**), `proposalGroupId`. |
| **Lifecycle** | Draft edits only; frozen post-send. |
| **Immutability** | Immutable post-send; changes via new version/CO downstream. |
| **Source** | **Canon** ownership of price; **epic** validations. |

### ProposalGroup, QuoteSignature, StructuredInputAnswer

| Aspect | Content |
|--------|---------|
| **Purpose** | Presentation + acceptance + captured data (epics 10, 13, 18, 55). |
| **Immutability** | Signature + sent snapshot **immutable**; answers **commit** walls (`canon/08-ai`). |
| **Source** | Epics + canon AI commit rules. |

---

## Catalog domain

### ScopePacket + ScopePacketRevision

| Aspect | Content |
|--------|---------|
| **Purpose** | Reusable scope templates (`canon/05`, epic 15). |
| **Required fields** | `packetKey` stable slug + `revision` row (`scopePacketRevisionId`), `tenantId`, `status`. |
| **Likely relations** | `PacketTaskLine`, `PacketTier`, optional checkpoint defs. |
| **Lifecycle** | Draft revisions vs published immutable revisions. |
| **Immutability** | Published revision **immutable**; new publish = new revision row. |
| **Source** | **Canon** (packet ≠ package); epic publishing UX. |

### PacketTaskLine

| Aspect | Content |
|--------|---------|
| **Purpose** | Placement + meaning (`canon/02`, epic 16). |
| **Required fields** | `scopePacketRevisionId`, `targetNodeId` (template-relative), line kind + payload. |
| **Likely relations** | Optional `taskDefinitionId`. |
| **Immutability** | Versioned with packet revision. |
| **Source** | **Canon** placement rule; epic tooling. |

### TaskDefinition + StructuredInputTemplate

| Aspect | Content |
|--------|---------|
| **Purpose** | Library meaning (`canon/02`, epics 17–18). |
| **Required fields** | `tenantId`, `name`, revision/publish model analogous to packets. |
| **Immutability** | Published immutable; **no placement**. |
| **Source** | **Canon**. |

### AssemblyRuleSet (+ inputs)

| Aspect | Content |
|--------|---------|
| **Purpose** | Secondary generator (`canon/05`, epic 20). |
| **Persistence** | Rule text/version + quote-level inputs + **accepted** overlay linkage to plan rows. |
| **Source** | Epic + canon “secondary path”. |

---

## FlowSpec / process template domain

### WorkflowTemplate, WorkflowVersion

| Aspect | Content |
|--------|---------|
| **Purpose** | Immutable graph snapshots (`canon/06`, epics 23–27). |
| **Required fields** | `workflowVersionId`, `tenantId`, `snapshot` (graph blob or normalized graph tables). |
| **Likely relations** | Nodes/Gates/SkeletonTasks/CompletionRules **either** embedded in snapshot **or** normalized **with** `workflowVersionId` FK. |
| **Lifecycle** | Draft author → publish immutable. |
| **Immutability** | Published snapshot **immutable** (`canon/06`). |
| **Source** | **Canon** skeleton vs manifest separation. |

**Planning note:** Normalized graph tables must still be **version-scoped** so edits do not mutate prior versions.

---

## Freeze artifacts (belong to QuoteVersion)

### GeneratedPlan

| Aspect | Content |
|--------|---------|
| **Purpose** | `planTaskId` stable rows (`canon/04`, epic 31). |
| **Persistence** | Per `quoteVersionId`; O12 chooses JSON vs rows — **semantic** invariant: stable ids + provenance keys. |
| **Immutability** | Frozen at send; **never** execution truth. |
| **Source** | **Canon**. |

### ExecutionPackage

| Aspect | Content |
|--------|---------|
| **Purpose** | `packageTaskId` slots (`canon/02`, epic 32). |
| **Persistence** | Per `quoteVersionId`; includes compose errors/warnings. |
| **Immutability** | Frozen at send. |
| **Source** | **Canon** + `canon/09` honest compose. |

---

## Execution domain

### Job

| Aspect | Content |
|--------|---------|
| **Purpose** | Business anchor (`decisions/04`, epic 34). |
| **Required fields** | `id`, `tenantId`, `flowGroupId`, `jobNumber`, `status`. |
| **Likely relations** | Optional `primaryQuoteVersionId` pointer; `PaymentGate`, `CostEvent`. |
| **Lifecycle** | Created/ensured at sign default; cancel/complete ops. |
| **Immutability** | No duplicate job per FlowGroup on packaged path (`decisions/04`). |
| **Source** | Decision pack + epics. |

### Flow

| Aspect | Content |
|--------|---------|
| **Purpose** | Runtime execution graph instance (`canon/02`, epic 33). |
| **Required fields** | `id`, `tenantId`, `jobId`, `workflowVersionId` pin, `createdAt`. |
| **Lifecycle** | Created idempotent activation; multi-flow future may allow many per job (O2). |
| **Immutability** | Pin is immutable; runtime overlays (holds/detours) separate. |
| **Source** | **Canon**. |

### Activation

| Aspect | Content |
|--------|---------|
| **Purpose** | Audit + idempotency key (`canon/03`, epic 33). |
| **Required fields** | `quoteVersionId`, `flowId`, `jobId`, `activatedAt`, `actorUserId?`, integrity hashes optional. |
| **Immutability** | Append-only record. |
| **Source** | **Canon**. |

### RuntimeTask

| Aspect | Content |
|--------|---------|
| **Purpose** | Manifest instances (`canon/02`, epic 35). |
| **Required fields** | `id` (`runtimeTaskId` space), `flowId`, `nodeId`, `source`, display fields, provenance optional `planTaskId` / `lineItemId`. |
| **Lifecycle** | Created activation/CO/injection; superseded by CO. |
| **Immutability** | Execution truth not stored as mutable flags on row beyond **caching** projections; **TaskExecution** is truth (`canon/04`, epic 41). |
| **Source** | **Canon**. |

### TaskExecution

| Aspect | Content |
|--------|---------|
| **Purpose** | Append-only events (`canon/03`, `canon/04`, epic 41). |
| **Required fields** | `id`, `flowId`, **`executableKind` + task id** (or split FK columns), `eventType` (start/complete/…), timestamps, `actorUserId`. |
| **Immutability** | **Append-only**; corrections via compensating events (epic 41). |
| **Source** | **Canon** — **must not** key by `lineItemId`. |

### Hold, DetourRecord

| Aspect | Content |
|--------|---------|
| **Purpose** | Operational overlays (`canon/02`, epics 28–29). |
| **Required fields** | `flowId`, type/reason, optional **executable task** ref for scoped holds (`decisions/02` alignment). |
| **Immutability** | Release/close append semantics. |
| **Source** | **Canon** + decision pack for payment hold linkage. |

### EvidenceItem

| Aspect | Content |
|--------|---------|
| **Purpose** | Link files to execution context (epic 42). |
| **Required fields** | `fileAssetId`, task ref (tagged), optional `taskExecutionId`. |
| **Source** | Epic + folded inspection (`decisions/03`). |

---

## Money / scheduling

### PaymentGate + PaymentGateTarget

| Aspect | Content |
|--------|---------|
| **Purpose** | Gate money milestones (`decisions/02`, epic 47). |
| **Required fields** | `jobId`, amounts, status; targets: `flowId` + `targetKind` + `taskId`. |
| **Immutability** | Target edits restricted after payments (epic 47). |
| **Source** | **Decision 02** + epics. |

### CostEvent, LaborTimeEntry, ScheduleBlock

| Aspect | Content |
|--------|---------|
| **Purpose** | Actuals and **non-authoritative** schedule intent (`canon/07`, `decisions/01`, epics 45–46, 49–50). |
| **Key rule** | Schedule does not define start authority MVP (`decisions/01`). |
| **Source** | Canon/decisions + epics. |

---

## Portal / admin / cross-cutting

### PortalUser, Notification*, AuditEvent, Role/Permission, TenantSettings

| Aspect | Content |
|--------|---------|
| **Purpose** | Customer access, comms, audit, authz, configuration (epics 53–60, `57`). |
| **Likely relations** | Strict customer scoping for portal; audit references polymorphic entity. |
| **Source** | Epics; **audit** must not store secrets (`57`). |

---

## Ownership boundaries (schema-level “who owns what truth”)

| Truth | Owning entity (authoritative row set) |
|-------|---------------------------------------|
| **Sold commercial** | `QuoteLineItem` under **sent** `QuoteVersion` |
| **Frozen scope expansion** | `GeneratedPlan` rows (`planTaskId`) |
| **Node-aligned launch contract** | `ExecutionPackage` slots (`packageTaskId`) |
| **Template structure** | `WorkflowVersion` snapshot |
| **Manifest work instances** | `RuntimeTask` |
| **Template-structural execution** | `SkeletonTask` ids within snapshot + `TaskExecution` |
| **Start/completion facts** | `TaskExecution` |
| **Money received** | Payment application records (naming TBD) |
| **Cost actuals** | `CostEvent` |
| **Schedule intent** | `ScheduleBlock` (MVP non-authoritative) |

---

## Canon vs epic on schema decisions

| Topic | Canon says | Epics add |
|-------|------------|-----------|
| Freeze immutability | Required after send (`03`) | UX + error strings |
| Packet vs package naming | Must not drift (`09#2`, `05`) | UI labels |
| Executable IDs for payment | Stable skeleton/runtime (`02`) | Gate admin screens |
| Inspection progression | Folded into tasks (`03`) | **No** `InspectionCheckpoint` truth table for v3-native |
| AI truth | No silent freeze (`08`) | Draft tables |

---

## O12 (storage shape) — planning stance

**Settled semantically:** plan + package + commercial snapshot exist and are immutable at send.  
**Open structurally:** one JSON blob vs normalized tables vs hybrid (`canon/10` O12).  
**Planning recommendation:** model **relational** rows for **line items** always; for **plan/package** choose **hybrid**: relational **indexes** (ids, nodeId, source, quoteVersionId) + blob for **full** snapshot if needed for speed — **decision belongs in engineering spike**, not canon rewrite.

See `06-schema-planning-open-issues.md`.
