"use client";

import { useMemo, useState } from "react";
import type {
  ProposedExecutionFlow,
  ProposedExecutionFlowLineWarning,
  ProposedExecutionFlowStage,
  ProposedExecutionFlowTask,
} from "@/lib/quote-proposed-execution-flow";

type Props = {
  /**
   * Pre-built proposed flow. Built on the server from the same per-line
   * execution previews the scope editor uses, so this panel can never
   * disagree with the editor about which lines need attention.
   *
   * Null when the head version is not an editable DRAFT or has no line
   * items yet — in those cases the panel renders a minimal placeholder
   * explaining what will appear once line items are authored.
   */
  flow: ProposedExecutionFlow | null;
  /**
   * True when the head version is still an editable DRAFT. Live drafts
   * surface "needs attention" copy; frozen versions render the same plan
   * read-only without authoring nudges.
   */
  isEditableDraft: boolean;
};

/**
 * "Review Proposed Execution Flow" panel — the user-facing replacement for
 * the old "Pin Process Template" step.
 *
 * Path B / Triangle Mode product direction:
 *   - Stages organize the work; line items + task packets define it. The
 *     panel shows the operator the runtime tasks the proposed plan would
 *     generate, grouped by canonical execution stage.
 *   - There is no "process template" picker here. The canonical workflow
 *     is auto-pinned in the backend; the user only authors line items,
 *     reviews the plan, and sends.
 *   - This panel is read-only. All authoring happens in the line-item /
 *     scope editor.
 */
export function QuoteWorkspaceProposedExecutionFlow({ flow, isEditableDraft }: Props) {
  return (
    <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/40 p-4 text-sm">
      <h2 className="mb-1 text-sm font-medium text-zinc-200">
        Review proposed execution flow
      </h2>
      <p className="text-xs text-zinc-500 leading-relaxed">
        This plan is generated from the quoted line items and their task packets.
        Stages organize the work; task packets define the actual tasks, order,
        blockers, and proof requirements.
      </p>

      {flow == null ? (
        <p className="mt-4 text-xs text-zinc-500">
          The proposed execution flow appears here once the head DRAFT has line items.
          Add line items in step 1 to populate the plan.
        </p>
      ) : (
        <>
          <SummaryRow summary={flow.summary} />

          {flow.warnings.length > 0 ? (
            <WarningsList
              warnings={flow.warnings}
              isEditableDraft={isEditableDraft}
            />
          ) : null}

          {flow.stages.length === 0 ? (
            <EmptyState summary={flow.summary} />
          ) : (
            <StageList stages={flow.stages} suppressPerTaskOffStageBadges={flow.suppressPerTaskOffStageBadges} />
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function SummaryRow({ summary }: { summary: ProposedExecutionFlow["summary"] }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs sm:grid-cols-4">
      <SummaryStat
        label="Quoted lines"
        value={summary.quotedLineCount}
        muted={summary.quotedLineCount === 0}
      />
      <SummaryStat
        label="Task packets"
        value={summary.packetCount}
        muted={summary.packetCount === 0}
      />
      <SummaryStat
        label="Generated tasks"
        value={summary.generatedTaskCount}
        muted={summary.generatedTaskCount === 0}
      />
      <SummaryStat
        label="Quote-only lines"
        value={summary.soldScopeOnlyCount}
        muted
        title="Lines that appear on the proposal but won't create crew work."
      />
    </dl>
  );
}

function SummaryStat({
  label,
  value,
  muted,
  title,
}: {
  label: string;
  value: number;
  muted?: boolean;
  title?: string;
}) {
  return (
    <div className="flex flex-col" title={title}>
      <dt className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className={`text-sm font-medium ${muted ? "text-zinc-400" : "text-zinc-100"}`}>
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function WarningsList({
  warnings,
  isEditableDraft,
}: {
  warnings: ProposedExecutionFlowLineWarning[];
  isEditableDraft: boolean;
}) {
  const advancedKeys = warnings
    .map((w, i) => warningAdvancedKeyLine(w, i))
    .filter((s): s is string => s != null);
  return (
    <div className="mt-4 rounded border border-amber-900/40 bg-amber-950/10 p-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/90">
        Needs attention
      </h3>
      <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-amber-200/90">
        {warnings.map((w, i) => (
          <li key={`${w.kind}-${i}`}>{warningCopy(w)}</li>
        ))}
      </ul>
      {advancedKeys.length > 0 ? (
        <details className="mt-3 text-[10px] text-amber-200/70">
          <summary className="cursor-pointer font-medium text-amber-300/90 hover:text-amber-200">
            Advanced (support)
          </summary>
          <ul className="mt-2 list-inside list-disc font-mono text-[10px] text-amber-100/60">
            {advancedKeys.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {isEditableDraft ? (
        <p className="mt-2 text-[11px] text-amber-300/80">
          If a line needs a packet or a stage fix, open the line-item editor. If the note is about execution
          flow binding, wait for the system to finish binding or contact support.
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-amber-300/80">
          These notes were captured at send time. The locked plan above is what activation will use.
        </p>
      )}
    </div>
  );
}

function warningCopy(w: ProposedExecutionFlowLineWarning): string {
  if (w.kind === "executionFlowBinding") {
    return w.detail;
  }
  const lineLabel = w.lineTitle ? `"${w.lineTitle}"` : `line ${shortId(w.lineItemId)}`;
  if (w.kind === "missingPacket") {
    return `${lineLabel} has no task packet attached. Field-work lines create crew tasks only when a saved task packet or field work on this quote is attached.`;
  }
  if (w.kind === "missingLibraryRevision") {
    return `${lineLabel} references a saved task packet that isn't loadable (revision ${shortId(
      w.scopePacketRevisionId,
    )}). Re-attach to a visible packet to clear this state.`;
  }
  if (w.kind === "missingLocalPacket") {
    return `${lineLabel} references field work on this quote that isn't loadable. Re-attach to a visible task packet to clear this state.`;
  }
  if (w.kind === "stageOffSnapshot") {
    const stage = w.stageDisplayLabel.trim() || "this phase";
    return `${lineLabel}: task "${w.taskTitle}" is assigned to “${stage}”, which is not available on the current work plan. Reassign the task to a standard phase that exists on the plan.`;
  }
  // stageNonCanonical
  const stage = w.stageDisplayLabel.trim() || "this phase";
  return `${lineLabel}: task "${w.taskTitle}" uses a non-standard phase (“${stage}”). The task will still run but may not group with the standard job phases.`;
}

function warningAdvancedKeyLine(w: ProposedExecutionFlowLineWarning, index: number): string | null {
  if (w.kind === "stageOffSnapshot" || w.kind === "stageNonCanonical") {
    return `#${index + 1} · ${w.taskTitle} · stage key ${w.nodeId}`;
  }
  return null;
}

function shortId(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 8)}…`;
}

/* ------------------------------------------------------------------ */

function EmptyState({ summary }: { summary: ProposedExecutionFlow["summary"] }) {
  if (summary.quotedLineCount === 0) {
    return (
      <p className="mt-4 text-xs text-zinc-500">
        No quoted lines yet. Add line items in step 1 — the proposed execution flow
        appears once at least one field-work line has a task packet attached.
      </p>
    );
  }
  if (summary.soldScopeOnlyCount === summary.quotedLineCount) {
    return (
      <p className="mt-4 text-xs text-zinc-500">
        All quoted lines are quote-only — none of them create crew work. You can still
        send this proposal; activation will not create job tasks from these lines.
      </p>
    );
  }
  return (
    <p className="mt-4 text-xs text-zinc-500">
      No tasks resolve yet. Attach a task packet to each field-work line item to populate
      the proposed flow.
    </p>
  );
}

/* ------------------------------------------------------------------ */

function StageList({
  stages,
  suppressPerTaskOffStageBadges,
}: {
  stages: ProposedExecutionFlowStage[];
  suppressPerTaskOffStageBadges: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = useMemo(
    () => (showAll ? stages : stages.filter((s) => s.taskCount > 0)),
    [showAll, stages],
  );
  // The aggregator already hides empty canonical stages by default, so the
  // toggle is only meaningful when the caller built `flow` with
  // `includeEmptyCanonicalStages: true`. We keep the control here so it
  // adapts gracefully if/when callers opt in.
  const hasHiddenEmpties = stages.some((s) => s.taskCount === 0);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Stages ({visible.length})
        </h3>
        {hasHiddenEmpties ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 underline decoration-zinc-700"
          >
            {showAll ? "Hide empty stages" : "Show all canonical stages"}
          </button>
        ) : null}
      </div>
      <ul className="space-y-2">
        {visible.map((s) => (
          <StageRow key={s.key} stage={s} suppressPerTaskOffStageBadges={suppressPerTaskOffStageBadges} />
        ))}
      </ul>
    </div>
  );
}

function StageRow({
  stage,
  suppressPerTaskOffStageBadges,
}: {
  stage: ProposedExecutionFlowStage;
  suppressPerTaskOffStageBadges: boolean;
}) {
  const isOther = stage.key === "other";
  const tone = isOther
    ? "border-amber-900/40 bg-amber-950/10"
    : stage.taskCount === 0
      ? "border-zinc-800 bg-zinc-950/40"
      : "border-zinc-800 bg-zinc-900/30";
  return (
    <li className={`rounded border ${tone} p-3`}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-zinc-100 truncate">{stage.label}</p>
          {stage.description ? (
            <p className="mt-0.5 text-[11px] text-zinc-500 leading-snug">{stage.description}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-400">
          {stage.taskCount} {stage.taskCount === 1 ? "task" : "tasks"}
        </span>
      </div>
      {stage.taskCount === 0 ? (
        <p className="mt-2 text-[11px] italic text-zinc-500">No tasks at this stage yet.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {stage.tasks.map((t) => (
            <TaskRow
              key={`${t.lineItemId}-${t.lineKey}`}
              task={t}
              suppressPerTaskOffStageBadges={suppressPerTaskOffStageBadges}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function TaskRow({
  task,
  suppressPerTaskOffStageBadges,
}: {
  task: ProposedExecutionFlowTask;
  suppressPerTaskOffStageBadges: boolean;
}) {
  const showOffStage = !task.isOnSnapshot && !suppressPerTaskOffStageBadges;
  return (
    <li className="rounded border border-zinc-800/70 bg-zinc-950/60 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] font-medium text-zinc-100">{task.title}</p>
        {showOffStage ? (
          <span className="shrink-0 rounded border border-amber-700/40 bg-amber-950/40 px-1 py-px text-[9px] uppercase tracking-wider text-amber-300">
            off-stage
          </span>
        ) : !task.isCanonical ? (
          <span className="shrink-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-px text-[9px] uppercase tracking-wider text-zinc-300">
            non-canonical
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-[10px] text-zinc-500">
        {task.lineTitle ? <span className="text-zinc-400">{task.lineTitle}</span> : null}
        {task.lineTitle && task.sourcePacketName ? (
          <span className="px-1 text-zinc-700">·</span>
        ) : null}
        {task.sourcePacketName ? (
          <span className="text-zinc-500">from {task.sourcePacketName}</span>
        ) : null}
      </p>
      {task.requirementKinds.length > 0 ? (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="text-[9px] uppercase tracking-wider text-zinc-500">requires:</span>
          {task.requirementKinds.map((k) => (
            <span
              key={k}
              className="rounded border border-zinc-700 bg-zinc-900/80 px-1 py-px text-[9px] text-zinc-300"
            >
              {k}
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}
