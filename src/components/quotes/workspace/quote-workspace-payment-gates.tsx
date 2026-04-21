"use client";

import { QuoteWorkspacePaymentGateDto } from "@/server/slice1/reads/quote-workspace-reads";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";

type Props = {
  quoteId: string;
  gates: QuoteWorkspacePaymentGateDto[];
  canOfficeMutate: boolean;
};

export function QuoteWorkspacePaymentGates({ quoteId, gates, canOfficeMutate }: Props) {
  const router = useRouter();
  const [busyGateId, setBusyGateId] = useState<string | null>(null);
  const [result, setResult] = useState<{ kind: "success" | "error"; title: string; message?: string } | null>(null);

  if (gates.length === 0) return null;

  async function satisfyGate(gateId: string) {
    setBusyGateId(gateId);
    setResult(null);
    try {
      const res = await fetch(`/api/payment-gates/${gateId}/satisfy`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setResult({
          kind: "error",
          title: "Action failed",
          message: body.error?.message ?? "An unexpected error occurred.",
        });
        return;
      }
      setResult({
        kind: "success",
        title: "Gate satisfied",
        message: "Payment condition has been cleared. Associated tasks are now unlocked.",
      });
      router.refresh();
    } finally {
      setBusyGateId(null);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
      <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Commercial Controls</h3>
          <p className="text-xs text-zinc-600 mt-1">Payment gates that block field execution.</p>
        </div>
        <span className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-bold text-zinc-400 border border-zinc-700">
          {gates.filter(g => g.status === "SATISFIED").length} / {gates.length} SATISFIED
        </span>
      </div>

      <div className="space-y-3">
        {gates.map((gate) => (
          <div 
            key={gate.id}
            className={`rounded-lg border p-4 transition-colors ${
              gate.status === "SATISFIED" 
                ? "bg-emerald-950/10 border-emerald-900/30" 
                : "bg-amber-950/10 border-amber-900/30"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${
                    gate.status === "SATISFIED" ? "text-emerald-400" : "text-amber-400"
                  }`}>
                    {gate.title}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-tighter">
                    {gate.targetCount} targets
                  </span>
                </div>
                {gate.status === "SATISFIED" && gate.satisfiedAt && (
                  <p className="text-[10px] text-emerald-500/70 mt-0.5">
                    Satisfied at {new Date(gate.satisfiedAt).toLocaleString()}
                  </p>
                )}
              </div>

              {gate.status === "UNSATISFIED" && (
                <button
                  type="button"
                  disabled={busyGateId === gate.id || !canOfficeMutate}
                  onClick={() => void satisfyGate(gate.id)}
                  className="shrink-0 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-1 text-[10px] font-bold text-zinc-300 transition-colors border border-zinc-700"
                >
                  {busyGateId === gate.id ? "Processing..." : "Satisfy Gate"}
                </button>
              )}
              
              {gate.status === "SATISFIED" && (
                <div className="shrink-0 flex items-center gap-1.5 text-emerald-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Unlocked</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {result && (
        <div className="mt-4">
          <InternalActionResult
            kind={result.kind}
            title={result.title}
            message={result.message}
          />
        </div>
      )}

      {!canOfficeMutate && gates.some(g => g.status === "UNSATISFIED") && (
        <p className="mt-4 text-[10px] text-zinc-600 italic">
          Sign in as office_admin to satisfy gates.
        </p>
      )}
    </section>
  );
}
