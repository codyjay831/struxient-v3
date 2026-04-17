import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

const projectDir = process.cwd();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

let envLoaded = false;

function ensureEnvLoaded(): void {
  if (envLoaded) return;
  loadEnvConfig(projectDir, process.env.NODE_ENV !== "production");
  envLoaded = true;
}

/**
 * Lazily construct Prisma after Next env files are loaded (fixes Turbopack / SSR where
 * `DATABASE_URL` was missing during eager `new PrismaClient()` at module init).
 */
export function getPrisma(): PrismaClient {
  ensureEnvLoaded();

  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
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

  globalForPrisma.prisma = client;
  return client;
}
