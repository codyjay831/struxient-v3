"use client";

import { useCallback, useMemo, useState } from "react";
import type { FlowExecutionApiDto } from "@/lib/flow-execution-dto";
import { ExecutionWorkItemCard } from "./execution-work-item-card";

type Props = {
  flowId: string;
  initialData: FlowExecutionApiDto;
  /** When false (e.g. READ_ONLY role), Start/Complete are disabled — API would return 403. */
  canExecuteTasks: boolean;
  /** When true (e.g. OFFICE_ADMIN), Review actions are enabled. */
  canReviewTasks?: boolean;
};

export function ExecutionWorkFeed({ flowId, initialData, canExecuteTasks, canReviewTasks }: Props) {
  const [data, setData] = useState<FlowExecutionApiDto>(initialData);
  const [busy, setBusy] = useState(false);
  const [lastAction, setLastAction] = useState<{ id: string; success: boolean; errorDetails?: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = data.workItems.length;
    const completed = data.workItems.filter(i => i.execution.status === "completed").length;
    const inProgress = data.workItems.filter(i => i.execution.status === "in_progress").length;
    const remaining = total - completed;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, remaining, pct };
  }, [data.workItems]);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/flows/${encodeURIComponent(flowId)}`, { credentials: "include" });
    const j = (await r.json()) as { data?: FlowExecutionApiDto; error?: { message?: string } };
    if (!r.ok) {
      setError(j.error?.message ?? `Refresh failed (${r.status})`);
      return;
    }
    if (j.data) {
      setData(j.data);
      setError(null);
    }
  }, [flowId]);

  async function postJson(url: string, taskId: string, bodyExtra: any = {}) {
    setBusy(true);
    setError(null);
    setLastAction(null);
    try {
      const r = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: null, ...bodyExtra }),
      });
      const j = (await r.json()) as { error?: { code?: string; message?: string; details?: any[] } };
      if (!r.ok) {
        setError(j.error?.message ?? j.error?.code ?? `Request failed (${r.status})`);
        setLastAction({ id: taskId, success: false, errorDetails: j.error?.details });
        return;
      }
      setLastAction({ id: taskId, success: true });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Summary Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Remaining</p>
            <p className="text-2xl font-black text-white">{stats.remaining}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Active</p>
            <p className="text-2xl font-black text-sky-400">{stats.inProgress}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center text-center col-span-2 md:col-span-1 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Progress</p>
            <div className="flex items-center gap-2">
                <p className="text-2xl font-black text-emerald-400">{stats.pct}%</p>
                <div className="h-4 w-12 bg-zinc-800 rounded-full overflow-hidden flex-shrink-0 border border-zinc-700/50">
                    <div 
                      className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all duration-500" 
                      style={{ width: `${stats.pct}%` }}
                    ></div>
                </div>
            </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center text-center col-span-2 md:col-span-1 shadow-sm">
             <button
                type="button"
                disabled={busy}
                onClick={() => refresh()}
                className="w-full h-full flex flex-col items-center justify-center gap-1 group active:scale-95 transition-transform"
              >
                <span className={`text-[10px] font-bold uppercase tracking-widest group-hover:text-zinc-300 transition-colors ${busy ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    {busy ? "Syncing..." : "Sync List"}
                </span>
                <span className={`text-[9px] font-medium text-zinc-600 group-hover:text-zinc-500 transition-colors`}>
                  Tap to refresh
                </span>
              </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-900/60 bg-red-950/20 px-4 py-3 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <p className="text-sm font-bold text-red-300 uppercase tracking-tight">Sync Error</p>
            <p className="text-xs text-red-400/90 font-medium">{error}</p>
          </div>
          <button 
            onClick={() => setError(null)} 
            className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1 rounded hover:bg-red-500/10"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {!canExecuteTasks ? (
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0"></div>
          <p className="text-xs text-amber-200/90 font-medium">
            <span className="font-bold uppercase tracking-tight mr-2">Read Only:</span>
            Your role does not allow task execution on this flow.
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600 flex items-center gap-2">
              Work Feed 
              <span className="h-1 w-1 rounded-full bg-zinc-700"></span>
              <span className="text-zinc-500 font-bold opacity-70">{stats.total} Tasks</span>
            </h2>
        </div>

        {data.workItems.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-950/50 p-10 text-center">
            <p className="text-sm font-medium text-zinc-500 italic leading-relaxed">
                No work items found for this flow.<br/>Activation may be incomplete or scope was removed.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.workItems.map((item, i) => {
              const taskId = item.kind === "SKELETON" ? item.skeletonTaskId : item.runtimeTaskId;
              const startUrl = item.kind === "SKELETON"
                ? `/api/flows/${encodeURIComponent(flowId)}/skeleton-tasks/${encodeURIComponent(item.skeletonTaskId)}/start`
                : `/api/runtime-tasks/${encodeURIComponent(item.runtimeTaskId)}/start`;
              const completeUrl = item.kind === "SKELETON"
                ? `/api/flows/${encodeURIComponent(flowId)}/skeleton-tasks/${encodeURIComponent(item.skeletonTaskId)}/complete`
                : `/api/runtime-tasks/${encodeURIComponent(item.runtimeTaskId)}/complete`;

              return (
                <ExecutionWorkItemCard
                  key={item.kind === "SKELETON" ? `sk-${item.skeletonTaskId}-${i}` : `rt-${item.runtimeTaskId}-${i}`}
                  item={item}
                  busy={busy}
                  isActionTarget={lastAction?.id === taskId}
                  lastActionSuccess={lastAction?.id === taskId ? lastAction.success : null}
                  lastActionErrorDetails={lastAction?.id === taskId ? lastAction.errorDetails : undefined}
                  canExecuteTasks={canExecuteTasks}
                  onStart={() => postJson(startUrl, taskId)}
                  onComplete={(proof) => postJson(completeUrl, taskId, { completionProof: proof })}
                  canReviewTasks={canReviewTasks}
                  onReview={(action, feedback) => {
                    const reviewUrl = `/api/runtime-tasks/${encodeURIComponent(taskId)}/review`;
                    postJson(reviewUrl, taskId, { action, feedback });
                  }}
                />
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
