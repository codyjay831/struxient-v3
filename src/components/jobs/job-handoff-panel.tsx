"use client";

import { useCallback, useState } from "react";
import type { JobHandoffApiDto } from "@/lib/job-handoff-dto";

type Props = {
  jobId: string;
  initial: JobHandoffApiDto | null;
  hasActivation: boolean;
  canOfficeMutate: boolean;
  canFieldExecute: boolean;
};

function statusStyle(status: JobHandoffApiDto["status"]): string {
  switch (status) {
    case "DRAFT":
      return "text-amber-300 bg-amber-950/30 border-amber-800/50";
    case "SENT":
      return "text-sky-300 bg-sky-950/30 border-sky-800/50";
    case "ACKNOWLEDGED":
      return "text-emerald-300 bg-emerald-950/30 border-emerald-800/50";
    default:
      return "text-zinc-400 bg-zinc-900/40 border-zinc-700/50";
  }
}

export function JobHandoffPanel({ jobId, initial, hasActivation, canOfficeMutate, canFieldExecute }: Props) {
  const [row, setRow] = useState<JobHandoffApiDto | null>(initial);
  const [briefing, setBriefing] = useState(initial?.briefingNotes ?? "");
  const [assigneesRaw, setAssigneesRaw] = useState(initial?.assignedUserIds.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/handoff`, { credentials: "include" });
    const j = (await r.json()) as { data?: JobHandoffApiDto | null; error?: { message?: string } };
    if (!r.ok) {
      setErr(j.error?.message ?? `Load failed (${r.status})`);
      return;
    }
    setRow(j.data ?? null);
    setBriefing(j.data?.briefingNotes ?? "");
    setAssigneesRaw(j.data?.assignedUserIds.join(", ") ?? "");
    setErr(null);
  }, [jobId]);

  function parseAssignees(): string[] {
    return assigneesRaw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  async function saveDraft(opts?: { manageBusy?: boolean }): Promise<boolean> {
    const manageBusy = opts?.manageBusy !== false;
    if (manageBusy) setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/handoff`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefingNotes: briefing.trim().length === 0 ? null : briefing,
          assignedUserIds: parseAssignees(),
        }),
      });
      const j = (await r.json()) as { data?: JobHandoffApiDto | null; error?: { message?: string } };
      if (!r.ok) {
        setErr(j.error?.message ?? `Save failed (${r.status})`);
        return false;
      }
      if (j.data) {
        setRow(j.data);
      }
      return true;
    } finally {
      if (manageBusy) setBusy(false);
    }
  }

  async function sendHandoff(opts?: { manageBusy?: boolean }): Promise<boolean> {
    const manageBusy = opts?.manageBusy !== false;
    if (manageBusy) setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/handoff/send`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json()) as { data?: JobHandoffApiDto | null; error?: { message?: string } };
      if (!r.ok) {
        setErr(j.error?.message ?? `Send failed (${r.status})`);
        return false;
      }
      if (j.data) setRow(j.data);
      return true;
    } finally {
      if (manageBusy) setBusy(false);
    }
  }

  async function saveAndSend() {
    setBusy(true);
    setErr(null);
    try {
      if (!(await saveDraft({ manageBusy: false }))) return;
      await sendHandoff({ manageBusy: false });
    } finally {
      setBusy(false);
    }
  }

  async function acknowledge() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/handoff/acknowledge`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json()) as { data?: JobHandoffApiDto | null; error?: { message?: string } };
      if (!r.ok) {
        setErr(j.error?.message ?? `Acknowledge failed (${r.status})`);
        return;
      }
      if (j.data) setRow(j.data);
    } finally {
      setBusy(false);
    }
  }

  if (!hasActivation) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 mb-8" aria-labelledby="handoff-heading">
        <h2 id="handoff-heading" className="text-sm font-bold uppercase tracking-wider text-zinc-500">
          Field handoff
        </h2>
        <p className="text-xs text-zinc-600 mt-2">
          Briefing and acknowledgment unlock after at least one flow is activated for this job.
        </p>
      </section>
    );
  }

  const displayStatus = row?.status ?? "DRAFT";
  const isDraft = displayStatus === "DRAFT";
  const isAck = displayStatus === "ACKNOWLEDGED";

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 mb-8" aria-labelledby="handoff-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 id="handoff-heading" className="text-sm font-bold uppercase tracking-wider text-zinc-500">
          Field handoff
        </h2>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusStyle(displayStatus)}`}
        >
          {displayStatus}
        </span>
      </div>
      <p className="text-xs text-zinc-600 mb-4 leading-relaxed">
        Office briefing for field execution — <span className="text-zinc-500">does not change frozen scope</span>.
        Planning-only notes; not a dispatch board. Notifications are deferred (Epic 56).
      </p>

      {err ? (
        <div className="mb-3 rounded border border-rose-900/50 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">
          {err}
        </div>
      ) : null}

      {!isAck ? (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Briefing</span>
            <textarea
              value={briefing}
              onChange={(e) => setBriefing(e.target.value)}
              disabled={!canOfficeMutate || !isDraft || busy}
              rows={5}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 disabled:opacity-50"
              placeholder="Site access, hazards, customer expectations…"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Assignee user IDs (comma-separated, optional)
            </span>
            <input
              type="text"
              value={assigneesRaw}
              onChange={(e) => setAssigneesRaw(e.target.value)}
              disabled={!canOfficeMutate || !isDraft || busy}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-mono text-zinc-200 disabled:opacity-50"
              placeholder="cuid1, cuid2 …  (empty = any field-capable user may acknowledge)"
            />
          </label>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-300 whitespace-pre-wrap">
          {row?.briefingNotes?.trim() ? row.briefingNotes : <span className="text-zinc-600 italic">No briefing text.</span>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {canOfficeMutate && isDraft ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => saveDraft()}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveAndSend()}
              className="rounded-lg border border-sky-800/50 bg-sky-900/30 px-3 py-1.5 font-medium text-sky-300 hover:bg-sky-900/50 disabled:opacity-50"
            >
              Save &amp; send
            </button>
            {row ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void sendHandoff()}
                className="rounded-lg border border-sky-700 bg-sky-800/40 px-3 py-1.5 font-medium text-sky-200 hover:bg-sky-800/60 disabled:opacity-50"
              >
                Send to field
              </button>
            ) : null}
          </>
        ) : null}
        {canFieldExecute && displayStatus === "SENT" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => acknowledge()}
            className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-1.5 font-medium text-emerald-300 hover:bg-emerald-950/50 disabled:opacity-50"
          >
            Acknowledge
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => refresh()}
          className="rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {row ? (
        <dl className="mt-4 grid gap-2 text-[11px] text-zinc-500">
          <div>
            <dt className="font-bold uppercase tracking-tight text-zinc-600">Created</dt>
            <dd>
              {row.createdByLabel ?? row.createdByUserId} · {row.createdAt}
            </dd>
          </div>
          {row.sentAt ? (
            <div>
              <dt className="font-bold uppercase tracking-tight text-zinc-600">Sent</dt>
              <dd>
                {(row.sentByLabel ?? row.sentByUserId) ?? "—"} · {row.sentAt}
              </dd>
            </div>
          ) : null}
          {row.acknowledgedAt ? (
            <div>
              <dt className="font-bold uppercase tracking-tight text-zinc-600">Acknowledged</dt>
              <dd>
                {(row.acknowledgedByLabel ?? row.acknowledgedByUserId) ?? "—"} · {row.acknowledgedAt}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}
