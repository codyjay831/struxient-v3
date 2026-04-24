"use client";
import {
  QuoteWorkspaceChangeOrderDto,
  shouldShowPortalDeclineVoidExplanation,
} from "@/server/slice1/reads/quote-workspace-reads";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";

type Props = {
  quoteId: string;
  jobId: string | null;
  changeOrders: QuoteWorkspaceChangeOrderDto[];
  canOfficeMutate: boolean;
};

function canApplyChangeOrder(co: QuoteWorkspaceChangeOrderDto): boolean {
  if (co.status === "APPLIED" || co.status === "VOID") return false;
  if (co.status === "PENDING_CUSTOMER") return false;
  return co.status === "READY_TO_APPLY" || co.draftQuoteVersionStatus === "SIGNED";
}

export function QuoteWorkspaceChangeOrders({ quoteId, jobId, changeOrders, canOfficeMutate }: Props) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const createCO = async () => {
    if (!jobId) return;
    setIsCreating(true);
    setResult(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/change-orders`, {
        method: "POST",
        body: JSON.stringify({ reason: "Manual Change Order" }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ ok: true, message: "Change Order created. Redirecting to draft..." });
        // In a real app, we'd redirect to the scope editor for the new version.
        // For now, just refresh the workspace.
        setTimeout(() => {
            router.refresh();
            setResult(null);
        }, 1500);
      } else {
        setResult({ ok: false, message: `Failed: ${data.kind}` });
      }
    } catch (e) {
      setResult({ ok: false, message: "Error creating Change Order" });
    } finally {
      setIsCreating(false);
    }
  };

  const applyCO = async (coId: string) => {
    setResult(null);
    try {
      const res = await fetch(`/api/change-orders/${coId}/apply`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ ok: true, message: "Change Order applied successfully!" });
        router.refresh();
      } else {
        setResult({ ok: false, message: `Apply failed: ${data.kind}${data.unsatisfiedGateIds ? ` (Unsatisfied Gates: ${data.unsatisfiedGateIds.join(", ")})` : ""}` });
      }
    } catch (e) {
      setResult({ ok: false, message: "Error applying Change Order" });
    }
  };

  if (!jobId && changeOrders.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-800/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Change Orders</h3>
        {canOfficeMutate && jobId && (
          <button
            onClick={createCO}
            disabled={isCreating || changeOrders.some(co => co.status === "DRAFT")}
            className="text-xs bg-zinc-100 text-zinc-900 px-2 py-1 rounded font-medium hover:bg-zinc-200 disabled:opacity-50"
          >
            {isCreating ? "Creating..." : "New CO"}
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {result ? (
          <InternalActionResult
            kind={result.ok ? "success" : "error"}
            title={result.ok ? "Success" : "Something went wrong"}
            message={result.message}
          />
        ) : null}

        {changeOrders.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">No change orders recorded for this job.</p>
        ) : (
          <div className="space-y-3">
            {changeOrders.map((co) => (
              <div key={co.id} className="text-xs border border-zinc-800 rounded p-2 bg-zinc-950/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] text-zinc-500">{co.id.slice(-8)}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      co.status === "APPLIED"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : co.status === "VOID"
                          ? "bg-zinc-500/10 text-zinc-400"
                          : co.status === "PENDING_CUSTOMER"
                            ? "bg-amber-500/10 text-amber-400"
                            : co.status === "READY_TO_APPLY"
                              ? "bg-sky-500/10 text-sky-300"
                              : "bg-blue-500/10 text-blue-400"
                    }`}
                  >
                    {co.status}
                  </span>
                </div>
                <p className="text-zinc-300 mb-2">{co.reason}</p>
                {shouldShowPortalDeclineVoidExplanation(co) ? (
                  <div className="mb-2 rounded border border-orange-900/40 bg-orange-950/25 px-2.5 py-2 text-[11px] leading-relaxed text-orange-100/95">
                    <p className="font-semibold text-orange-200/95">Customer declined (portal)</p>
                    <p className="mt-1 text-orange-100/85">
                      This change order was closed because the customer declined the linked proposal draft on the
                      portal — not because the office voided it manually from this list.
                    </p>
                    {co.draftQuotePortalDeclinedAtIso ? (
                      <p className="mt-1.5 text-orange-200/75">
                        Declined {new Date(co.draftQuotePortalDeclinedAtIso).toLocaleString()}
                      </p>
                    ) : null}
                    {co.draftQuotePortalDeclineReason ? (
                      <>
                        <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-orange-200/90">
                          Reason recorded from customer
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-orange-50/90">{co.draftQuotePortalDeclineReason}</p>
                      </>
                    ) : (
                      <p className="mt-2 text-orange-200/70">No decline reason text was stored on the draft revision.</p>
                    )}
                  </div>
                ) : null}
                {co.status === "PENDING_CUSTOMER" ? (
                  <p className="mb-2 text-[10px] leading-relaxed text-amber-200/85">
                    Awaiting customer acceptance on the sent proposal link.
                    {co.draftQuotePortalShareToken ? (
                      <>
                        {" "}
                        <a
                          href={`/portal/quotes/${encodeURIComponent(co.draftQuotePortalShareToken)}`}
                          className="text-amber-300 underline hover:text-amber-200"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open customer portal
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                {co.status === "READY_TO_APPLY" ? (
                  <p className="mb-2 text-[10px] text-sky-200/80">
                    Customer acceptance recorded — safe to apply when operations are ready.
                  </p>
                ) : null}
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Created {new Date(co.createdAt).toLocaleDateString()}</span>
                  {canOfficeMutate && canApplyChangeOrder(co) ? (
                    <button
                      type="button"
                      onClick={() => applyCO(co.id)}
                      className="text-blue-400 hover:text-blue-300 font-medium"
                    >
                      Apply now
                    </button>
                  ) : null}
                  {co.status === "APPLIED" ? (
                    <span>Applied {new Date(co.appliedAt!).toLocaleDateString()}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
