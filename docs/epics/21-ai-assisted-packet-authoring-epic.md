# Epic 21 — AI-assisted packet authoring

## 1. Epic title

AI-assisted packet authoring

## 2. Purpose

Define **AI drafting** for **scope packets** and **packet task lines**: suggestion UI, **diff review**, **human publish** gate, and **placement suggestion** semantics per `08-ai-assistance-canon`.

## 3. Why this exists

Accelerates catalog building **without** violating **commit walls** (`08-ai`, `09` ban on silent catalog truth).

## 4. Canon alignment

- AI may propose **lines, text, estimates**; **not** publish without review.
- **Node placement suggestions** are **draft** until human commits (`08-ai`).

## 5. User roles involved

| Role | Capabilities |
|------|--------------|
| **Catalog author** | Run **Draft with AI**, accept/reject hunks. |
| **Admin** | Tenant AI feature flags (60). |

## 6. Primary object(s) affected

- **AiDraftJob** (`targetType=packet`, `status`, `payload`, `provenanceModel`).
- **Packet draft revision** candidate diff.

## 7. Where it lives in the product

- **Packet editor** button “Suggest lines”; **modal** with streaming text and **Apply selected**.

## 8. Create flow

1. User provides **prompt** + optional **upload** (spec PDF) — file goes to **draft** storage (06).
2. System returns **proposed** JSON patch for lines (not directly written).
3. User reviews **table diff** (add/change/remove) with **risk flags** (placement to unknown node).
4. **Apply** writes to **draft packet** only.
5. **Publish** still follows epic 15 human publish.

## 9. Read / list / detail behavior

- **History** of AI jobs per packet (status, who ran, model id).

## 10. Edit behavior

- User may **edit** AI-proposed rows before publish freely.

## 11. Archive behavior

- Archive AI job records per retention policy.

## 12. Delete behavior

- User may delete **failed** draft jobs.

## 13. Restore behavior

- Not applicable.

## 14. Required fields

Job: `requestedBy`, `targetId`, `createdAt`.

## 15. Optional fields

`modelName`, `tokenUsage`, `estimatedCostUsd`.

## 16. Field definitions and validations

- **Output schema validate** before showing Apply; reject malformed.

## 17. Status / lifecycle rules

Job: `queued` | `running` | `succeeded` | `failed` | `partially_applied`.

## 18. Search / filter / sort behavior

- Filter AI jobs by user, date, target packet.

## 19. Relationships to other objects

- Links to **FileAsset** inputs; **Packet** draft.

## 20. Permissions / visibility

- **ai.packet_draft** permission; **no customer** access.

## 21. Mobile behavior

- Not supported for authoring MVP.

## 22. Notifications / side effects

- Email author when long job completes (optional).

## 23. Audit / history requirements

- Log **Apply** with **snapshot** of accepted hunks and **model version**.

## 24. Edge cases

- **Hallucinated** node ids: validator **strips** or **blocks** Apply until fixed.

## 25. What must not happen

- **Auto-publish** AI catalog (`08-ai`, `09`).
- **Streaming** directly into **TaskExecution** (`08-ai`).
- AI creating **global library** objects (ScopePacket, TaskDefinition) without human review and formal promotion.

## 25a. AI drafting during quoting (QuoteLocalPacket)

When AI drafts scope **during quoting** (from voice notes, text, uploaded plans), all output is created as a **QuoteLocalPacket** — local to that specific quote, not in the global library. The estimator reviews, edits, and applies the suggestions to their draft. This is distinct from AI catalog authoring (which targets the global library through the standard admin review process).

If an AI-drafted `QuoteLocalPacket` proves useful across jobs, the estimator may **promote** it to the global library through the standard promotion flow (see Epic 15, §25a).

## 26. Out of scope

- **Fine-tuning** models; **PII** training.

## 27. Open questions

- **O14** which AI features ship first — packaging only.
