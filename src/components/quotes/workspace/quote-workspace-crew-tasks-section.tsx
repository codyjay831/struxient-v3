"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  ExecutionPreviewTaskRow,
  LineItemExecutionPreviewDto,
} from "@/lib/quote-line-item-execution-preview";
import type {
  QuoteLocalPacketDto,
  QuoteLocalPacketItemDto,
} from "@/server/slice1/reads/quote-local-packet-reads";
import { EmbeddedTaskAuthoringForm } from "@/components/quote-scope/quote-local-packet-task-forms";
import {
  draftToBody,
  itemToDraft,
  lineKeysForPacketCollision,
  type NewItemDraft,
} from "@/lib/quote-local-packet-item-authoring";
import {
  resolveFieldWorkDisplayNameForQuickCreate,
  validateOneOffWorkDisplayNameInput,
} from "@/lib/quote-line-item-local-packet-quick-create";

type ApiErrorBody = { error?: { code?: string; message?: string } };

const FRIENDLY_SETUP_FAIL = "Could not set up crew tasks for this line.";
const FRIENDLY_TASK_AFTER_SETUP_FAIL =
  "Could not add the task. Try again, or open Line & tasks to finish.";

async function readApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body.error?.message) return body.error.message;
    if (body.error?.code) return body.error.code;
  } catch {
    // ignore
  }
  return `HTTP ${res.status}`;
}

export type QuoteWorkspaceCrewTasksSectionProps = {
  quoteId: string;
  quoteVersionId: string;
  lineItemId: string;
  lineTitle: string;
  executionMode: string;
  preview: LineItemExecutionPreviewDto | null | undefined;
  quoteLocalPacketId: string | null;
  scopePacketRevisionId: string | null;
  localPacket: QuoteLocalPacketDto | null;
  canAuthorTasks: boolean;
  pinnedWorkflowVersionId: string | null;
};

/**
 * Crew task list + add (R2 local / R4A first task) + edit/delete (R3).
 */
export function QuoteWorkspaceCrewTasksSection({
  quoteId,
  quoteVersionId,
  lineItemId,
  lineTitle,
  executionMode,
  preview,
  quoteLocalPacketId,
  scopePacketRevisionId,
  localPacket,
  canAuthorTasks,
  pinnedWorkflowVersionId,
}: QuoteWorkspaceCrewTasksSectionProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeHref = `/quotes/${quoteId}/scope`;

  if (executionMode !== "MANIFEST") {
    return (
      <div className="mt-3 rounded-md border border-zinc-800/60 bg-zinc-950/35 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Line type</p>
        <p className="text-xs text-zinc-400 mt-0.5">Quote only — no crew tasks on this line.</p>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="mt-3 rounded-md border border-amber-900/35 bg-amber-950/20 px-3 py-2">
        <p className="text-xs text-amber-200/95">Crew task preview isn’t available for this line yet.</p>
      </div>
    );
  }

  if (preview.kind === "soldScopeCommercial") {
    return (
      <div className="mt-3 rounded-md border border-zinc-800/60 bg-zinc-950/35 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Line type</p>
        <p className="text-xs text-zinc-400 mt-0.5">Quote only — no crew tasks on this line.</p>
      </div>
    );
  }

  if (preview.kind === "manifestLibraryMissing" || preview.kind === "manifestLocalMissing") {
    return (
      <div className="mt-3 space-y-2">
        <div className="rounded-md border border-red-900/40 bg-red-950/25 px-3 py-2">
          <p className="text-xs text-red-200/95 leading-relaxed">
            Something this line depends on is no longer available. Open{" "}
            <Link href={scopeHref} className="font-medium text-red-100 underline underline-offset-2">
              Line &amp; tasks
            </Link>{" "}
            to repair the line.
          </p>
        </div>
        <AddTaskButton disabled reason="Set up crew work in Line & tasks" />
      </div>
    );
  }

  const isManifestNoPacket = preview.kind === "manifestNoPacket";
  const isCatalogLine = preview.kind === "manifestLibrary";

  const tasks: ExecutionPreviewTaskRow[] =
    preview.kind === "manifestLocal" || preview.kind === "manifestLibrary" ? preview.tasks : [];

  const count = tasks.length;

  const canAddWithAutoSetup =
    canAuthorTasks &&
    isManifestNoPacket &&
    scopePacketRevisionId == null &&
    quoteLocalPacketId == null;

  const manifestNoPacketNeedsLineTasks =
    isManifestNoPacket && canAuthorTasks && !canAddWithAutoSetup;

  const canAddLocalTask =
    canAuthorTasks &&
    preview.kind === "manifestLocal" &&
    quoteLocalPacketId != null &&
    localPacket != null &&
    localPacket.id === quoteLocalPacketId;

  const canOpenAddForm = canAddLocalTask || canAddWithAutoSetup;

  function itemForPreviewLine(lineKey: string): QuoteLocalPacketItemDto | null {
    if (!localPacket) return null;
    return localPacket.items.find((i) => i.lineKey === lineKey) ?? null;
  }

  async function handleCreateTaskOnExistingPacket(draft: NewItemDraft) {
    if (!canAddLocalTask || !localPacket) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/quote-local-packets/${encodeURIComponent(localPacket.id)}/items`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(draftToBody(draft)),
        },
      );
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      setAddOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTaskWithAutoSetup(draft: NewItemDraft) {
    if (!canAddWithAutoSetup) return;
    const displayNameRaw = resolveFieldWorkDisplayNameForQuickCreate({
      lineTitleTrimmed: lineTitle.trim(),
      customizeOpen: false,
      customInputTrimmed: "",
    });
    const nameCheck = validateOneOffWorkDisplayNameInput(displayNameRaw);
    if (!nameCheck.ok) {
      setError(FRIENDLY_SETUP_FAIL);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const createRes = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/local-packets`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ displayName: nameCheck.trimmed, description: null }),
        },
      );
      if (!createRes.ok) {
        setError(FRIENDLY_SETUP_FAIL);
        return;
      }
      const createBody = (await createRes.json()) as { data?: { id: string } };
      const newPacketId = createBody.data?.id;
      if (!newPacketId) {
        setError(FRIENDLY_SETUP_FAIL);
        return;
      }

      const patchRes = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/line-items/${encodeURIComponent(lineItemId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            quoteLocalPacketId: newPacketId,
            scopePacketRevisionId: null,
          }),
        },
      );
      if (!patchRes.ok) {
        setError(
          `${FRIENDLY_SETUP_FAIL} Open Line & tasks if this keeps happening.`,
        );
        return;
      }

      const itemRes = await fetch(
        `/api/quote-local-packets/${encodeURIComponent(newPacketId)}/items`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(draftToBody(draft)),
        },
      );
      if (!itemRes.ok) {
        setError(FRIENDLY_TASK_AFTER_SETUP_FAIL);
        return;
      }

      setAddOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTask(draft: NewItemDraft) {
    if (canAddLocalTask && localPacket) {
      await handleCreateTaskOnExistingPacket(draft);
      return;
    }
    if (canAddWithAutoSetup) {
      await handleCreateTaskWithAutoSetup(draft);
    }
  }

  async function handleUpdateTask(itemId: string, draft: NewItemDraft) {
    if (!canAddLocalTask || !localPacket) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/quote-local-packets/${encodeURIComponent(localPacket.id)}/items/${encodeURIComponent(itemId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(draftToBody(draft)),
        },
      );
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      setEditingItemId(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTask(itemId: string) {
    if (!canAddLocalTask || !localPacket) return;
    if (!window.confirm("Delete this task?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/quote-local-packets/${encodeURIComponent(localPacket.id)}/items/${encodeURIComponent(itemId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      if (editingItemId === itemId) setEditingItemId(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const defaultSortOrder =
    localPacket && localPacket.items.length > 0
      ? Math.max(...localPacket.items.map((i) => i.sortOrder)) + 1
      : 0;
  const existingLineKeys = localPacket?.items.map((i) => i.lineKey) ?? [];

  const showAddForm =
    addOpen &&
    editingItemId == null &&
    ((canAddLocalTask && localPacket != null) || canAddWithAutoSetup);

  const addFormKey =
    canAddLocalTask && localPacket
      ? `add-${localPacket.id}-${count}`
      : `add-bootstrap-${lineItemId}-${count}`;

  return (
    <div className="mt-3 space-y-2">
      {manifestNoPacketNeedsLineTasks ? (
        <div className="rounded-md border border-amber-900/35 bg-amber-950/20 px-3 py-2">
          <p className="text-xs text-amber-100/95 leading-relaxed">
            This line needs setup in{" "}
            <Link href={scopeHref} className="font-medium text-amber-50 underline underline-offset-2">
              Line &amp; tasks
            </Link>
            .
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Crew tasks</h4>
        <span className="text-[10px] text-zinc-600 tabular-nums">
          {count} {count === 1 ? "task" : "tasks"}
        </span>
      </div>

      {count === 0 ? (
        <p className="text-xs text-zinc-500 leading-relaxed">No tasks yet.</p>
      ) : (
        <ul className="space-y-1.5 list-none p-0 m-0">
          {tasks.map((t) => {
            const packetItem = canAddLocalTask ? itemForPreviewLine(t.lineKey) : null;
            const canDeleteRow = Boolean(packetItem);
            const canEditRow = Boolean(packetItem && packetItem.lineKind === "EMBEDDED");
            const isEditing = packetItem != null && editingItemId === packetItem.id;

            return (
              <li
                key={t.lineKey}
                className="rounded-md border border-zinc-800/70 bg-zinc-950/45 px-2.5 py-2 text-xs text-zinc-200"
              >
                {isEditing && packetItem ? (
                  <EmbeddedTaskAuthoringForm
                    key={`edit-${packetItem.id}`}
                    variant="edit"
                    initialDraft={itemToDraft(packetItem)}
                    defaultSortOrder={packetItem.sortOrder}
                    existingLineKeys={lineKeysForPacketCollision(
                      localPacket?.items ?? [],
                      packetItem.id,
                    )}
                    busy={busy}
                    pinnedWorkflowVersionId={pinnedWorkflowVersionId}
                    showAdvancedOptions={false}
                    onCancel={() => {
                      setEditingItemId(null);
                      setError(null);
                    }}
                    submitLabel="Save task"
                    onSubmit={async (draft) => {
                      await handleUpdateTask(packetItem.id, draft);
                    }}
                  />
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-100 leading-snug break-words">{t.title}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{t.stage.displayLabel}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        disabled={busy || !canEditRow}
                        title={
                          !canAddLocalTask
                            ? "This quote isn’t editable here."
                            : !packetItem
                              ? "Set up crew work in Line & tasks"
                              : packetItem.lineKind === "LIBRARY"
                                ? "Edit saved tasks in Line & tasks"
                                : "Edit"
                        }
                        onClick={() => {
                          if (!packetItem || !canEditRow) return;
                          setError(null);
                          setAddOpen(false);
                          setEditingItemId(packetItem.id);
                        }}
                        className={
                          canEditRow && !busy
                            ? "rounded border border-zinc-600 px-1.5 py-0.5 text-[9px] text-zinc-300 hover:bg-zinc-800/80"
                            : "rounded border border-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-600 cursor-not-allowed"
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy || !canDeleteRow}
                        title={!canDeleteRow ? "Set up crew work in Line & tasks" : "Delete"}
                        onClick={() => {
                          if (!packetItem || !canDeleteRow) return;
                          void handleDeleteTask(packetItem.id);
                        }}
                        className={
                          canDeleteRow && !busy
                            ? "rounded border border-red-900/50 px-1.5 py-0.5 text-[9px] text-red-300/95 hover:bg-red-950/30"
                            : "rounded border border-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-600 cursor-not-allowed"
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p className="rounded border border-red-900/55 bg-red-950/25 px-2 py-1.5 text-[11px] text-red-300">
          {error}
        </p>
      ) : null}

      {isCatalogLine ? (
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          This line uses a saved crew list. To add or change tasks, open{" "}
          <Link href={scopeHref} className="font-medium text-sky-400/90 hover:text-sky-300">
            Line &amp; tasks
          </Link>
          .
        </p>
      ) : null}

      {showAddForm ? (
        <EmbeddedTaskAuthoringForm
          key={addFormKey}
          variant="create"
          defaultSortOrder={defaultSortOrder}
          existingLineKeys={existingLineKeys}
          busy={busy}
          pinnedWorkflowVersionId={pinnedWorkflowVersionId}
          showAdvancedOptions={false}
          onCancel={() => {
            setAddOpen(false);
            setError(null);
          }}
          submitLabel="Save task"
          onSubmit={async (draft) => {
            await handleCreateTask(draft);
          }}
        />
      ) : null}

      {canOpenAddForm && !isCatalogLine ? (
        <button
          type="button"
          disabled={busy || addOpen || editingItemId != null}
          onClick={() => {
            setError(null);
            setEditingItemId(null);
            setAddOpen(true);
          }}
          className="inline-flex items-center rounded-md border border-emerald-700/70 bg-emerald-950/35 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-950/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add task
        </button>
      ) : !isCatalogLine && executionMode === "MANIFEST" ? (
        <div className="space-y-1">
          <AddTaskButton disabled reason="Set up crew work in Line & tasks" />
          {!canAuthorTasks ? (
            <p className="text-[10px] text-zinc-600">This quote isn’t editable here.</p>
          ) : preview.kind === "manifestLocal" && (quoteLocalPacketId == null || localPacket == null) ? (
            <p className="text-[10px] text-zinc-600">
              Attach a crew work list in{" "}
              <Link href={scopeHref} className="text-sky-400/90 hover:text-sky-300 underline">
                Line &amp; tasks
              </Link>{" "}
              before adding tasks here.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AddTaskButton({ disabled, reason }: { disabled: boolean; reason: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={reason}
      className="inline-flex items-center rounded-md border border-zinc-700/80 bg-zinc-900/50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 cursor-not-allowed"
    >
      + Add task
    </button>
  );
}
