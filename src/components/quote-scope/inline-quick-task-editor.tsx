"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { QuoteLocalPacketDto, QuoteLocalPacketItemDto } from "@/server/slice1/reads/quote-local-packet-reads";
import {
  EmbeddedTaskAuthoringForm,
  LibraryItemEditor,
  LibraryTaskCreateForm,
} from "@/components/quote-scope/quote-local-packet-task-forms";
import { humanizeCanonicalExecutionStageKey } from "@/lib/canonical-execution-stages";
import {
  draftToBody,
  itemToDraft,
  lineKeysForPacketCollision,
  readEmbeddedInstructions,
  readEmbeddedTitle,
  type NewItemDraft,
} from "@/lib/quote-local-packet-item-authoring";

type ApiErrorBody = { error?: { code?: string; message?: string } };

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

function taskRowPresentation(item: QuoteLocalPacketItemDto): {
  title: string;
  notes: string;
  libraryBadge: boolean;
} {
  const embeddedTitle = readEmbeddedTitle(item.embeddedPayloadJson);
  const embeddedInstructions = readEmbeddedInstructions(item.embeddedPayloadJson);
  const title =
    item.lineKind === "LIBRARY"
      ? item.taskDefinition?.displayName ?? "Saved task definition"
      : embeddedTitle && embeddedTitle.trim() !== ""
        ? embeddedTitle
        : "Untitled task";
  const notes =
    item.lineKind === "LIBRARY"
      ? "From saved catalog"
      : embeddedInstructions && embeddedInstructions.trim() !== ""
        ? embeddedInstructions.length > 100
          ? `${embeddedInstructions.slice(0, 100)}…`
          : embeddedInstructions
        : "—";
  return { title, notes, libraryBadge: item.lineKind === "LIBRARY" };
}

export type InlineQuickTaskEditorProps = {
  initialPacket: QuoteLocalPacketDto;
  pinnedWorkflowVersionId: string | null;
  isDraft: boolean;
  canOfficeMutate: boolean;
  onClose?: () => void;
};

/**
 * Workspace-only quick task editing under a line item preview: list/add/edit/delete
 * lines on one quote-local packet without packet-admin chrome. Uses the same item
 * API routes as {@link QuoteLocalPacketEditor}.
 */
export function InlineQuickTaskEditor({
  initialPacket,
  pinnedWorkflowVersionId,
  isDraft,
  canOfficeMutate,
  onClose,
}: InlineQuickTaskEditorProps) {
  const router = useRouter();
  const [packet, setPacket] = useState<QuoteLocalPacketDto>(initialPacket);
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<"none" | "embedded" | "library">("none");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  useEffect(() => {
    setPacket(initialPacket);
  }, [initialPacket]);

  const editable = isDraft && canOfficeMutate;

  function refresh() {
    router.refresh();
  }

  async function handleCreateItem(draft: NewItemDraft): Promise<boolean> {
    if (!editable) return false;
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch(
        `/api/quote-local-packets/${encodeURIComponent(packet.id)}/items`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(draftToBody(draft)),
        },
      );
      if (!res.ok) {
        setGlobalError(await readApiError(res));
        return false;
      }
      const body = (await res.json()) as { data: QuoteLocalPacketDto };
      setPacket(body.data);
      refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateItem(
    itemId: string,
    patch: Partial<ReturnType<typeof draftToBody>>,
  ): Promise<boolean> {
    if (!editable) return false;
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch(
        `/api/quote-local-packets/${encodeURIComponent(packet.id)}/items/${encodeURIComponent(itemId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(patch),
        },
      );
      if (!res.ok) {
        setGlobalError(await readApiError(res));
        return false;
      }
      const body = (await res.json()) as { data: QuoteLocalPacketDto };
      setPacket(body.data);
      refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!editable) return;
    if (!window.confirm("Delete this task?")) return;
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch(
        `/api/quote-local-packets/${encodeURIComponent(packet.id)}/items/${encodeURIComponent(itemId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        setGlobalError(await readApiError(res));
        return;
      }
      setPacket((prev) => ({
        ...prev,
        items: prev.items.filter((it) => it.id !== itemId),
        itemCount: Math.max(0, prev.itemCount - 1),
      }));
      if (editingItemId === itemId) setEditingItemId(null);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  const defaultSortOrder =
    packet.items.length > 0 ? Math.max(...packet.items.map((i) => i.sortOrder)) + 1 : 0;
  const existingLineKeys = packet.items.map((i) => i.lineKey);
  const suppressAddBar = addMode !== "none" || editingItemId !== null;

  return (
    <div className="mt-1.5 ml-1.5 min-w-0 border-l-2 border-zinc-600/40 pl-2.5 sm:ml-2 sm:pl-3 space-y-2">
      {onClose ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300 underline underline-offset-2 decoration-zinc-600"
          >
            Close
          </button>
        </div>
      ) : null}

      {globalError ? (
        <p className="rounded border border-red-900/60 bg-red-950/30 px-2 py-1.5 text-[11px] text-red-300">
          {globalError}
        </p>
      ) : null}

      <div className="rounded-md border border-zinc-800/55 bg-zinc-950/40 px-2.5 py-2 sm:px-3 space-y-2">
        {packet.items.length === 0 ? (
          <p className="text-xs text-zinc-400 leading-relaxed">
            No crew tasks yet. Use + Add task below.
          </p>
        ) : (
          <ul className="space-y-1.5 list-none p-0 m-0">
            {packet.items.map((item) => {
              const { title, notes, libraryBadge } = taskRowPresentation(item);
              const isEditing = editingItemId === item.id;
              return (
                <li key={item.id} className="min-w-0">
                  {!isEditing ? (
                    <div className="flex flex-wrap items-start gap-x-2 gap-y-1 rounded border border-zinc-800/50 bg-zinc-900/35 px-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        {libraryBadge ? (
                          <p className="text-[9px] font-medium uppercase tracking-wide text-sky-400/85">
                            From catalog
                          </p>
                        ) : null}
                        <p className="text-xs font-semibold text-zinc-100 leading-snug break-words">{title}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {humanizeCanonicalExecutionStageKey(item.targetNodeKey)}
                        </p>
                        <p className="text-[10px] text-zinc-500/90 mt-0.5 line-clamp-2 break-words">{notes}</p>
                      </div>
                      {editable ? (
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAddMode("none");
                              setEditingItemId(item.id);
                            }}
                            disabled={busy}
                            className="rounded border border-zinc-700/80 px-1.5 py-0.5 text-[9px] text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleDeleteItem(item.id)}
                            className="rounded border border-red-900/55 px-1.5 py-0.5 text-[9px] text-red-400/95 hover:text-red-300 disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="min-w-0">
                      {item.lineKind === "LIBRARY" ? (
                        <LibraryItemEditor
                          item={item}
                          busy={busy}
                          collisionKeys={lineKeysForPacketCollision(packet.items, item.id)}
                          pinnedWorkflowVersionId={pinnedWorkflowVersionId}
                          onCancel={() => setEditingItemId(null)}
                          onSave={async (draft) => {
                            const ok = await handleUpdateItem(item.id, draftToBody(draft));
                            if (ok) setEditingItemId(null);
                          }}
                        />
                      ) : (
                        <EmbeddedTaskAuthoringForm
                          variant="edit"
                          initialDraft={itemToDraft(item)}
                          defaultSortOrder={item.sortOrder}
                          existingLineKeys={lineKeysForPacketCollision(packet.items, item.id)}
                          busy={busy}
                          pinnedWorkflowVersionId={pinnedWorkflowVersionId}
                          onCancel={() => setEditingItemId(null)}
                          submitLabel="Save task"
                          onSubmit={async (draft) => {
                            const ok = await handleUpdateItem(item.id, draftToBody(draft));
                            if (ok) setEditingItemId(null);
                          }}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {addMode === "embedded" ? (
          <EmbeddedTaskAuthoringForm
            key={`add-emb-${packet.id}-${packet.items.length}`}
            variant="create"
            defaultSortOrder={defaultSortOrder}
            existingLineKeys={existingLineKeys}
            busy={busy}
            pinnedWorkflowVersionId={pinnedWorkflowVersionId}
            onCancel={() => setAddMode("none")}
            submitLabel="Save task"
            onSubmit={async (draft) => {
              const ok = await handleCreateItem(draft);
              if (ok) setAddMode("none");
            }}
          />
        ) : null}

        {addMode === "library" ? (
          <LibraryTaskCreateForm
            key={`add-lib-${packet.id}-${packet.items.length}`}
            busy={busy}
            pinnedWorkflowVersionId={pinnedWorkflowVersionId}
            defaultSortOrder={defaultSortOrder}
            existingLineKeys={existingLineKeys}
            onCancel={() => setAddMode("none")}
            onSubmit={async (draft) => {
              const ok = await handleCreateItem(draft);
              if (ok) setAddMode("none");
            }}
          />
        ) : null}

        {editable && !suppressAddBar ? (
          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setEditingItemId(null);
                setAddMode("embedded");
              }}
              className={
                packet.items.length === 0
                  ? "rounded-md bg-emerald-700/95 px-2.5 py-1 text-[11px] font-semibold text-emerald-50 hover:bg-emerald-600"
                  : "rounded-md border border-emerald-700/70 bg-emerald-950/35 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-950/50"
              }
            >
              + Add task
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingItemId(null);
                setAddMode("library");
              }}
              className="rounded-md border border-zinc-600/80 bg-zinc-900/60 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
            >
              + From catalog
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
