"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";
import type {
  JobShellOperationalHoldApiDto,
  JobShellPaymentGateApiDto,
} from "@/lib/job-shell-dto";

export type JobBlockersRuntimeTaskOption = {
  id: string;
  displayTitle: string;
  quoteNumber: string;
};

type Props = {
  jobId: string;
  paymentGates: JobShellPaymentGateApiDto[];
  activeOperationalHolds: JobShellOperationalHoldApiDto[];
  runtimeTaskOptions: JobBlockersRuntimeTaskOption[];
  canOfficeMutate: boolean;
};

function holdScopeLabel(
  hold: JobShellOperationalHoldApiDto,
  options: JobBlockersRuntimeTaskOption[],
): string {
  if (hold.runtimeTaskId == null) return "Job-wide (all runtime tasks on this job)";
  const row = options.find((o) => o.id === hold.runtimeTaskId);
  if (!row) return `Task ${hold.runtimeTaskId.slice(0, 8)}…`;
  return `Task: ${row.displayTitle} (${row.quoteNumber})`;
}

export function JobBlockersConsole({
  jobId,
  paymentGates,
  activeOperationalHolds,
  runtimeTaskOptions,
  canOfficeMutate,
}: Props) {
  const router = useRouter();
  const [result, setResult] = useState<{ kind: "success" | "error"; title: string; message?: string } | null>(
    null,
  );
  const [busyGateId, setBusyGateId] = useState<string | null>(null);
  const [busyHoldId, setBusyHoldId] = useState<string | null>(null);
  const [busyCreate, setBusyCreate] = useState(false);
  const [newHoldReason, setNewHoldReason] = useState("");
  const [newHoldTaskId, setNewHoldTaskId] = useState<string>("");

  const taskSelectDisabled = useMemo(() => runtimeTaskOptions.length === 0, [runtimeTaskOptions.length]);

  async function satisfyGate(gateId: string) {
    setBusyGateId(gateId);
    setResult(null);
    try {
      const res = await fetch(`/api/payment-gates/${encodeURIComponent(gateId)}/satisfy`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setResult({
          kind: "error",
          title: "Could not satisfy gate",
          message: body.error?.message ?? "An unexpected error occurred.",
        });
        return;
      }
      setResult({
        kind: "success",
        title: "Gate satisfied",
        message: "Payment condition cleared. Targeted tasks can start when other rules allow.",
      });
      router.refresh();
    } finally {
      setBusyGateId(null);
    }
  }

  async function releaseHold(holdId: string) {
    setBusyHoldId(holdId);
    setResult(null);
    try {
      const res = await fetch(`/api/holds/${encodeURIComponent(holdId)}/release`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setResult({
          kind: "error",
          title: "Could not release hold",
          message: body.error?.message ?? "An unexpected error occurred.",
        });
        return;
      }
      setResult({
        kind: "success",
        title: "Hold released",
        message: "Operational hold is no longer blocking starts.",
      });
      router.refresh();
    } finally {
      setBusyHoldId(null);
    }
  }

  async function createHold() {
    const reason = newHoldReason.trim();
    if (reason.length === 0) {
      setResult({
        kind: "error",
        title: "Reason required",
        message: "Enter a short reason before creating a hold.",
      });
      return;
    }

    setBusyCreate(true);
    setResult(null);
    try {
      const runtimeTaskId =
        newHoldTaskId === "" || taskSelectDisabled ? null : newHoldTaskId;
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/holds`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, runtimeTaskId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setResult({
          kind: "error",
          title: "Could not create hold",
          message: body.error?.message ?? "An unexpected error occurred.",
        });
        return;
      }
      setNewHoldReason("");
      setNewHoldTaskId("");
      setResult({
        kind: "success",
        title: "Hold created",
        message: runtimeTaskId
          ? "Task-scoped operational hold is active."
          : "Job-wide operational hold is active.",
      });
      router.refresh();
    } finally {
      setBusyCreate(false);
    }
  }

  const satisfiedGateCount = paymentGates.filter((g) => g.status === "SATISFIED").length;

  return (
    <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
      <div className="mb-6 border-b border-zinc-800 pb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Job blockers</h2>
        <p className="text-xs text-zinc-600 mt-1">
          Payment gates and operational holds that can block field task starts. Satisfy gates or release holds here
          after conditions are met.
        </p>
      </div>

      <div className="space-y-8">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Payment gates</h3>
            {paymentGates.length > 0 ? (
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-bold text-zinc-400 border border-zinc-700">
                {satisfiedGateCount} / {paymentGates.length} satisfied
              </span>
            ) : null}
          </div>
          {paymentGates.length === 0 ? (
            <p className="text-sm text-zinc-500">No payment gates on this job.</p>
          ) : (
            <div className="space-y-3">
              {paymentGates.map((gate) => (
                <div
                  key={gate.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    gate.status === "SATISFIED"
                      ? "bg-emerald-950/10 border-emerald-900/30"
                      : "bg-amber-950/10 border-amber-900/30"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-semibold ${
                            gate.status === "SATISFIED" ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          {gate.title}
                        </span>
                        <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-tighter">
                          {gate.targetCount} targets
                        </span>
                      </div>
                      {gate.status === "SATISFIED" && gate.satisfiedAt ? (
                        <p className="text-[10px] text-emerald-500/70 mt-0.5">
                          Satisfied at {new Date(gate.satisfiedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                    {gate.status === "UNSATISFIED" ? (
                      <button
                        type="button"
                        disabled={busyGateId === gate.id || !canOfficeMutate}
                        onClick={() => void satisfyGate(gate.id)}
                        className="shrink-0 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-1 text-[10px] font-bold text-zinc-300 transition-colors border border-zinc-700"
                      >
                        {busyGateId === gate.id ? "Processing…" : "Satisfy gate"}
                      </button>
                    ) : (
                      <div className="shrink-0 flex items-center gap-1.5 text-emerald-500">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Unlocked</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!canOfficeMutate && paymentGates.some((g) => g.status === "UNSATISFIED") ? (
            <p className="mt-3 text-[10px] text-zinc-600 italic">Sign in as office staff to satisfy gates.</p>
          ) : null}
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Operational holds</h3>
          {activeOperationalHolds.length === 0 ? (
            <p className="text-sm text-zinc-500">No active operational holds.</p>
          ) : (
            <ul className="space-y-3">
              {activeOperationalHolds.map((hold) => (
                <li
                  key={hold.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 flex flex-wrap items-start justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-mono text-zinc-500">{hold.holdType}</p>
                    <p className="text-xs text-zinc-200 leading-relaxed">{hold.reason}</p>
                    <p className="text-[10px] text-zinc-500">{holdScopeLabel(hold, runtimeTaskOptions)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busyHoldId === hold.id || !canOfficeMutate}
                    onClick={() => void releaseHold(hold.id)}
                    className="shrink-0 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-1 text-[10px] font-bold text-zinc-300 border border-zinc-700"
                  >
                    {busyHoldId === hold.id ? "Releasing…" : "Release hold"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canOfficeMutate ? (
          <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950/30 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Create hold</h3>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
              Reason
            </label>
            <textarea
              value={newHoldReason}
              onChange={(e) => setNewHoldReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-700 focus:outline-none"
              placeholder="e.g. Weather delay, permit pending, customer request to pause…"
            />
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mt-3 mb-1">
              Scope
            </label>
            <select
              value={newHoldTaskId}
              onChange={(e) => setNewHoldTaskId(e.target.value)}
              disabled={taskSelectDisabled}
              className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50"
            >
              <option value="">Job-wide (all runtime tasks)</option>
              {runtimeTaskOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.quoteNumber} — {t.displayTitle}
                </option>
              ))}
            </select>
            {taskSelectDisabled ? (
              <p className="mt-2 text-[10px] text-zinc-600">No runtime tasks yet — only job-wide holds are available.</p>
            ) : null}
            <button
              type="button"
              disabled={busyCreate}
              onClick={() => void createHold()}
              className="mt-4 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 border border-rose-800/50 px-4 py-2 text-xs font-bold text-rose-100 disabled:opacity-50"
            >
              {busyCreate ? "Creating…" : "Create operational hold"}
            </button>
          </div>
        ) : null}
      </div>

      {result ? (
        <div className="mt-6">
          <InternalActionResult kind={result.kind} title={result.title} message={result.message} />
        </div>
      ) : null}
    </section>
  );
}
