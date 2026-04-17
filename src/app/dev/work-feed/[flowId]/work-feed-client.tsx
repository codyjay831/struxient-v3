"use client";

import { useCallback, useState } from "react";
import type { FlowExecutionApiDto } from "@/lib/flow-execution-dto";

type Props = {
  flowId: string;
  initialData: FlowExecutionApiDto;
  /** When false (e.g. READ_ONLY role), Start/Complete are disabled — API would return 403. */
  canExecuteTasks: boolean;
};

export function WorkFeedClient({ flowId, initialData, canExecuteTasks }: Props) {
  const [data, setData] = useState<FlowExecutionApiDto>(initialData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/flows/${encodeURIComponent(flowId)}`, { credentials: "include" });
    const j = (await r.json()) as { data?: FlowExecutionApiDto; error?: { message?: string } };
    if (!r.ok) {
      setError(j.error?.message ?? `GET failed (${r.status})`);
      return;
    }
    if (j.data) {
      setData(j.data);
      setError(null);
    }
  }, [flowId]);

  async function postJson(url: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: null }),
      });
      const j = (await r.json()) as { error?: { code?: string; message?: string } };
      if (!r.ok) {
        setError(j.error?.message ?? j.error?.code ?? `Request failed (${r.status})`);
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!canExecuteTasks ? (
        <p className="rounded border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
          Your role is read-only; Start/Complete are disabled (would return 403 from the API).
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          Flow <code className="text-zinc-400">{data.flow.id}</code> · job{" "}
          <code className="text-zinc-400">{data.flow.jobId}</code> · requests use the signed-in session (cookies).
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => refresh()}
          className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
      ) : null}

      <ul className="space-y-3">
        {data.workItems.map((item, i) => {
          const base = "rounded-lg border border-zinc-800 bg-zinc-900/60 p-4";
          if (item.kind === "SKELETON") {
            const startUrl = `/api/flows/${encodeURIComponent(flowId)}/skeleton-tasks/${encodeURIComponent(item.skeletonTaskId)}/start`;
            const completeUrl = `/api/flows/${encodeURIComponent(flowId)}/skeleton-tasks/${encodeURIComponent(item.skeletonTaskId)}/complete`;
            return (
              <li key={`sk-${item.skeletonTaskId}-${i}`} className={base}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-violet-400">Skeleton</span>
                    <h2 className="text-sm font-medium text-zinc-100">{item.displayTitle}</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      node <code className="text-zinc-400">{item.nodeId}</code> ·{" "}
                      <code className="text-zinc-400">{item.skeletonTaskId}</code>
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      execution: <span className="text-zinc-300">{item.execution.status}</span>
                      {item.actionability.start.reasons.length > 0 ? (
                        <span className="ml-2 text-zinc-600">
                          start blocked: {item.actionability.start.reasons.join(", ")}
                        </span>
                      ) : null}
                      {item.actionability.complete.reasons.length > 0 ? (
                        <span className="ml-2 text-zinc-600">
                          complete blocked: {item.actionability.complete.reasons.join(", ")}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy || !canExecuteTasks || !item.actionability.start.canStart}
                      title={item.actionability.start.reasons.join(", ") || "Start"}
                      onClick={() => postJson(startUrl)}
                      className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Start
                    </button>
                    <button
                      type="button"
                      disabled={busy || !canExecuteTasks || !item.actionability.complete.canComplete}
                      title={item.actionability.complete.reasons.join(", ") || "Complete"}
                      onClick={() => postJson(completeUrl)}
                      className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Complete
                    </button>
                  </div>
                </div>
              </li>
            );
          }
          const startUrl = `/api/runtime-tasks/${encodeURIComponent(item.runtimeTaskId)}/start`;
          const completeUrl = `/api/runtime-tasks/${encodeURIComponent(item.runtimeTaskId)}/complete`;
          return (
            <li key={`rt-${item.runtimeTaskId}-${i}`} className={base}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-sky-400">Runtime</span>
                  <h2 className="text-sm font-medium text-zinc-100">{item.displayTitle}</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    node <code className="text-zinc-400">{item.nodeId}</code> · line{" "}
                    <code className="text-zinc-400">{item.lineItemId}</code>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    execution: <span className="text-zinc-300">{item.execution.status}</span>
                    {item.actionability.start.reasons.length > 0 ? (
                      <span className="ml-2 text-zinc-600">
                        start blocked: {item.actionability.start.reasons.join(", ")}
                      </span>
                    ) : null}
                    {item.actionability.complete.reasons.length > 0 ? (
                      <span className="ml-2 text-zinc-600">
                        complete blocked: {item.actionability.complete.reasons.join(", ")}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busy || !canExecuteTasks || !item.actionability.start.canStart}
                    title={item.actionability.start.reasons.join(", ") || "Start"}
                    onClick={() => postJson(startUrl)}
                    className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    disabled={busy || !canExecuteTasks || !item.actionability.complete.canComplete}
                    title={item.actionability.complete.reasons.join(", ") || "Complete"}
                    onClick={() => postJson(completeUrl)}
                    className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Complete
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {data.workItems.length === 0 ? (
        <p className="text-sm text-zinc-500">No work items (empty compose / snapshot).</p>
      ) : null}
    </div>
  );
}
