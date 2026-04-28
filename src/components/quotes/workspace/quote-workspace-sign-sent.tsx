"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";
import type {
  PortalChangeRequestOnSentSummary,
  PortalDeclinedSummary,
  SentSignTarget,
} from "@/lib/workspace/derive-workspace-sent-sign-target";

export type { PortalChangeRequestOnSentSummary, PortalDeclinedSummary, SentSignTarget };

type DeliveryRow = {
  id: string;
  deliveredAtIso: string;
  deliveryMethod: string;
  recipientDetail: string | null;
  shareTokenPreview: string;
  providerStatus: string;
  providerError: string | null;
  retryCount: number;
  isFollowUp: boolean;
};

type Props = {
  signTarget: SentSignTarget | null;
  /** Newest portal decline in history (Epic 13 + 54); shown even when a newer SENT exists. */
  portalDeclinedSummary: PortalDeclinedSummary | null;
  /** Portal change request on the current **SENT** sign target version, if any (Epic 13 + 54). */
  portalChangeRequestOnSent: PortalChangeRequestOnSentSummary | null;
  canOfficeMutate: boolean;
  /** Public site origin for copy + email links (e.g. `https://app.example.com`). */
  appOrigin: string;
  /**
   * Same-quote workspace URL with `#start-new-draft` (create draft + scope handoff).
   * When set, the portal change-request banner links staff to the existing revise path.
   */
  quoteWorkspaceRevisionSectionHref?: string | null;
};

/**
 * Office sign for the **newest SENT** row in workspace history (see `deriveNewestSentSignTarget`).
 * `POST /api/quote-versions/:id/sign` — body unused; actor from session.
 * Portal share: copy / email via comms / manual audit / regenerate token (Epic 54 follow-up).
 */
export function QuoteWorkspaceSignSent({
  signTarget,
  portalDeclinedSummary,
  portalChangeRequestOnSent,
  canOfficeMutate,
  appOrigin,
  quoteWorkspaceRevisionSectionHref = null,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "success" | "error"; title: string; message?: string; technicalDetails?: string } | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRow[] | null>(null);
  const [shareBusy, setShareBusy] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientSms, setRecipientSms] = useState("");

  const portalUrl =
    signTarget?.portalQuoteShareToken ?
      `${appOrigin.replace(/\/$/, "")}/portal/quotes/${encodeURIComponent(signTarget.portalQuoteShareToken)}`
    : "";

  const loadDeliveries = useCallback(async () => {
    if (!signTarget?.quoteVersionId) {
      setDeliveries(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(signTarget.quoteVersionId)}/portal-share/deliveries`,
        { credentials: "include" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        data?: { deliveries?: DeliveryRow[] };
      };
      if (res.ok && body.data?.deliveries) {
        setDeliveries(body.data.deliveries);
      } else {
        setDeliveries([]);
      }
    } catch {
      setDeliveries([]);
    }
  }, [signTarget?.quoteVersionId]);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  async function retryPortalDelivery(deliveryId: string) {
    if (!signTarget?.quoteVersionId || !canOfficeMutate) return;
    setShareBusy(`retry:${deliveryId}`);
    setResult(null);
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(signTarget.quoteVersionId)}/portal-share/deliveries/${encodeURIComponent(deliveryId)}/retry`,
        { method: "POST", credentials: "include" },
      );
      const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
      if (!res.ok) {
        setResult({
          kind: "error",
          title: "Retry failed",
          message: body.error?.message ?? `Server returned ${res.status}.`,
          technicalDetails: body.error?.code ?? undefined,
        });
        return;
      }
      setResult({
        kind: "success",
        title: "Delivery retried",
        message: "Provider was invoked again; check status in recent deliveries.",
      });
      await loadDeliveries();
      router.refresh();
    } catch {
      setResult({
        kind: "error",
        title: "Retry failed",
        message: "Could not reach the server.",
      });
    } finally {
      setShareBusy(null);
    }
  }

  async function runSign() {
    if (!signTarget || !canOfficeMutate) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/quote-versions/${encodeURIComponent(signTarget.quoteVersionId)}/sign`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { status?: string; signedAt?: string };
        error?: { code?: string; message?: string; activation?: unknown };
      };
      if (!res.ok) {
        const extra =
          body.error?.code === "SIGN_ROLLED_BACK_AUTO_ACTIVATE_FAILED" ?
            " (auto-start-work after approval failed; transaction rolled back — see error details in response.)"
          : "";
        setResult({
          kind: "error",
          title: "Approval not recorded",
          message: body.error?.message ?? "An error occurred while recording customer approval.",
          technicalDetails: `${body.error?.code ?? "ERROR"}: ${res.status}${extra}`,
        });
        return;
      }
      setResult({
        kind: "success",
        title: "Customer approval recorded",
        message: "This version is now signed and ready for Start work when you are ready.",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function copyPortalUrl() {
    if (!portalUrl) return;
    setShareBusy("copy");
    try {
      await navigator.clipboard.writeText(portalUrl);
      setResult({
        kind: "success",
        title: "Copied",
        message: "Full customer portal URL copied to clipboard.",
      });
    } catch {
      setResult({
        kind: "error",
        title: "Copy failed",
        message: "Clipboard unavailable; copy the path from the monospace line below.",
      });
    } finally {
      setShareBusy(null);
    }
  }

  async function sendPortalEmail() {
    if (!signTarget || !canOfficeMutate) return;
    const to = recipientEmail.trim();
    if (!to) {
      setResult({ kind: "error", title: "Email required", message: "Enter a customer email address." });
      return;
    }
    setShareBusy("email");
    setResult(null);
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(signTarget.quoteVersionId)}/portal-share/deliver`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: "EMAIL",
            recipientDetail: to,
            baseUrl: appOrigin.replace(/\/$/, ""),
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
      if (!res.ok) {
        setResult({
          kind: "error",
          title: "Send failed",
          message: body.error?.message ?? "Could not record/send portal link delivery.",
          technicalDetails: body.error?.code,
        });
        return;
      }
      setResult({
        kind: "success",
        title: "Delivery queued",
        message:
          "A delivery row was created and the configured comms provider was invoked (mock in dev). Check recent deliveries below.",
      });
      await loadDeliveries();
      router.refresh();
    } finally {
      setShareBusy(null);
    }
  }

  async function sendPortalSms() {
    if (!signTarget || !canOfficeMutate) return;
    const to = recipientSms.trim();
    if (!to) {
      setResult({ kind: "error", title: "Phone required", message: "Enter a customer phone number (E.164 if possible)." });
      return;
    }
    setShareBusy("sms");
    setResult(null);
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(signTarget.quoteVersionId)}/portal-share/deliver`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: "SMS",
            recipientDetail: to,
            baseUrl: appOrigin.replace(/\/$/, ""),
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
      if (!res.ok) {
        setResult({
          kind: "error",
          title: "SMS send failed",
          message: body.error?.message ?? "Could not record/send portal link via SMS.",
          technicalDetails: body.error?.code,
        });
        return;
      }
      setResult({
        kind: "success",
        title: "SMS delivery queued",
        message:
          "A delivery row was created and the configured comms provider was invoked (mock in dev). Check recent deliveries below.",
      });
      await loadDeliveries();
      router.refresh();
    } finally {
      setShareBusy(null);
    }
  }

  async function logManualHandoff() {
    if (!signTarget || !canOfficeMutate) return;
    setShareBusy("manual");
    setResult(null);
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(signTarget.quoteVersionId)}/portal-share/deliver`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: "MANUAL_LINK",
            recipientDetail: "manual",
            baseUrl: appOrigin.replace(/\/$/, ""),
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setResult({
          kind: "error",
          title: "Log failed",
          message: body.error?.message ?? "Could not record manual handoff.",
        });
        return;
      }
      setResult({
        kind: "success",
        title: "Manual handoff logged",
        message: "Recorded MANUAL_LINK delivery for audit (no email/SMS sent).",
      });
      await loadDeliveries();
    } finally {
      setShareBusy(null);
    }
  }

  async function regenerateToken() {
    if (!signTarget || !canOfficeMutate) return;
    if (
      !window.confirm(
        "Regenerate the customer portal link? Any previously shared URLs will stop working. You must re-share the new link.",
      )
    ) {
      return;
    }
    setShareBusy("regen");
    setResult(null);
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(signTarget.quoteVersionId)}/portal-share/regenerate`,
        { method: "POST", credentials: "include" },
      );
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setResult({
          kind: "error",
          title: "Regenerate failed",
          message: body.error?.message ?? "Could not rotate portal token.",
        });
        return;
      }
      setResult({
        kind: "success",
        title: "Portal link rotated",
        message: "A new customer portal token is active. Re-copy or re-email the link.",
      });
      await loadDeliveries();
      router.refresh();
    } finally {
      setShareBusy(null);
    }
  }

  if (!signTarget) {
    if (portalDeclinedSummary) {
      const declinedPortalUrl =
        portalDeclinedSummary.portalQuoteShareToken ?
          `${appOrigin.replace(/\/$/, "")}/portal/quotes/${encodeURIComponent(portalDeclinedSummary.portalQuoteShareToken)}`
        : null;
      return (
        <section className="mb-6 rounded border border-orange-900/35 bg-orange-950/15 p-4 text-sm">
          <h2 className="mb-1 text-sm font-medium text-orange-100">Customer declined (portal)</h2>
          <p className="text-xs text-orange-200/75">
            Version {portalDeclinedSummary.versionNumber} was declined on the portal
            {portalDeclinedSummary.portalDeclinedAtIso ?
              ` (${new Date(portalDeclinedSummary.portalDeclinedAtIso).toLocaleString()})`
            : ""}
            . Your team can see this in-product — no separate thread required for basic outcome visibility.
          </p>
          <p className="mt-3 text-xs font-medium text-orange-100/95">Reason recorded from customer</p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-orange-50/90">
            {portalDeclinedSummary.portalDeclineReason}
          </p>
          {declinedPortalUrl ? (
            <p className="mt-3 text-[11px] text-orange-200/70">
              <Link
                href={declinedPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-orange-300 underline hover:text-orange-200"
              >
                Open customer-facing confirmation (new tab)
              </Link>
            </p>
          ) : null}
          <p className="mt-3 text-[11px] text-zinc-500">
            Technical id:{" "}
            <span className="font-mono text-zinc-400">{portalDeclinedSummary.quoteVersionId}</span>
          </p>
        </section>
      );
    }
    return (
      <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/30 p-4 text-sm">
        <h2 className="mb-1 text-sm font-medium text-zinc-200">Record customer approval</h2>
        <p className="text-xs text-zinc-500">
          No sent revision is waiting on approval from this workspace view. If the customer already approved, use{" "}
          <span className="font-medium text-teal-400">Start work</span> when eligible.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/30 p-4 text-sm border-violet-900/20 bg-violet-950/5">
      <h2 className="mb-1 text-sm font-medium text-zinc-200">Record customer approval</h2>
      <p className="text-xs text-zinc-500">Formal customer approval for v{signTarget.versionNumber}.</p>

      {portalDeclinedSummary &&
      portalDeclinedSummary.quoteVersionId !== signTarget.quoteVersionId ? (
        <div className="mt-3 rounded border border-orange-900/40 bg-orange-950/20 px-3 py-2 text-xs text-orange-100/90">
          <p className="font-medium text-orange-200/95">
            v{portalDeclinedSummary.versionNumber} was declined on the portal
            {portalDeclinedSummary.portalDeclinedAtIso ?
              ` · ${new Date(portalDeclinedSummary.portalDeclinedAtIso).toLocaleString()}`
            : ""}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-orange-50/88">
            {portalDeclinedSummary.portalDeclineReason}
          </p>
        </div>
      ) : null}

      {portalChangeRequestOnSent ? (
        <div className="mt-3 rounded border border-amber-900/45 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
          <p className="font-medium text-amber-200/95">
            Customer requested changes (portal) · v{portalChangeRequestOnSent.versionNumber}
            {portalChangeRequestOnSent.portalChangeRequestedAtIso ?
              ` · ${new Date(portalChangeRequestOnSent.portalChangeRequestedAtIso).toLocaleString()}`
            : ""}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-amber-50/90">
            {portalChangeRequestOnSent.portalChangeRequestMessage}
          </p>
          {quoteWorkspaceRevisionSectionHref ? (
            <>
              <p className="mt-2 text-[11px] leading-relaxed text-amber-100/88">
                Typical office response: use <strong className="text-amber-50/95">Start a new draft</strong> to clone
                the current head, then <strong className="text-amber-50/95">add or edit line items and tasks</strong> in
                the builder before you <strong className="text-amber-50/95">prepare and send</strong> a revised
                proposal. This SENT version stays locked until a newer version is sent.
              </p>
              <p className="mt-2">
                <Link
                  href={quoteWorkspaceRevisionSectionHref}
                  className="inline-flex text-[11px] font-semibold text-amber-200 underline underline-offset-2 hover:text-amber-100"
                >
                  Jump to Start a new draft
                </Link>
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      {signTarget.portalQuoteShareToken ? (
        <div className="mt-3 rounded border border-sky-900/40 bg-sky-950/20 px-3 py-2 text-xs text-sky-100/90">
          <p className="font-medium text-sky-200/95">Customer portal (review + accept)</p>
          <p className="mt-1 text-sky-100/70">
            Share this read-only link with your customer. When they accept on the portal, we record that as{" "}
            <span className="text-sky-100/90">accepted on the customer portal</span>. Delivery uses your configured
            communications provider (may be a mock in local development).
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!shareBusy}
              onClick={() => void copyPortalUrl()}
              className="rounded border border-sky-800/60 bg-sky-950/40 px-2 py-1 text-[11px] font-medium text-sky-200 hover:bg-sky-900/50 disabled:opacity-50"
            >
              {shareBusy === "copy" ? "Copying…" : "Copy full URL"}
            </button>
            <button
              type="button"
              disabled={!!shareBusy || !canOfficeMutate}
              onClick={() => void logManualHandoff()}
              className="rounded border border-zinc-600 bg-zinc-900/60 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800/80 disabled:opacity-50"
            >
              {shareBusy === "manual" ? "Logging…" : "Log manual handoff"}
            </button>
            <button
              type="button"
              disabled={!!shareBusy || !canOfficeMutate}
              onClick={() => void regenerateToken()}
              className="rounded border border-amber-900/50 bg-amber-950/30 px-2 py-1 text-[11px] font-medium text-amber-200/90 hover:bg-amber-900/40 disabled:opacity-50"
            >
              {shareBusy === "regen" ? "Rotating…" : "Regenerate link"}
            </button>
          </div>
          <p className="mt-2">
            <Link
              href={`/portal/quotes/${encodeURIComponent(signTarget.portalQuoteShareToken)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-sky-300 hover:text-sky-200 underline"
            >
              Open customer portal (new tab)
            </Link>
          </p>
          <p className="mt-1 font-mono text-[10px] break-all text-sky-200/70">{portalUrl}</p>

          {canOfficeMutate ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="block flex-1 text-[11px]">
                <span className="text-sky-200/80">Email portal link</span>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="customer@example.com"
                  disabled={!!shareBusy}
                  className="mt-1 w-full rounded border border-sky-900/50 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
                />
              </label>
              <button
                type="button"
                disabled={!!shareBusy}
                onClick={() => void sendPortalEmail()}
                className="rounded bg-sky-800 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-sky-700 disabled:opacity-50 sm:shrink-0"
              >
                {shareBusy === "email" ? "Sending…" : "Send email"}
              </button>
            </div>
          ) : null}

          {canOfficeMutate ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="block flex-1 text-[11px]">
                <span className="text-sky-200/80">SMS portal link</span>
                <input
                  type="tel"
                  value={recipientSms}
                  onChange={(e) => setRecipientSms(e.target.value)}
                  placeholder="+15551234567"
                  disabled={!!shareBusy}
                  className="mt-1 w-full rounded border border-sky-900/50 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
                />
              </label>
              <button
                type="button"
                disabled={!!shareBusy}
                onClick={() => void sendPortalSms()}
                className="rounded border border-sky-800/60 bg-sky-950/50 px-3 py-1.5 text-[11px] font-medium text-sky-100 hover:bg-sky-900/50 disabled:opacity-50 sm:shrink-0"
              >
                {shareBusy === "sms" ? "Sending…" : "Send SMS"}
              </button>
            </div>
          ) : null}

          {deliveries && deliveries.length > 0 ? (
            <div className="mt-3 border-t border-sky-900/30 pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/80">Recent deliveries</p>
              <ul className="mt-2 space-y-2 text-[10px] text-sky-100/80">
                {deliveries.map((d) => {
                  const retrying = shareBusy === `retry:${d.id}`;
                  const statusClass =
                    d.providerStatus === "SENT" ? "text-emerald-400"
                    : d.providerStatus === "FAILED" ? "text-rose-400"
                    : d.providerStatus === "SENDING" ? "text-sky-300 animate-pulse"
                    : "text-amber-300";
                  return (
                    <li
                      key={d.id}
                      className="rounded border border-sky-900/25 bg-zinc-950/40 px-2 py-1.5 font-mono leading-relaxed"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                        <span className="text-sky-200/90">
                          {d.deliveredAtIso} · {d.deliveryMethod}
                          {d.recipientDetail ? ` · ${d.recipientDetail}` : ""} · token {d.shareTokenPreview}
                          {d.isFollowUp ? " · follow-up" : ""}
                          {typeof d.retryCount === "number" ? ` · attempts ${d.retryCount}` : ""}
                        </span>
                        <span className={`shrink-0 font-semibold uppercase tracking-tight ${statusClass}`}>
                          {d.providerStatus}
                        </span>
                      </div>
                      {d.providerError ? (
                        <p className="mt-1 text-rose-200/80 break-words" title={d.providerError}>
                          {d.providerError}
                        </p>
                      ) : null}
                      {canOfficeMutate && d.providerStatus === "FAILED" ? (
                        <button
                          type="button"
                          disabled={!!shareBusy}
                          onClick={() => void retryPortalDelivery(d.id)}
                          className="mt-1.5 rounded border border-sky-700/60 bg-sky-950/60 px-2 py-0.5 text-[10px] font-medium text-sky-200 hover:bg-sky-900/50 disabled:opacity-50"
                        >
                          {retrying ? "Retrying…" : "Retry send"}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-zinc-500">
          No portal link on file for this sent version. Contact support if the customer should have a link, or check
          Advanced (support) on this panel.
        </p>
      )}

      {!canOfficeMutate ? (
        <p className="mt-3 text-xs text-zinc-500">
          Recording customer approval requires an office session with elevated permissions.
        </p>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runSign()}
            className="rounded bg-violet-900/85 px-4 py-1.5 text-xs font-medium text-violet-50 hover:bg-violet-800/90 disabled:opacity-50 transition-colors"
          >
            {busy ? "Saving…" : "Record customer approval"}
          </button>
          <p className="mt-2 text-[11px] text-zinc-500">
            Confirming approval will move v{signTarget.versionNumber} to{" "}
            <span className="text-zinc-400 font-medium">SIGNED</span> so you can start work when ready.
          </p>
        </div>
      )}

      <div className="mt-4 border-t border-zinc-800/40 pt-3">
        <details className="text-[10px] text-zinc-600">
          <summary className="cursor-pointer font-medium hover:text-zinc-500">Advanced (support)</summary>
          <div className="mt-2 space-y-2">
            <p>
              Target: v{signTarget.versionNumber} · <span className="font-mono">{signTarget.quoteVersionId}</span>
            </p>
            <p className="text-zinc-500">
              Internal event code for portal acceptance:{" "}
              <span className="font-mono text-zinc-400">CUSTOMER_PORTAL_ACCEPTED</span>
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
              <code className="text-zinc-500">POST …/sign</code>
              <Link
                href={`/api/quote-versions/${signTarget.quoteVersionId}/lifecycle`}
                className="underline hover:text-zinc-500"
              >
                Lifecycle JSON
              </Link>
              <Link
                href={`/api/quote-versions/${signTarget.quoteVersionId}/freeze`}
                className="underline hover:text-zinc-500"
              >
                Freeze JSON
              </Link>
            </div>
            <p className="text-zinc-500 italic">
              Server records session actor and timestamp. Supports idempotency.
            </p>
          </div>
        </details>
      </div>
      {result && (
        <InternalActionResult
          kind={result.kind}
          title={result.title}
          message={result.message}
          technicalDetails={result.technicalDetails}
          nextStep={result.kind === "success" ? { label: "Start work", href: "#step-5" } : undefined}
        />
      )}
    </section>
  );
}
