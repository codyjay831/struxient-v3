import { describe, expect, it } from "vitest";
import { jsonResponseForCaughtError } from "./tenant-json";
import { InvariantViolationError } from "@/server/slice1/errors";

async function bodyOf(res: Response): Promise<{ status: number; body: unknown }> {
  return { status: res.status, body: await res.json() };
}

describe("jsonResponseForCaughtError", () => {
  it("never returns null and never produces an empty body for arbitrary errors", async () => {
    const res = jsonResponseForCaughtError(new Error("kaboom"));
    expect(res).toBeTruthy();
    const { status, body } = await bodyOf(res);
    expect(status).toBe(500);
    expect(body).toMatchObject({
      error: { code: "INTERNAL_ERROR", message: expect.any(String) },
    });
  });

  it("never produces an empty body for a non-Error throw", async () => {
    const res = jsonResponseForCaughtError("plain string");
    const { status, body } = await bodyOf(res);
    expect(status).toBe(500);
    expect(body).toMatchObject({
      error: { code: "INTERNAL_ERROR", message: expect.any(String) },
    });
  });

  it("detects PrismaClientInitializationError by name (Turbopack instanceof gap)", async () => {
    // Reproduces the production failure: dual-loaded `@prisma/client/runtime/library`
    // causes `instanceof` to return false even though the error is a real Prisma init
    // error. The helper must detect it via name/errorCode duck typing.
    const fake: Error & { errorCode?: string; clientVersion?: string } = Object.assign(
      new Error("Can't reach database server at `localhost:5432`"),
      {
        errorCode: "P1001",
        clientVersion: "6.19.3",
      },
    );
    fake.name = "PrismaClientInitializationError";

    const res = jsonResponseForCaughtError(fake);
    const { status, body } = await bodyOf(res);
    expect(status).toBe(503);
    expect(body).toMatchObject({
      error: { code: "DATABASE_UNAVAILABLE", message: expect.stringContaining("localhost:5432") },
    });
  });

  it("detects Prisma init failure by errorCode P1001 alone", async () => {
    // Belt-and-suspenders: even if the name is missing/renamed, the P1001 code is enough.
    const fake = Object.assign(new Error("connection refused"), { errorCode: "P1001" });

    const res = jsonResponseForCaughtError(fake);
    expect(res.status).toBe(503);
  });

  it("maps `[Struxient] DATABASE_URL` env errors to DATABASE_URL_MISSING", async () => {
    const res = jsonResponseForCaughtError(new Error("[Struxient] DATABASE_URL is not set."));
    const { status, body } = await bodyOf(res);
    expect(status).toBe(500);
    expect(body).toMatchObject({ error: { code: "DATABASE_URL_MISSING" } });
  });

  it("maps InvariantViolationError to its mapped status with code/message/context", async () => {
    const err = new InvariantViolationError(
      "QUOTE_VERSION_NOT_DRAFT",
      "Quote version is not draft.",
      { quoteVersionId: "qv_1" },
    );
    const res = jsonResponseForCaughtError(err);
    const { status, body } = await bodyOf(res);
    expect(status).toBe(409);
    expect(body).toMatchObject({
      error: {
        code: "QUOTE_VERSION_NOT_DRAFT",
        message: "Quote version is not draft.",
        context: { quoteVersionId: "qv_1" },
      },
    });
  });
});
