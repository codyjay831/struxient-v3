import { NextResponse } from "next/server";
import type { ActivateQuoteVersionResult } from "@/server/slice1/mutations/activate-quote-version";

type Fail = Extract<ActivateQuoteVersionResult, { ok: false }>;

/** Shared mapping for POST …/activate and sign+auto-activate failures. */
export function nextResponseForActivateQuoteFailure(result: Fail): NextResponse {
  switch (result.kind) {
    case "not_found":
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quote version not found for tenant" } },
        { status: 404 },
      );
    case "not_signed":
      return NextResponse.json(
        {
          error: {
            code: "QUOTE_VERSION_NOT_SIGNED",
            message: `Quote version must be SIGNED before activation; current status is ${result.status}.`,
          },
        },
        { status: 409 },
      );
    case "job_missing":
      return NextResponse.json(
        {
          error: {
            code: "JOB_MISSING",
            message: "No Job row for this quote's flow group; sign the version first (decisions/04).",
          },
        },
        { status: 409 },
      );
    case "missing_freeze":
      return NextResponse.json(
        {
          error: {
            code: "MISSING_FREEZE",
            message:
              "Quote version is missing frozen plan/package JSON, hashes, or pinned workflow — send (freeze) first.",
          },
        },
        { status: 409 },
      );
    case "plan_hash_mismatch":
      return NextResponse.json(
        {
          error: {
            code: "PLAN_HASH_MISMATCH",
            message: "generatedPlanSnapshot canonical hash does not match planSnapshotSha256.",
          },
        },
        { status: 409 },
      );
    case "invalid_plan_snapshot":
      return NextResponse.json(
        { error: { code: result.code, message: result.message } },
        { status: 400 },
      );
    case "plan_slot_mismatch":
      return NextResponse.json(
        {
          error: {
            code: "PLAN_PACKAGE_SLOT_MISMATCH",
            message: `Package slot ${result.packageTaskId} references planTaskId ${result.planTaskId} not present in frozen generatedPlanSnapshot.`,
            planTaskId: result.planTaskId,
            packageTaskId: result.packageTaskId,
          },
        },
        { status: 409 },
      );
    case "package_hash_mismatch":
      return NextResponse.json(
        {
          error: {
            code: "PACKAGE_HASH_MISMATCH",
            message: "executionPackageSnapshot canonical hash does not match packageSnapshotSha256.",
          },
        },
        { status: 409 },
      );
    case "invalid_package":
      return NextResponse.json({ error: { code: result.code, message: result.message } }, { status: 400 });
    case "invalid_activated_by":
      return NextResponse.json(
        {
          error: {
            code: "INVALID_ACTIVATED_BY_USER",
            message: "activatedByUserId must be a user id in this tenant (or omit to use signedBy / createdBy).",
          },
        },
        { status: 400 },
      );
    case "workflow_pin_mismatch":
      return NextResponse.json(
        { error: { code: "WORKFLOW_PIN_MISMATCH", message: result.message } },
        { status: 409 },
      );
    default:
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "Unexpected activation failure shape" } },
        { status: 500 },
      );
  }
}
