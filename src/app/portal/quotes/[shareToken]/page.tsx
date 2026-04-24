import { getPrisma } from "@/server/db/prisma";
import { getQuotePortalPresentationByShareToken } from "@/server/slice1/reads/quote-portal-reads";
import { InternalNotFoundState } from "@/components/internal/internal-state-feedback";
import { PortalQuoteDeclineForm } from "@/components/portal/portal-quote-decline-form";
import { PortalQuoteRequestChangesForm } from "@/components/portal/portal-quote-request-changes-form";
import { PortalQuoteSignForm } from "@/components/portal/portal-quote-sign-form";

type Props = { params: Promise<{ shareToken: string }> };

export const dynamic = "force-dynamic";

/**
 * Customer-facing quote review (frozen plan titles) + portal self-service sign (Epic 54).
 * Access is **only** via `QuoteVersion.portalQuoteShareToken` (issued when the office sends the version).
 */
export default async function PortalQuoteReviewPage({ params }: Props) {
  const { shareToken } = await params;
  const model = await getQuotePortalPresentationByShareToken(getPrisma(), { shareToken });

  if (!model) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <InternalNotFoundState
            title="Quote link unavailable"
            message="This link is invalid, or the quote is not open for review. Please contact your representative for a current proposal link."
            backLink={{ href: "/", label: "Home" }}
          />
        </div>
      </div>
    );
  }

  const isSigned = model.status === "SIGNED";
  const isDeclined = model.status === "DECLINED";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-2xl px-4 py-10">
        <header className="border-b border-zinc-800 pb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Quote proposal</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-50">Quote #{model.quoteNumber}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Prepared for <span className="text-zinc-200">{model.customerName}</span> · Version{" "}
            {model.versionNumber}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Sent {new Date(model.sentAtIso).toLocaleString()}</p>
          {isSigned ? (
            <p className="mt-3 text-sm text-emerald-400/90">
              This quote has already been accepted
              {model.portalSignerLabel ? ` (${model.portalSignerLabel})` : ""}.
            </p>
          ) : null}
          {isDeclined && model.portalDeclineReason ? (
            <div className="mt-3 rounded border border-orange-900/40 bg-orange-950/25 px-3 py-2 text-sm text-orange-100/95">
              <p className="font-medium text-orange-200/95">You declined this proposal</p>
              {model.portalDeclinedAtIso ? (
                <p className="mt-1 text-xs text-orange-200/70">
                  Recorded {new Date(model.portalDeclinedAtIso).toLocaleString()}
                </p>
              ) : null}
              <p className="mt-2 text-xs leading-relaxed text-orange-100/90">
                <span className="font-semibold text-orange-200/95">Reason you provided:</span> {model.portalDeclineReason}
              </p>
            </div>
          ) : null}
        </header>

        {model.changeOrderSummary ? (
          <section className="mt-8 rounded-lg border border-amber-900/50 bg-amber-950/25 px-4 py-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/90">
              Change order proposal
            </h2>
            <p className="mt-2 text-sm text-amber-100/95">{model.changeOrderSummary.reason}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-amber-200/75">
              The scope list below is the frozen plan from this proposal version. Accepting applies only
              to this version, not other quote history.
            </p>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-200">Scope summary (frozen at send)</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Listed work reflects the office-approved plan snapshot; it is not a live editor.
          </p>
          {model.planRows.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No plan rows were included in the sent snapshot.</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
              {model.planRows.map((r) => (
                <li key={r.planTaskId} className="px-3 py-2.5 text-sm">
                  <span className="text-zinc-100">{r.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!isSigned && !isDeclined ? (
          <>
            {model.portalChangeRequestedAtIso && model.portalChangeRequestMessage ? (
              <section className="mt-8 rounded-lg border border-amber-900/45 bg-amber-950/25 px-4 py-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/90">
                  Change request on file
                </h2>
                <p className="mt-2 text-xs text-amber-200/75">
                  Submitted {new Date(model.portalChangeRequestedAtIso).toLocaleString()}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-amber-50/95 whitespace-pre-wrap">
                  {model.portalChangeRequestMessage}
                </p>
                <p className="mt-3 text-[11px] text-amber-200/65">
                  You can submit an updated message below, or sign if this version already works for you.
                </p>
              </section>
            ) : null}
            <PortalQuoteSignForm shareToken={shareToken} />
            <PortalQuoteRequestChangesForm shareToken={shareToken} />
            <PortalQuoteDeclineForm shareToken={shareToken} />
          </>
        ) : null}
      </main>
    </div>
  );
}
