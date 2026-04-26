import { describe, expect, it } from "vitest";
import { canonicalStringify, sha256HexUtf8 } from "./freeze-snapshots";

/**
 * Direct unit coverage for the two pure helpers underlying snapshot
 * canonicalization and content addressing. Both are exported from
 * `freeze-snapshots.ts` already; this test pins their determinism and
 * stable-shape behavior so a regression here would flip
 * `planSnapshotSha256` / `packageSnapshotSha256` on otherwise-equivalent
 * frozen JSON.
 *
 * Slice scope (visibility/readiness): we are not changing canonicalization;
 * we are *covering* it so the canon stays observably stable.
 */
describe("canonicalStringify", () => {
  it("primitives serialize like JSON.stringify", () => {
    expect(canonicalStringify(null)).toBe("null");
    expect(canonicalStringify(true)).toBe("true");
    expect(canonicalStringify(false)).toBe("false");
    expect(canonicalStringify(0)).toBe("0");
    expect(canonicalStringify(1.5)).toBe("1.5");
    expect(canonicalStringify("hello")).toBe('"hello"');
  });

  it("sorts object keys lexicographically (key order independence)", () => {
    const a = canonicalStringify({ b: 1, a: 2, c: 3 });
    const b = canonicalStringify({ c: 3, a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1,"c":3}');
  });

  it("recursively sorts nested object keys", () => {
    const a = canonicalStringify({ outer: { z: 1, a: 2 } });
    const b = canonicalStringify({ outer: { a: 2, z: 1 } });
    expect(a).toBe(b);
    expect(a).toBe('{"outer":{"a":2,"z":1}}');
  });

  it("preserves array order (semantic ordering, not lexical)", () => {
    expect(canonicalStringify([3, 1, 2])).toBe("[3,1,2]");
    // Distinct from sorted order:
    expect(canonicalStringify([3, 1, 2])).not.toBe(canonicalStringify([1, 2, 3]));
  });

  it("escapes strings via JSON.stringify (quotes, backslashes, control chars)", () => {
    expect(canonicalStringify('a"b')).toBe('"a\\"b"');
    expect(canonicalStringify("line\nbreak")).toBe('"line\\nbreak"');
    expect(canonicalStringify({ "key with \"quote\"": 1 })).toBe(
      '{"key with \\"quote\\"":1}',
    );
  });

  it("nested arrays of objects: sorts each object's keys but keeps array order", () => {
    const out = canonicalStringify([
      { z: 1, a: 2 },
      { b: 3, a: 4 },
    ]);
    expect(out).toBe('[{"a":2,"z":1},{"a":4,"b":3}]');
  });

  it("is reflexive: canonicalStringify of two structurally-equal values is identical", () => {
    const v1 = {
      schemaVersion: "executionPackageSnapshot.v0",
      slots: [
        { packageTaskId: "pkgt-2", nodeId: "n-2", planTaskIds: ["plant-b", "plant-a"] },
        { packageTaskId: "pkgt-1", nodeId: "n-1", planTaskIds: ["plant-a"] },
      ],
      diagnostics: { errors: [], warnings: [{ code: "C", message: "m" }] },
    };
    const v2 = {
      diagnostics: { warnings: [{ message: "m", code: "C" }], errors: [] },
      slots: [
        { nodeId: "n-2", planTaskIds: ["plant-b", "plant-a"], packageTaskId: "pkgt-2" },
        { planTaskIds: ["plant-a"], packageTaskId: "pkgt-1", nodeId: "n-1" },
      ],
      schemaVersion: "executionPackageSnapshot.v0",
    };
    expect(canonicalStringify(v1)).toBe(canonicalStringify(v2));
  });
});

describe("sha256HexUtf8", () => {
  it("hashes a known UTF-8 string to its sha256 hex (NIST test vector)", () => {
    expect(sha256HexUtf8("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("hashes the empty string to the standard sha256 of empty input", () => {
    expect(sha256HexUtf8("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("is deterministic across repeated calls", () => {
    const s = canonicalStringify({
      schemaVersion: "generatedPlanSnapshot.v0",
      rows: [{ planTaskId: "pt-1", lineItemId: "li-1" }],
    });
    expect(sha256HexUtf8(s)).toBe(sha256HexUtf8(s));
  });

  it("composes with canonicalStringify: key order changes do not change the hash", () => {
    const a = canonicalStringify({ b: 1, a: 2 });
    const b = canonicalStringify({ a: 2, b: 1 });
    expect(sha256HexUtf8(a)).toBe(sha256HexUtf8(b));
  });

  it("composes with canonicalStringify: array order changes DO change the hash", () => {
    // Plan rows are deterministically sorted upstream; this guards against
    // an accidental "sort arrays too" change that would silently merge
    // distinct snapshots.
    const a = canonicalStringify({ rows: [{ id: "a" }, { id: "b" }] });
    const b = canonicalStringify({ rows: [{ id: "b" }, { id: "a" }] });
    expect(sha256HexUtf8(a)).not.toBe(sha256HexUtf8(b));
  });
});
