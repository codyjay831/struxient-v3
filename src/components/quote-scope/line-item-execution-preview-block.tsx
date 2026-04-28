import type {
  ExecutionPreviewTaskRow,
  LineItemExecutionPreviewDto,
} from "@/lib/quote-line-item-execution-preview";

/**
 * Read-only execution preview rendered under each line item.
 *
 * Triangle Mode surfaces what runtime tasks each MANIFEST line will compose
 * into so the operator can verify the packet → stage binding before send.
 * This is a direct projection of the pinned packet contents — it is NOT the
 * compose engine. The same data is what `runComposeFromReadModel` would
 * later iterate over (compose remains the source of truth at send/freeze).
 *
 * Pure presentational component (no React hooks). Lives in `components/`
 * without a `"use client"` marker so both the editable scope editor (a
 * client component) and the read-only office frozen-version scope page (a
 * server component) can mount it identically.
 */
export function LineItemExecutionPreviewBlock({
  preview,
}: {
  preview: LineItemExecutionPreviewDto;
}) {
  if (preview.kind === "soldScopeCommercial") {
    return (
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/35 px-4 py-3 text-sm leading-relaxed text-zinc-400">
        Quote-only line. Won&rsquo;t create crew work unless a task packet is attached.
      </div>
    );
  }
  if (preview.kind === "manifestNoPacket") {
    return (
      <div className="rounded-lg border border-amber-900/45 bg-amber-950/25 px-4 py-3 text-sm leading-relaxed text-amber-200">
        No field work attached yet. Attach saved field work or create field work on this quote,
        then save the line.
      </div>
    );
  }
  if (preview.kind === "manifestLibraryMissing") {
    return (
      <div className="rounded-lg border border-red-900/45 bg-red-950/25 px-4 py-3 text-sm text-red-200 space-y-2">
        <p className="font-semibold text-red-100">Saved task packet isn&rsquo;t available</p>
        <p className="text-xs text-red-200/90 leading-relaxed">
          The packet may have been archived or moved. Re-attach this line to a visible saved task
          packet.
        </p>
        <details className="text-xs text-red-300/80">
          <summary className="cursor-pointer hover:text-red-200 select-none">Technical details</summary>
          <p className="mt-1 font-mono text-[11px] opacity-90 break-all">
            revisionId: {preview.scopePacketRevisionId}
          </p>
        </details>
      </div>
    );
  }
  if (preview.kind === "manifestLocalMissing") {
    return (
      <div className="rounded-lg border border-red-900/45 bg-red-950/25 px-4 py-3 text-sm text-red-200 space-y-2">
        <p className="font-semibold text-red-100">Field work on this quote isn&rsquo;t available</p>
        <p className="text-xs text-red-200/90 leading-relaxed">
          It may have been removed from this quote. Re-attach field work or a saved task packet.
        </p>
        <details className="text-xs text-red-300/80">
          <summary className="cursor-pointer hover:text-red-200 select-none">Technical details</summary>
          <p className="mt-1 font-mono text-[11px] opacity-90 break-all">
            quoteLocalPacketId: {preview.quoteLocalPacketId}
          </p>
        </details>
      </div>
    );
  }

  const headerTitle = preview.packetName;
  const taskCount = preview.tasks.length;
  const headerTone =
    preview.kind === "manifestLibrary"
      ? preview.revisionIsLatest
        ? "border-sky-900/40 bg-sky-950/20"
        : "border-amber-900/40 bg-amber-950/20"
      : "border-emerald-900/40 bg-emerald-950/20";

  const librarySummary =
    preview.kind === "manifestLibrary"
      ? `${formatRevisionStatus(preview.revisionStatus)} · version ${preview.revisionNumber}${
          preview.revisionIsLatest ? "" : " · not the latest published version"
        }`
      : "Editable on this quote";

  return (
    <div className={`rounded-lg border ${headerTone} px-4 py-3 space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-base font-semibold text-zinc-50 leading-snug truncate">{headerTitle}</p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            {preview.kind === "manifestLibrary" ? "Saved task packet" : "Field work on this quote"} ·{" "}
            {librarySummary}
          </p>
          {preview.kind === "manifestLibrary" ? (
            <details className="text-xs text-zinc-600">
              <summary className="cursor-pointer hover:text-zinc-400 select-none">Catalog reference</summary>
              <div className="mt-1 space-y-0.5 font-mono text-[11px] text-zinc-500 break-all">
                <p>packetKey: {preview.packetKey}</p>
                <p>revisionId: {preview.revisionId}</p>
              </div>
            </details>
          ) : null}
        </div>
        <p className="text-xs font-medium text-zinc-500 shrink-0 tabular-nums">
          {taskCount} {taskCount === 1 ? "task" : "tasks"}
        </p>
      </div>
      {taskCount === 0 ? (
        <p className="text-sm text-amber-200/95 leading-relaxed">
          {preview.kind === "manifestLocal"
            ? "No tasks yet. Add tasks in Field work on this quote below."
            : "No tasks in this packet yet — no crew tasks will be created for this line."}
        </p>
      ) : (
        <ul className="space-y-3 list-none p-0 m-0">
          {renderPreviewTasksWithStageGroups(preview.tasks)}
        </ul>
      )}
    </div>
  );
}

function formatRevisionStatus(status: string): string {
  if (status === "PUBLISHED") return "Published";
  if (status === "DRAFT") return "Draft";
  if (status === "SUPERSEDED") return "Superseded";
  return status;
}

function sortPreviewTasksForDisplay(tasks: ExecutionPreviewTaskRow[]): ExecutionPreviewTaskRow[] {
  return [...tasks].sort((a, b) => {
    const byStage = a.stage.displayLabel.localeCompare(b.stage.displayLabel);
    if (byStage !== 0) return byStage;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });
}

function renderPreviewTasksWithStageGroups(tasks: ExecutionPreviewTaskRow[]) {
  const sorted = sortPreviewTasksForDisplay(tasks);
  const groups: { stageLabel: string; tasks: ExecutionPreviewTaskRow[] }[] = [];
  for (const t of sorted) {
    const label = t.stage.displayLabel;
    const last = groups[groups.length - 1];
    if (last && last.stageLabel === label) {
      last.tasks.push(t);
    } else {
      groups.push({ stageLabel: label, tasks: [t] });
    }
  }
  return groups.map((g, idx) => (
    <li key={`${idx}-${g.stageLabel}`} className="list-none">
      <p className="text-xs font-semibold text-zinc-500">{g.stageLabel}</p>
      <ul className="mt-1.5 space-y-0.5 list-none p-0 m-0">
        {g.tasks.map((task) => (
          <ExecutionPreviewTaskItem key={task.lineKey} task={task} stageGrouped />
        ))}
      </ul>
    </li>
  ));
}

function ExecutionPreviewTaskItem({
  task,
  stageGrouped = false,
}: {
  task: ExecutionPreviewTaskRow;
  /** When true, stage is shown in the section heading — only show tier / off-template warnings here. */
  stageGrouped?: boolean;
}) {
  const meta =
    stageGrouped && task.stage.isOnSnapshot && !task.tierCode ? null : (
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
        {stageGrouped ? (
          !task.stage.isOnSnapshot ? (
            <span className="text-amber-300 font-medium">
              Not in this process template
              <span className="font-normal text-amber-200/80"> · {task.stage.displayLabel}</span>
            </span>
          ) : task.tierCode ? (
            <span>Tier {task.tierCode}</span>
          ) : null
        ) : (
          <>
            <span className={task.stage.isOnSnapshot ? "text-zinc-400" : "text-amber-300 font-medium"}>
              {task.stage.displayLabel}
              {!task.stage.isOnSnapshot ? (
                <span className="font-normal"> · not in this process template</span>
              ) : null}
            </span>
            {task.tierCode ? <span>Tier {task.tierCode}</span> : null}
          </>
        )}
      </div>
    );
  return (
    <li className="rounded-md border border-zinc-800/70 bg-zinc-950/50 px-3 py-2">
      <p className="text-sm font-semibold text-zinc-50 leading-snug truncate">{task.title}</p>
      {meta}
      {task.requirementKinds.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {task.requirementKinds.map((k) => (
            <span
              key={k}
              className="rounded border border-amber-900/40 bg-amber-950/25 px-1.5 py-0.5 text-[10px] font-medium text-amber-200"
            >
              {k}
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}
