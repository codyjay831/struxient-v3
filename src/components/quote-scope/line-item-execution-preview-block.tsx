import type { ReactNode } from "react";
import type {
  ExecutionPreviewTaskRow,
  LineItemExecutionPreviewDto,
} from "@/lib/quote-line-item-execution-preview";

export type LineItemExecutionPreviewPresentation = "default" | "workspaceCrewTasks" | "workspaceUnified";

/** Primary heading for the attached packet preview (full /scope and read-only scope). */
function taskPacketPreviewHeading(packetName: string): string {
  const t = packetName.trim();
  if (!t) return "Saved work";
  return `Saved work — ${t}`;
}

/** Legacy workspace label — prefer {@link workspaceUnified}; kept for older call sites. */
function workspaceCrewTasksHeading(): string {
  return "Crew work";
}

function taskPacketRelationshipLine(kind: "manifestLibrary" | "manifestLocal"): string {
  return kind === "manifestLibrary" ? "Tasks from saved work" : "Internal crew work for this line";
}

function workspaceCrewRelationshipLine(kind: "manifestLibrary" | "manifestLocal"): string {
  return kind === "manifestLibrary"
    ? "Linked from your saved work catalog."
    : "Internal tasks your team will perform after the quote is approved.";
}

/** Visual connector so the preview reads as a child of the line item card above. */
function LineItemPreviewNest({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 ml-2 border-l-2 border-zinc-600/50 pl-3 sm:ml-3">{children}</div>
  );
}

function PreviewShell({
  presentation,
  children,
}: {
  presentation: LineItemExecutionPreviewPresentation;
  children: ReactNode;
}) {
  if (presentation === "workspaceUnified") {
    return <div className="mt-0 space-y-2">{children}</div>;
  }
  return <LineItemPreviewNest>{children}</LineItemPreviewNest>;
}

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
  presentation = "default",
}: {
  preview: LineItemExecutionPreviewDto;
  /** `workspaceCrewTasks`: older quote workspace framing. `workspaceUnified`: flat body inside parent “Crew work” shell. */
  presentation?: LineItemExecutionPreviewPresentation;
}) {
  const isWU = presentation === "workspaceUnified";

  if (preview.kind === "soldScopeCommercial") {
    return (
      <PreviewShell presentation={presentation}>
        <div className="rounded-md border border-zinc-800/90 bg-zinc-950/50 px-3 py-2.5 text-sm leading-relaxed text-zinc-400">
          Estimate-only line. Won&rsquo;t create crew work unless saved work or custom work is attached.
        </div>
      </PreviewShell>
    );
  }
  if (preview.kind === "manifestNoPacket") {
    return (
      <PreviewShell presentation={presentation}>
        <div className="rounded-md border border-amber-900/45 bg-amber-950/30 px-3 py-2.5 text-sm leading-relaxed text-amber-200">
          {isWU
            ? "Attach saved work or add custom work for this line, then save."
            : "No crew work attached yet. Attach saved work or create custom work on this quote, then save the line."}
        </div>
      </PreviewShell>
    );
  }
  if (preview.kind === "manifestLibraryMissing") {
    return (
      <PreviewShell presentation={presentation}>
        <div className="rounded-md border border-red-900/45 bg-red-950/30 px-3 py-2.5 text-sm text-red-200 space-y-2">
          <p className="font-semibold text-red-100">Saved work isn&rsquo;t available</p>
          <p className="text-xs text-red-200/90 leading-relaxed">
            It may have been archived or moved. Re-attach this line to visible saved work.
          </p>
          <details className="text-xs text-red-300/80">
            <summary className="cursor-pointer hover:text-red-200 select-none">Technical details</summary>
            <p className="mt-1 font-mono text-[11px] opacity-90 break-all">
              revisionId: {preview.scopePacketRevisionId}
            </p>
          </details>
        </div>
      </PreviewShell>
    );
  }
  if (preview.kind === "manifestLocalMissing") {
    return (
      <PreviewShell presentation={presentation}>
        <div className="rounded-md border border-red-900/45 bg-red-950/30 px-3 py-2.5 text-sm text-red-200 space-y-2">
          <p className="font-semibold text-red-100">
            {isWU ? "This custom work isn&rsquo;t available" : "Custom work on this quote isn&rsquo;t available"}
          </p>
          <p className="text-xs text-red-200/90 leading-relaxed">
            It may have been removed from this quote. Re-attach custom work or saved work.
          </p>
          <details className="text-xs text-red-300/80">
            <summary className="cursor-pointer hover:text-red-200 select-none">Technical details</summary>
            <p className="mt-1 font-mono text-[11px] opacity-90 break-all">
              quoteLocalPacketId: {preview.quoteLocalPacketId}
            </p>
          </details>
        </div>
      </PreviewShell>
    );
  }

  const isWorkspaceCrew = presentation === "workspaceCrewTasks";
  const packetHeading = isWorkspaceCrew
    ? workspaceCrewTasksHeading()
    : taskPacketPreviewHeading(preview.packetName);
  const relationshipLine = isWorkspaceCrew
    ? workspaceCrewRelationshipLine(preview.kind)
    : taskPacketRelationshipLine(preview.kind);
  const taskCount = preview.tasks.length;
  const headerTone =
    preview.kind === "manifestLibrary"
      ? preview.revisionIsLatest
        ? "border-sky-900/35 bg-sky-950/15"
        : "border-amber-900/35 bg-amber-950/15"
      : "border-emerald-900/35 bg-emerald-950/15";

  const libraryRevisionMeta =
    preview.kind === "manifestLibrary"
      ? `${formatRevisionStatus(preview.revisionStatus)} · version ${preview.revisionNumber}${
          preview.revisionIsLatest ? "" : " · not the latest published version"
        }`
      : null;

  if (isWU && (preview.kind === "manifestLibrary" || preview.kind === "manifestLocal")) {
    const taskCount = preview.tasks.length;
    return (
      <PreviewShell presentation={presentation}>
        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-end gap-2">
            <p className="text-[11px] text-zinc-600 tabular-nums">
              {taskCount} {taskCount === 1 ? "task" : "tasks"}
            </p>
          </div>
          {taskCount === 0 ? (
            <p className="text-xs text-amber-200/95 leading-relaxed">
              {preview.kind === "manifestLocal"
                ? "No tasks yet. Use Add task below."
                : "No tasks in this saved work yet — nothing will run for this line until tasks exist."}
            </p>
          ) : (
            <ul className="space-y-2.5 list-none p-0 m-0">
              {renderPreviewTasksWithStageGroups(preview.tasks)}
            </ul>
          )}
          {preview.kind === "manifestLibrary" ? (
            <details className="text-[11px] text-zinc-600">
              <summary className="cursor-pointer hover:text-zinc-400 select-none">Technical details</summary>
              <div className="mt-1 space-y-1 font-mono text-[10px] text-zinc-500 break-all">
                {libraryRevisionMeta ? <p>{libraryRevisionMeta}</p> : null}
                <p>savedWorkKey: {preview.packetKey}</p>
                <p>revisionId: {preview.revisionId}</p>
              </div>
            </details>
          ) : (
            <details className="text-[11px] text-zinc-600">
              <summary className="cursor-pointer hover:text-zinc-400 select-none">Technical details</summary>
              <div className="mt-1 space-y-1 font-mono text-[10px] text-zinc-500 break-all">
                <p>workListId: {preview.quoteLocalPacketId}</p>
              </div>
            </details>
          )}
        </div>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell presentation={presentation}>
      <div
        className={`rounded-md border ${headerTone} bg-zinc-950/40 px-3 py-2.5 space-y-2`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-medium text-zinc-300 leading-snug truncate">{packetHeading}</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">{relationshipLine}</p>
            {libraryRevisionMeta ? (
              <p className="text-[10px] text-zinc-600 leading-relaxed">{libraryRevisionMeta}</p>
            ) : null}
            {preview.kind === "manifestLibrary" ? (
              <details className="text-[11px] text-zinc-600">
                <summary className="cursor-pointer hover:text-zinc-400 select-none">Catalog reference</summary>
                <div className="mt-1 space-y-0.5 font-mono text-[10px] text-zinc-500 break-all">
                  <p>packetKey: {preview.packetKey}</p>
                  <p>revisionId: {preview.revisionId}</p>
                </div>
              </details>
            ) : null}
          </div>
          <p className="text-[11px] font-normal text-zinc-600 shrink-0 tabular-nums pt-0.5">
            {taskCount} {taskCount === 1 ? "task" : "tasks"}
          </p>
        </div>
        {taskCount === 0 ? (
          <p className="text-xs text-amber-200/95 leading-relaxed">
            {preview.kind === "manifestLocal"
              ? isWorkspaceCrew
                ? "No crew tasks yet. Use Add task below."
                : "No tasks yet. Add crew tasks in Custom work on this quote below."
              : isWorkspaceCrew
                ? "No crew tasks from this catalog yet — nothing will run for this line until tasks exist."
                : "No tasks in this saved work yet — no crew tasks will be created for this line."}
          </p>
        ) : (
          <ul className="space-y-2.5 list-none p-0 m-0">
            {renderPreviewTasksWithStageGroups(preview.tasks)}
          </ul>
        )}
      </div>
    </PreviewShell>
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
      <p className="text-xs font-semibold text-zinc-400">{g.stageLabel}</p>
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
