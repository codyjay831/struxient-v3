# Struxient v3 — Core entity map

**Status:** Planning-level **entity inventory** derived from `docs/canon/*`, `docs/decisions/*`, `docs/epics/*`.  
**Not** a schema. Lists **roles** and **domain grouping** for `03-schema-planning-pack.md`.

---

## CRM / intake

| Entity (conceptual) | Role |
|---------------------|------|
| **Tenant / Company** | Isolation boundary, settings, branding (`60`). |
| **User** | Auth subject; role assignments (`59`). |
| **Lead** | Pre-pipeline opportunity (`01`). |
| **Customer** | Contracting party; durable CRM anchor (`02`). |
| **FlowGroup** | Project/site anchor under customer; groups quotes + job (`03`). |
| **Contact** | Person role under customer/project (`04`). |
| **ContactMethod** | Email/phone channels + portal identity linkage (`04`). |
| **Note** | Polymorphic commentary (`05`). |
| **FileAsset** | Binary storage + metadata; polymorphic attach (`06`). |
| **HandoffRecord** | Office→field briefing (`44`). |

---

## Quote

| Entity (conceptual) | Role |
|---------------------|------|
| **Quote** | Container: customer, flow group, numbering (`07`). |
| **QuoteVersion** | Draft/sent/signed/void; pins template + freeze payloads (`08`). |
| **ProposalGroup** | Presentation grouping of line items (`10`). |
| **QuoteLineItem** | Commercial row + manifest **scope pin** (`scopePacketRevisionId` *or* `quoteLocalPacketId`, XOR) + qty (`09`, `03-schema-planning-pack` QuoteLineItem). |
| **QuoteSignature** | Acceptance artifact (`13`). |
| **StructuredInputAnswer** | Quote-time / portal-time answers (`18`, `55`). |
| **ChangeOrder** | Post-activation scope delta document/workflow (`37`). |

---

## Catalog (reusable trade scope + library)

| Entity (conceptual) | Role |
|---------------------|------|
| **ScopePacket** | Catalog header / key (`15`). |
| **ScopePacketRevision** | Immutable published revision (planning name: `scopePacketRevisionId`, `01`). |
| **PacketTier** | Tier variant metadata (`19`). |
| **PacketTaskLine** | Placement + embedded/ref definition (`16`). |
| **TaskDefinition** | Library meaning + input templates; **no placement** (`17`). |
| **StructuredInputTemplate** | Field schema on definitions / quote aggregates (`18`). |
| **AssemblyRuleSet** | Secondary generated-scope rules (`20`). |
| **AiDraftJob / Suggestion** | AI pre-commit artifacts (`21–22`) — may be ephemeral tables + audit. |

---

## FlowSpec / process (template time)

| Entity (conceptual) | Role |
|---------------------|------|
| **WorkflowTemplate** | Named template family (`23`). |
| **WorkflowVersion** | **Immutable snapshot** graph: nodes, gates, skeleton tasks, completion rules (`23–27`). |
| **Node** | Stage container in snapshot (`24`). |
| **Gate** | Routing edge (`25`). |
| **SkeletonTask** | Template task on node (`26`). |
| **CompletionRule** | Node completion policy (`27`). |

---

## Freeze artifacts (quote version scoped)

| Entity (conceptual) | Role |
|---------------------|------|
| **GeneratedPlan** | Deterministic expansion rows (`planTaskId` space) (`31`). |
| **ExecutionPackage** | Node-aligned slots (`packageTaskId` space) (`32`). |
| **ProposalPdf / customer snapshot** | Customer-facing render inputs (`08`, `12`, `06`). |

*Storage shape (normalized vs JSON) is **O12** — semantics are fixed by canon/epics.*

---

## Execution (runtime)

| Entity (conceptual) | Role |
|---------------------|------|
| **Job** | Business anchor (`34`, `decisions/04`). |
| **Flow** | Runtime instance pinned to `workflowVersionId` (`33`). |
| **Activation** | Idempotent bridge record (`33`). |
| **RuntimeTask** | Manifest instance rows (`35`). |
| **TaskExecution** | Append-only start/complete/outcome truth (`41`, `canon/04`). |
| **DetourRecord** | Runtime correction loop (`28`). |
| **Hold** | Start-blocking overlay (`29`, `48`). |
| **EvidenceItem** | File link + task execution context (`42`). |
| **Effective projection** | Read model / query (not necessarily one table) (`36`). |

---

## Money / holds / scheduling intent

| Entity (conceptual) | Role |
|---------------------|------|
| **PaymentGate** | Job-scoped milestone (`47`). |
| **PaymentGateTarget** | Executable task reference (`47`, `decisions/02`). |
| **PaymentApplication / PaymentRecord** | Money applied to gate (`48` — naming TBD). |
| **CostEvent** | Actual cost observations (`49`). |
| **LaborTimeEntry** | Timesheet-style hours (`50`). |
| **ScheduleBlock** | Non-authoritative intent MVP (`45–46`, `decisions/01`). |
| **ScheduleChangeRequest** | Optional approval workflow (`46`). |

---

## Portal / support / admin

| Entity (conceptual) | Role |
|---------------------|------|
| **PortalUser** | Customer auth subject (`53`). |
| **NotificationTemplate / NotificationLog** | Delivery (`56`). |
| **AuditEvent** | Tenant audit stream (`57`). |
| **SearchIndex** | Implementation artifact (`58`). |
| **Role / Permission / Assignment** | AuthZ (`59`). |
| **TenantSettings** | Feature flags + policy (`60`). |
| **LearningSuggestion** | Review inbox (`52`). |

---

## Cross-domain anchors (quick reference)

| Anchor | Domains touched |
|--------|-----------------|
| **`customerId`** | CRM, quote, portal, job shell |
| **`flowGroupId`** | CRM, quote, job |
| **`quoteVersionId`** | Quote, freeze, sign, activation input |
| **`jobId`** | Money, costs, schedule intent, reporting |
| **`flowId`** | Execution, holds, detours, runtime tasks, eligibility |
| **`workflowVersionId`** | Template snapshot pin + flow pin |

See `01-id-spaces-and-identity-contract.md` for **task-related** IDs.
