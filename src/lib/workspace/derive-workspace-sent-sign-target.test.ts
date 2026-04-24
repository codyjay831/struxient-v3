import { describe, expect, it } from "vitest";
import {
  deriveNewestPortalDeclinedSummary,
  deriveNewestSentSignTarget,
  derivePortalChangeRequestOnSentTarget,
  type SentSignTarget,
  type VersionRowForPortalChangeRequest,
  type VersionRowForPortalDecline,
  type VersionRowForSign,
} from "./derive-workspace-sent-sign-target";

describe("deriveNewestSentSignTarget", () => {
  it("returns null when no SENT", () => {
    expect(deriveNewestSentSignTarget([])).toBeNull();
    expect(
      deriveNewestSentSignTarget([
        { id: "a", versionNumber: 2, status: "DRAFT" },
        { id: "b", versionNumber: 1, status: "SIGNED" },
      ]),
    ).toBeNull();
  });

  it("returns newest SENT when head is DRAFT", () => {
    const rows: VersionRowForSign[] = [
      { id: "qv3", versionNumber: 3, status: "DRAFT" },
      { id: "qv2", versionNumber: 2, status: "SENT" },
      { id: "qv1", versionNumber: 1, status: "SIGNED" },
    ];
    expect(deriveNewestSentSignTarget(rows)).toEqual({
      quoteVersionId: "qv2",
      versionNumber: 2,
      portalQuoteShareToken: null,
    });
  });

  it("returns sole SENT when it is the head row", () => {
    const rows: VersionRowForSign[] = [
      { id: "qv2", versionNumber: 2, status: "SENT" },
      { id: "qv1", versionNumber: 1, status: "SIGNED" },
    ];
    expect(deriveNewestSentSignTarget(rows)).toEqual({
      quoteVersionId: "qv2",
      versionNumber: 2,
      portalQuoteShareToken: null,
    });
  });

  it("when multiple SENT (anomaly), picks first in list (highest versionNumber)", () => {
    const rows: VersionRowForSign[] = [
      { id: "qv3", versionNumber: 3, status: "SENT" },
      { id: "qv2", versionNumber: 2, status: "SENT" },
    ];
    expect(deriveNewestSentSignTarget(rows)?.quoteVersionId).toBe("qv3");
  });
});

describe("deriveNewestPortalDeclinedSummary", () => {
  it("returns null when no DECLINED with reason", () => {
    expect(deriveNewestPortalDeclinedSummary([])).toBeNull();
    const rows: VersionRowForPortalDecline[] = [
      { id: "a", versionNumber: 2, status: "SENT", portalDeclinedAt: null, portalDeclineReason: null },
    ];
    expect(deriveNewestPortalDeclinedSummary(rows)).toBeNull();
  });

  it("returns newest DECLINED in newest-first order", () => {
    const rows: VersionRowForPortalDecline[] = [
      { id: "qv3", versionNumber: 3, status: "DRAFT", portalDeclinedAt: null, portalDeclineReason: null },
      {
        id: "qv2",
        versionNumber: 2,
        status: "DECLINED",
        portalQuoteShareToken: "tok2",
        portalDeclinedAt: "2026-04-21T01:00:00.000Z",
        portalDeclineReason: "Too expensive",
      },
      {
        id: "qv1",
        versionNumber: 1,
        status: "DECLINED",
        portalDeclinedAt: "2026-04-20T01:00:00.000Z",
        portalDeclineReason: "Older decline",
      },
    ];
    expect(deriveNewestPortalDeclinedSummary(rows)).toEqual({
      quoteVersionId: "qv2",
      versionNumber: 2,
      portalDeclinedAtIso: "2026-04-21T01:00:00.000Z",
      portalDeclineReason: "Too expensive",
      portalQuoteShareToken: "tok2",
    });
  });
});

describe("derivePortalChangeRequestOnSentTarget", () => {
  const signTarget: SentSignTarget = {
    quoteVersionId: "qv-sent",
    versionNumber: 2,
    portalQuoteShareToken: "tok",
  };

  it("returns null when signTarget is null", () => {
    const rows: VersionRowForPortalChangeRequest[] = [
      {
        id: "qv-sent",
        versionNumber: 2,
        status: "SENT",
        portalChangeRequestedAt: "2026-04-21T12:00:00.000Z",
        portalChangeRequestMessage: "Hi",
      },
    ];
    expect(derivePortalChangeRequestOnSentTarget(null, rows)).toBeNull();
  });

  it("returns null when the sent row has no change request fields", () => {
    const rows: VersionRowForPortalChangeRequest[] = [
      {
        id: "qv-sent",
        versionNumber: 2,
        status: "SENT",
        portalChangeRequestedAt: null,
        portalChangeRequestMessage: null,
      },
    ];
    expect(derivePortalChangeRequestOnSentTarget(signTarget, rows)).toBeNull();
  });

  it("returns summary when the sign-target version has a persisted change request", () => {
    const rows: VersionRowForPortalChangeRequest[] = [
      {
        id: "qv-sent",
        versionNumber: 2,
        status: "SENT",
        portalChangeRequestedAt: "2026-04-21T12:00:00.000Z",
        portalChangeRequestMessage: "  Please remove gutters.  ",
      },
    ];
    expect(derivePortalChangeRequestOnSentTarget(signTarget, rows)).toEqual({
      quoteVersionId: "qv-sent",
      versionNumber: 2,
      portalChangeRequestedAtIso: "2026-04-21T12:00:00.000Z",
      portalChangeRequestMessage: "Please remove gutters.",
    });
  });
});
