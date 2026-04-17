# Struxient v3 — High-risk areas and mitigations

**Purpose:** Focus review, testing, and early spikes where mistakes **recreate v2 drift** or **break canon silently**.  
**Authority:** `docs/canon/09-banned-v2-drift-patterns.md`, `docs/planning/01-id-spaces-and-identity-contract.md`, `docs/planning/06-schema-planning-open-issues.md`.

---

## R1 — Freeze transaction boundaries (send)

| Risk | Why it hurts | Mitigation |
|------|--------------|------------|
| **Partial freeze** (commercial saved, package not) | Breaks activation integrity (`canon/03`); “sent” lies to customer | **Single DB transaction** (or outbox + compensating saga **only** if unavoidable); integration tests that **fail mid-flight** must leave **no** `sent` state. |
| **Hidden compose reroutes** | Violates `canon/09#12`; trust dies | Persist **warnings** on the frozen package; UI surfaces **acknowledged** flags (`epic 12`). |
| **O12 indecision paralysis** | Schedule slip | **Decide hybrid v0** early: relational **line items** + JSON blobs for plan/package on `QuoteVersion` (`planning/03`); normalize later **without** changing semantics. |

---

## R2 — Template ↔ packet **node id** alignment

| Risk | Why it hurts | Mitigation |
|------|--------------|------------|
| **Packet lines point at node ids not in pinned snapshot** | Compose errors or silent fallback temptation (`canon/09#12`) | **Validate at publish time** for a declared **compatible template**; quote-time picker **filters** incompatible templates; automated fixture test: **publish packet + template together**. |
| **Renaming nodes across template versions** | Breaks historical quotes | **Immutable node ids** in snapshot; display names can change only via **new** `workflowVersionId` (`epic 24`). |

---

## R3 — Activation idempotency + job uniqueness

| Risk | Why it hurts | Mitigation |
|------|--------------|------------|
| **Double activation** | Duplicate flows/runtime rows | DB **unique** constraint on `(quoteVersionId)` activation; retriable API returns **same** `flowId` (`epic 33`, `decisions/04`). |
| **Duplicate jobs per FlowGroup** | Money + reporting chaos (`decisions/04`) | **`ensureJob` reuse** in one module only; test matrix: sign twice, activate twice, concurrent requests. |

---

## R4 — Task identity collapse (API + DB)

| Risk | Why it hurts | Mitigation |
|------|--------------|------------|
| **Bare `taskId`** in JSON | Clients send wrong kind; payment maps wrong (`planning/01`, `canon/09#6`) | **Lint OpenAPI** / codegen: `ExecutableTaskRef` required; **reject** ambiguous payloads **400** with explicit error code. |
| **`TaskExecution` keyed by lineItemId** | Breaks execution truth ownership (`canon/04`) | Code review checklist; DB constraint **cannot** enforce easily — add **application guard** + tests. |
| **Plan/package ids used as execution keys** | “Ghost starts” | Type system separation in service layer; **no** shared TypeScript alias across domains. |

---

## R5 — Skeleton vs manifest duplication

| Risk | Why it hurts | Mitigation |
|------|--------------|------------|
| **Instantiating skeleton tasks as RuntimeTask** | Violates `canon/03`; breaks payment targeting mental model | Activation unit tests per package slot **source** classification; count runtime rows == expected manifest count. |

---

## R6 — Start eligibility “split brain”

| Risk | Why it hurts | Mitigation |
|------|--------------|------------|
| UI shows blocked but API allows start (or reverse) | `canon/09#7` recurrence | **One server function** used by UI and API; **no** parallel client-side gating logic except display; scheduling explicitly excluded MVP (`decisions/01`) with **banner** copy (`epic 45`). |

---

## R7 — Payment / holds (when enabled)

| Risk | Why it hurts | Mitigation |
|------|--------------|------------|
| **ALL vs ANY** ambiguity (`planning/06#3`) | Wrong unblock | Ship **explicit** rule string on `PaymentGate` record; **integration tests** for multi-target cases. |
| **Pre-activation targets** (`planning/06#4`) | Gates reference impossible ids | **MVP default:** create **manifest-target** gates **post-activation**; skeleton-only gates for **pre-mobilize** if finance demands — **document** in settings (`epic 47`). |

---

## R8 — Inspection folded model discipline

| Risk | Why it hurts | Mitigation |
|------|--------------|------------|
| Reintroducing **parallel inspection state** | `decisions/03` violated | **No new** v3-native `InspectionCheckpoint` progression; use **task outcomes + detours** (`epic 38`). |

---

## R9 — Multi-flow assumption leaks (O2)

| Risk | Why it hurts | Mitigation |
|------|--------------|------------|
| APIs assume `jobId → flowId` implicit | Breaks when O2 arrives (`planning/06#2`) | Even in MVP, **accept explicit `flowId`** on execution endpoints; “derive flow” only as **temporary** helper **behind** explicit naming (`planning/04`). |

---

## Recommended risk ceremonies

| Ceremony | When |
|----------|------|
| **Freeze/activation review** | Before first customer tenant |
| **ID contract audit** | Any PR touching `TaskExecution`, `PaymentGateTarget`, `Hold` |
| **Compose fixture expansion** | Every new **packet + template** pair added to seed set |
| **Eligibility golden tests** | Any change to holds/payment/detours |
