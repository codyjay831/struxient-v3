import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

const projectDir = process.cwd();

/** Avoid `globalThis.prisma` — that name is generic and can collide with tooling or stale tutorials. */
const PRISMA_SINGLETON_KEY = "__struxient_prisma_client__" as const;

function getSingleton(): PrismaClient | undefined {
  return (globalThis as Record<string, unknown>)[PRISMA_SINGLETON_KEY] as PrismaClient | undefined;
}

function setSingleton(client: PrismaClient | undefined): void {
  (globalThis as Record<string, unknown>)[PRISMA_SINGLETON_KEY] = client;
}

let envLoaded = false;

function ensureEnvLoaded(): void {
  if (envLoaded) return;
  loadEnvConfig(projectDir, process.env.NODE_ENV !== "production");
  envLoaded = true;
}

/**
 * After `prisma generate` adds a new model, Next dev can keep a cached `PrismaClient` on `globalThis`
 * that was built from an older generated client (no `prisma.lead`, etc.). Drop that singleton so the
 * next client matches the current `@prisma/client` + `.prisma/client` on disk.
 */
function leadDelegateMissing(client: PrismaClient): boolean {
  const lead = (client as unknown as { lead?: { findMany?: unknown } }).lead;
  return lead == null || typeof lead.findMany !== "function";
}

/**
 * Lazily construct Prisma after Next env files are loaded (fixes Turbopack / SSR where
 * `DATABASE_URL` was missing during eager `new PrismaClient()` at module init).
 */
export function getPrisma(): PrismaClient {
  ensureEnvLoaded();

  const cached = getSingleton();
  if (cached && leadDelegateMissing(cached)) {
    setSingleton(undefined);
    void cached.$disconnect().catch(() => {});
  }

  const live = getSingleton();
  if (live) {
    return live;
  }

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "[Struxient] DATABASE_URL is not set. Add it to `.env` or `.env.local` at the project root (see `.env.example`), then restart `next dev`.",
    );
  }

  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  setSingleton(client);
  return client;
}
