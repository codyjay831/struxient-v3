# Slice 1 — Open implementation questions (minimal)

Only items that **block** the next physical artifacts: **real Prisma file**, **first migration**, **first route contracts**.

**Schema source:** Paste **`03-prisma-schema-draft-v0.md`** as the **base**; **`slice-1-extension-prejobtask-quotelocalpacket.md`** is **normative** for **`PreJobTask`**, **`QuoteLocalPacket`**, **`QuoteLocalPacketItem`**, and the **`QuoteLineItem` ↔ `QuoteLocalPacket` relation**. First migration can ship **base-only** only if product defers quote-local/pre-job **and** application code does not persist `quoteLocalPacketId` yet; if the column exists, XOR / version scoping must still be enforced until the FK is merged.

---

## O1 — Repository layout for `schema.prisma`

**Block:** Where the Prisma schema file lives (monorepo `apps/api/prisma` vs root).  
**Resolve:** Pick one path before `prisma migrate`.

---

## O2 — Idempotency key uniqueness in SQL

**Block:** `sendClientRequestId @unique` globally (as in draft v0) vs tenant-scoped or per-quote-version composite.  
**Resolve:** Choose uniqueness strategy; adjust migration if global UUID from client is **not** guaranteed.

---

## O3 — `WorkflowVersion.snapshotJson` validator ownership

**Block:** First migration does not validate JSON shape — **which package** (Zod, custom) validates graph **before** pin/send.  
**Resolve:** Name the validator module; **not** a schema question, a **repo** question.

---

## O4 — Route prefix and auth middleware contract

**Block:** Actual OpenAPI or tRPC router — `/api/v1` vs other; how `tenantId` and `userId` attach to request context.  
**Resolve:** First route stub needs this; **not** a product open question.

---

## Non-blocking (do not list here)

- PDF export, email, portal, Slice 2 tables, async send.

---

## Classification

| Count | Intentional |
|-------|-------------|
| ≤4 items | **Only true blockers for “file on disk”** |
