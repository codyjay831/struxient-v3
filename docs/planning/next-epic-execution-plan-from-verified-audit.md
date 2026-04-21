# Struxient v3 Next Epic Execution Plan From Verified Audit

## 1. Verified baseline

**What is complete:**
- **Commercial Spine:** Full Draft → Sent → Signed → Activated transaction chain.
- **Relational Integrity:** SHA256 hashing for frozen artifacts and deterministic "Manifest" expansion.
- **Auth Foundation:** Tenant isolation and capability-based guards (`office_mutate`, `field_execute`).
- **Read Models:** Aggregated workspace DTO for high-performance navigation.

**What is partial:**
- **UI Surfaces:** Functional "Developer Hub" (`src/app/dev`) exists, but lacks production-ready layout/theming.
- **Field Execution:** Start/Complete events for `RuntimeTask` work in dev, but lack operational control (Gating).
- **Catalog Management:** Models exist, but no UI for editing packets or templates (Seeding only).

**What is missing:**
- **Post-Activation Control:** No "Change Order" engine for modifying scope after signing.
- **Operational Gating:** Payment gates do not yet block field task actionability.
- **Customer Self-Service:** No portal for customer signature or document review.

**Biggest false completion risks:**
- **"Field Ready" Illusion:** Field workers can "Complete" tasks in the dev UI, but the system cannot stop them if the homeowner hasn't paid (Missing Epic 47).
- **"Trade Scalability" Illusion:** We can activate a job, but we cannot add a new trade (packet) without a developer writing a Prisma seed (Missing Epic 15).

---

## 2. Remaining workstreams

| Workstream | Why it still exists | Verified Evidence | Category | Dependency Level | Confidence |
|---|---|---|---|---|---|
| **Production Workspace Shell** | Existing logic is trapped in dev-only routes. | `src/app/dev/quotes/[quoteId]` | `Productionization` | Low | High |
| **Payment Gating Backbone** | Verified "Decision 02" gating logic is not implemented. | `prisma` enums only; no server engine. | `Core Business Flow` | High | High |
| **Catalog / Template Editor** | Managing trades requires code (seeds). | No routes for packet/template CRUD. | `Foundational blocker` | Medium | High |
| **Change Order Engine** | Real jobs drift; system currently rigid post-sign. | No mutations for `ChangeOrder`. | `Core Business Flow` | Medium | High |
| **PreJobTask Visibility** | "Site Survey" work is invisible to estimators. | `PreJobTask` model unused in reads. | `Operational Visibility` | Low | High |
| **Customer Portal** | Customers must have signature recorded by office. | No public-facing route/auth. | `Future / Optional` | Low | High |

---

## 3. Dependency map
- **Production Workspace Shell** should precede **Payment Gating** because operators need a stable "Office Hub" to monitor gate status.
- **Payment Gating Backbone** should precede **Broad Field Rollout** to prevent "free work" scenarios where tasks are completed before deposit.
- **Catalog Editor** can run in parallel with **Gating**, but is required before scaling beyond the "Seeded" trades.
- **Change Orders** depend on **Activation** (Verified Complete) but should follow **Gating** to ensure CO-added tasks respect the same payment rules.

---

## 4. Recommended execution order

1. **Production Workspace Shell (Phase 6):** Move existing verified lifecycle (Draft->Sign->Activate) into a themed production environment. 
   - *Why now:* Proves the "Hub" concept and exposes existing logic to real feedback.
   - *Unlocks:* Operator visibility.
2. **Payment Gating Backbone (Epic 47):** Implement the satisfaction engine and start-eligibility blocking.
   - *Why now:* Necessary for financial safety in the field.
   - *Unlocks:* Real field execution.
3. **Catalog & Template Editor MVP (Epics 15 & 23):** Build UI to manage `ScopePacket` revisions and `WorkflowTemplate` versions.
   - *Why now:* Removes the developer bottleneck for trade expansion.
   - *Unlocks:* Content scaling.
4. **Change Order Engine (Epic 37):** Implement post-activation scope deltas.
   - *Why now:* Handles real-world job drift.
   - *Unlocks:* Production hardening.
5. **PreJobTask Integration:** Close the "Before the Quote" survey gap.

---

## 5. Smallest durable next slices

### Slice A: Production Office Hub (Quote Workspace)
- **Objective:** Move `src/app/dev/quotes/[quoteId]` to `src/app/(office)/quotes/[quoteId]` with production theme.
- **In-scope:** Production layout (sidebar/header), Quote list view, Quote workspace pipeline (Steps 1-5).
- **Out-of-scope:** Field work-feed, mobile optimization, portal.
- **Files touched:** New routes in `src/app/(office)`, reuse `src/server/slice1/reads/quote-workspace-reads.ts`.
- **Confidence:** High.

### Slice B: Payment Gate "Actionability" Engine
- **Objective:** Implement "Decision 02" satisfaction check in the `RuntimeTask` start route.
- **In-scope:** Create `PaymentGate` for quote version, satisfaction mutation, modify `task-actionability.ts` to block if gate is open.
- **Out-of-scope:** Auto-releasing holds, complex detour loops.
- **Files touched:** `src/server/slice1/eligibility/task-actionability.ts`, new mutation `satisfy-payment-gate.ts`.
- **Confidence:** High.

### Slice C: Scope Packet Revision Editor MVP
- **Objective:** Allow office users to define "Trades" (Packets) without writing seeds.
- **In-scope:** List packets, Create Revision, Add/Edit `PacketTaskLine` (Node placement, title, task definition link).
- **Out-of-scope:** AI drafting, variant tiers.
- **Files touched:** New routes for catalog management, `src/server/slice1/mutations/create-packet-revision.ts`.
- **Confidence:** High.

---

## 6. What not to do yet

- **Broad UI Polish:** Do not spend time on transitions or advanced components until the "Production Shell" is handling the Quote Lifecycle.
- **Advanced Field UX:** Do not build the "Field Map" or "Photo Evidence" UI until **Payment Gating** is reliably blocking task starts.
- **AI Authoring:** Do not build the AI drafting agents until the **QuoteLocalPacket** and **Catalog Editor** contracts are operational via standard human mutations.
- **Portal Self-Sign:** Office-recorded signature is a sufficient bridge; building the public portal is lower priority than **Change Orders**.

---

## 7. Open human decisions
- **Decision 02 Retargeting:** How should Payment Gates be updated when a **Change Order** removes their original task target? (Blocked by Epic 37 build).
- **PreJobTask Ownership:** Should Site Surveys move to their own "Phase 0" or stay strictly on the `FlowGroup`?

---

## 8. Final recommendation

- `Recommended next epic: Production Workspace Shell (Phase 6)`
- `Second after that: Payment Gating Backbone (Epic 47)`
- `Biggest blocker still open: Manual catalog seeding (Epic 15)`
- `Biggest rework risk if sequence is wrong: Building advanced Field UX before the Gating/Change-Order safety systems are in place.`
