import {
  buildExecutionPreviewSummary,
  type LineItemExecutionPreviewDto,
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
 * Five rendered shapes (one per `LineItemExecutionPreviewDto.kind`):
 *  - `soldScopeCommercial`: zinc note, commercial-only.
 *  - `manifestNoPacket`: amber warning matching the picker validator.
 *  - `manifestLibraryMissing` / `manifestLocalMissing`: red diagnostic.
 *  - `manifestLibrary` / `manifestLocal`: header (packet name + revision badge
 *    when library) + a compact list of tasks with stage label and
 *    requirement-kind tags. Empty packets render the header with a "0 tasks"
 *    note so the empty state is explicit, not silent.
 *
 * Pure presentational component (no React hooks). Lives in `components/`
 * without a `"use client"` marker so both the editable scope editor (a
 * client component) and the read-only office frozen-version scope page (a
 * server component) can mount it identically — visibility/readiness slice
 * parity, no UX divergence between live and frozen views.
 */
export function LineItemExecutionPreviewBlock({
  preview,
}: {
  preview: LineItemExecutionPreviewDto;
}) {
  if (preview.kind === "soldScopeCommercial") {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-[11px] text-zinc-400">
        Quote-only line. Won&rsquo;t create any crew work unless a work template is attached.
      </div>
    );
  }
  if (preview.kind === "manifestNoPacket") {
    return (
      <div className="rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300">
        No work template attached. Field-work lines create crew tasks only when a saved work
        template or one-off work for this quote is attached.
      </div>
    );
  }
  if (preview.kind === "manifestLibraryMissing") {
    return (
      <div className="rounded border border-red-900/50 bg-red-950/20 px-3 py-2 text-[11px] text-red-300 space-y-1">
        <p className="font-medium">Saved work template version isn&rsquo;t loaded</p>
        <p className="font-mono opacity-90">revisionId: {preview.scopePacketRevisionId}</p>
        <p className="opacity-80">
          The template may have been archived or moved out of this tenant. Re-attach the line to a
          visible template to clear this state.
        </p>
      </div>
    );
  }
  if (preview.kind === "manifestLocalMissing") {
    return (
      <div className="rounded border border-red-900/50 bg-red-950/20 px-3 py-2 text-[11px] text-red-300 space-y-1">
        <p className="font-medium">One-off work for this quote isn&rsquo;t loaded</p>
        <p className="font-mono opacity-90">quoteLocalPacketId: {preview.quoteLocalPacketId}</p>
        <p className="opacity-80">
          It may have been deleted from this quote. Re-attach the line to a visible template to
          clear this state.
        </p>
      </div>
    );
  }
  // manifestLibrary | manifestLocal
  const headerTitle = preview.packetName;
  const taskCount = preview.tasks.length;
  // Subtitle uses display-only labels; the technical packetKey / revision id
  // remain on the library shape so reviewers can still cross-reference the
  // catalog row if needed.
  const headerSubtitle =
    preview.kind === "manifestLibrary"
      ? `Saved work template · ${preview.packetKey} · v${preview.revisionNumber} ${preview.revisionStatus}${preview.revisionIsLatest ? "" : " · older version"}`
      : "One-off work for this quote";
  const headerTone =
    preview.kind === "manifestLibrary"
      ? preview.revisionIsLatest
        ? "border-sky-900/50 bg-sky-950/20"
        : "border-amber-900/50 bg-amber-950/20"
      : "border-emerald-900/50 bg-emerald-950/20";
  return (
    <div className={`rounded border ${headerTone} px-3 py-2 space-y-2`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-zinc-100 truncate">{headerTitle}</p>
          <p className="mt-0.5 text-[10px] text-zinc-400 font-mono truncate">{headerSubtitle}</p>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-400 shrink-0">
          {taskCount} {taskCount === 1 ? "task" : "tasks"}
        </p>
      </div>
      {taskCount === 0 ? (
        <p className="text-[10px] text-zinc-500 italic">
          This template has no work yet — no crew tasks will be created for this line.
        </p>
      ) : (
        <>
          <p className="text-[11px] text-zinc-300">
            {buildExecutionPreviewSummary(preview.tasks)}
          </p>
          <ul className="space-y-1.5">
            {preview.tasks.map((t) => (
              <ExecutionPreviewTaskItem key={t.lineKey} task={t} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ExecutionPreviewTaskItem({
  task,
}: {
  // We intentionally accept the array element type structurally so the
  // helper module's union doesn't have to expose the per-task shape twice.
  task: Extract<
    LineItemExecutionPreviewDto,
    { kind: "manifestLibrary" | "manifestLocal" }
  >["tasks"][number];
}) {
  const sourceBadgeTone =
    task.sourceKind === "taskDefinition"
      ? "border-sky-800/60 bg-sky-950/40 text-sky-300"
      : "border-zinc-700 bg-zinc-900 text-zinc-300";
  const sourceBadgeLabel =
    task.sourceKind === "taskDefinition"
      ? `TaskDef${task.taskDefinitionRef ? ` · ${task.taskDefinitionRef.taskKey}` : ""}`
      : "Embedded";
  return (
    <li className="rounded bg-zinc-950/60 border border-zinc-800/80 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium text-zinc-100 truncate min-w-0">{task.title}</p>
        <span
          className={`text-[9px] uppercase tracking-wider rounded border px-1 py-0.5 shrink-0 ${sourceBadgeTone}`}
        >
          {sourceBadgeLabel}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-400">
        <span className="inline-flex items-baseline gap-1">
          <span className="opacity-70">Stage:</span>
          <span className={task.stage.isOnSnapshot ? "text-zinc-200" : "text-amber-300"}>
            {task.stage.displayLabel}
          </span>
          <span className="font-mono opacity-60">({task.stage.nodeId})</span>
          {!task.stage.isOnSnapshot ? (
            <span className="text-amber-300 opacity-90">
              · stage isn&rsquo;t in this process template
            </span>
          ) : null}
        </span>
        {task.tierCode ? (
          <span className="inline-flex items-baseline gap-1">
            <span className="opacity-70">Tier:</span>
            <span className="font-mono">{task.tierCode}</span>
          </span>
        ) : null}
      </div>
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
      ) : (
        <p className="mt-1 text-[9px] text-zinc-600 italic">no authored completion requirements</p>
      )}
    </li>
  );
}
