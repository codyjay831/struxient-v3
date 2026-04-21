"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { QuoteLocalPacketDto, QuoteLocalPacketItemDto } from "@/server/slice1/reads/quote-local-packet-reads";
import {
  TaskDefinitionPicker,
  type SelectedTaskDefinitionSummary,
} from "@/components/quote-scope/task-definition-picker";
import { TargetNodePicker } from "@/components/quote-scope/target-node-picker";

type Props = {
  quoteVersionId: string;
  isDraft: boolean;
  canOfficeMutate: boolean;
  initialPackets: QuoteLocalPacketDto[];
  /**
   * Pinned workflow version id for the host quote version. When non-null, the
   * targetNodeKey field renders as a snapshot-driven picker; when null, it
   * falls back to free-text entry. See TargetNodePicker.
   */
  pinnedWorkflowVersionId: string | null;
};

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

export function QuoteLocalPacketEditor({
  quoteVersionId,
  isDraft,
  canOfficeMutate,
  initialPackets,
  pinnedWorkflowVersionId,
}: Props) {
  const router = useRouter();
  const [packets, setPackets] = useState<QuoteLocalPacketDto[]>(initialPackets);
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Inline new-packet form
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const editable = isDraft && canOfficeMutate;

  function refresh() {
    router.refresh();
  }

  async function handleCreatePacket() {
    if (!editable) return;
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/local-packets`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            displayName: newName,
            description: newDescription.trim() === "" ? null : newDescription,
          }),
        },
      );
      if (!res.ok) {
        setGlobalError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { data: QuoteLocalPacketDto };
      setPackets((prev) => [...prev, body.data]);
      setNewName("");
      setNewDescription("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdatePacket(packetId: string, patch: { displayName?: string; description?: string | null }) {
    if (!editable) return;
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch(`/api/quote-local-packets/${encodeURIComponent(packetId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        setGlobalError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { data: QuoteLocalPacketDto };
      setPackets((prev) => prev.map((p) => (p.id === packetId ? body.data : p)));
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePacket(packetId: string) {
    if (!editable) return;
    if (!window.confirm("Delete this quote-local packet? Items will be removed too.")) return;
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch(`/api/quote-local-packets/${encodeURIComponent(packetId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        setGlobalError(await readApiError(res));
        return;
      }
      setPackets((prev) => prev.filter((p) => p.id !== packetId));
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateItem(packetId: string, draft: NewItemDraft) {
    if (!editable) return;
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch(
        `/api/quote-local-packets/${encodeURIComponent(packetId)}/items`,
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
      setPackets((prev) => prev.map((p) => (p.id === packetId ? body.data : p)));
      refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateItem(
    packetId: string,
    itemId: string,
    patch: Partial<ReturnType<typeof draftToBody>>,
  ) {
    if (!editable) return false;
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch(
        `/api/quote-local-packets/${encodeURIComponent(packetId)}/items/${encodeURIComponent(itemId)}`,
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
      setPackets((prev) => prev.map((p) => (p.id === packetId ? body.data : p)));
      refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function handlePromotePacket(
    packetId: string,
    payload: { packetKey: string; displayName?: string },
  ): Promise<{ ok: true; promotedScopePacketId: string } | { ok: false; error: string }> {
    if (!editable) return { ok: false, error: "Not editable" };
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch(
        `/api/quote-local-packets/${encodeURIComponent(packetId)}/promote`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            packetKey: payload.packetKey.trim(),
            ...(payload.displayName !== undefined ? { displayName: payload.displayName } : {}),
          }),
        },
      );
      if (!res.ok) {
        const msg = await readApiError(res);
        setGlobalError(msg);
        return { ok: false, error: msg };
      }
      const body = (await res.json()) as {
        data: {
          promotion: { promotedScopePacketId: string };
          quoteLocalPacket: QuoteLocalPacketDto | null;
        };
      };
      const refreshed = body.data.quoteLocalPacket;
      if (refreshed) {
        setPackets((prev) => prev.map((p) => (p.id === packetId ? refreshed : p)));
      }
      refresh();
      return { ok: true, promotedScopePacketId: body.data.promotion.promotedScopePacketId };
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteItem(packetId: string, itemId: string) {
    if (!editable) return;
    if (!window.confirm("Delete this packet item?")) return;
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch(
        `/api/quote-local-packets/${encodeURIComponent(packetId)}/items/${encodeURIComponent(itemId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        setGlobalError(await readApiError(res));
        return;
      }
      setPackets((prev) =>
        prev.map((p) =>
          p.id === packetId
            ? { ...p, items: p.items.filter((it) => it.id !== itemId), itemCount: p.itemCount - 1 }
            : p,
        ),
      );
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-baseline justify-between border-b border-zinc-800 pb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Quote-local packets (this version)
        </h2>
        <span className="text-[10px] uppercase font-medium text-zinc-500">
          {packets.length} {packets.length === 1 ? "Packet" : "Packets"}
        </span>
      </div>

      {!isDraft ? (
        <p className="rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300/90">
          This quote version is not in DRAFT status. Quote-local packet authoring is locked.
        </p>
      ) : !canOfficeMutate ? (
        <p className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-400">
          Sign in as an office user with <code className="text-zinc-300">office_mutate</code> to add or edit quote-local packets.
        </p>
      ) : null}

      {globalError ? (
        <p className="rounded border border-red-900/60 bg-red-950/30 px-3 py-2 text-[11px] text-red-300">
          {globalError}
        </p>
      ) : null}

      {packets.length === 0 ? (
        <p className="rounded border border-dashed border-zinc-800 bg-zinc-950/30 px-3 py-3 text-[11px] text-zinc-500">
          No quote-local packets on this version yet. Add one below to author task lines locally without forking the catalog.
        </p>
      ) : (
        <ul className="space-y-4">
          {packets.map((packet) => (
            <PacketRow
              key={packet.id}
              packet={packet}
              editable={editable}
              busy={busy}
              pinnedWorkflowVersionId={pinnedWorkflowVersionId}
              onUpdatePacket={(patch) => handleUpdatePacket(packet.id, patch)}
              onDeletePacket={() => handleDeletePacket(packet.id)}
              onCreateItem={(draft) => handleCreateItem(packet.id, draft)}
              onUpdateItem={(itemId, patch) => handleUpdateItem(packet.id, itemId, patch)}
              onDeleteItem={(itemId) => handleDeleteItem(packet.id, itemId)}
              onPromotePacket={(payload) => handlePromotePacket(packet.id, payload)}
            />
          ))}
        </ul>
      )}

      {editable ? (
        <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            New quote-local packet
          </p>
          <input
            type="text"
            placeholder="Display name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={busy}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            disabled={busy}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy || newName.trim() === ""}
              onClick={() => void handleCreatePacket()}
              className="rounded bg-emerald-800/90 px-3 py-1 text-[11px] font-medium text-emerald-50 hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Working…" : "Create packet"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ───────────────────────── Packet row ───────────────────────── */

type PromotePayload = { packetKey: string; displayName?: string };
type PromoteResult =
  | { ok: true; promotedScopePacketId: string }
  | { ok: false; error: string };

type PacketRowProps = {
  packet: QuoteLocalPacketDto;
  editable: boolean;
  busy: boolean;
  pinnedWorkflowVersionId: string | null;
  onUpdatePacket: (patch: { displayName?: string; description?: string | null }) => void;
  onDeletePacket: () => void;
  onCreateItem: (draft: NewItemDraft) => Promise<boolean | undefined>;
  onUpdateItem: (
    itemId: string,
    patch: Partial<ReturnType<typeof draftToBody>>,
  ) => Promise<boolean | undefined>;
  onDeleteItem: (itemId: string) => void;
  onPromotePacket: (payload: PromotePayload) => Promise<PromoteResult>;
};

function PacketRow({
  packet,
  editable,
  busy,
  pinnedWorkflowVersionId,
  onUpdatePacket,
  onDeletePacket,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onPromotePacket,
}: PacketRowProps) {
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState(packet.displayName);
  const [headerDescription, setHeaderDescription] = useState(packet.description ?? "");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showPromote, setShowPromote] = useState(false);
  const pinned = packet.pinnedByLineItemCount > 0;
  const canPromote = editable && packet.promotionStatus === "NONE" && packet.itemCount > 0;
  const isPromoted =
    packet.promotionStatus === "COMPLETED" && packet.promotedScopePacketId !== null;

  return (
    <li className="rounded border border-zinc-800 bg-zinc-950/40 p-3">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-800 pb-2 mb-3">
        <div className="min-w-0 flex-1">
          {editingHeader ? (
            <div className="space-y-2">
              <input
                type="text"
                value={headerName}
                onChange={(e) => setHeaderName(e.target.value)}
                disabled={busy}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
              />
              <input
                type="text"
                value={headerDescription}
                onChange={(e) => setHeaderDescription(e.target.value)}
                disabled={busy}
                placeholder="Description (optional)"
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || headerName.trim() === ""}
                  onClick={() => {
                    onUpdatePacket({
                      displayName: headerName,
                      description: headerDescription.trim() === "" ? null : headerDescription,
                    });
                    setEditingHeader(false);
                  }}
                  className="rounded bg-sky-800/90 px-2 py-0.5 text-[11px] text-sky-50 hover:bg-sky-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingHeader(false);
                    setHeaderName(packet.displayName);
                    setHeaderDescription(packet.description ?? "");
                  }}
                  className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-zinc-100">{packet.displayName}</p>
              {packet.description ? (
                <p className="text-[11px] text-zinc-500 mt-0.5">{packet.description}</p>
              ) : null}
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-zinc-500">
                <span className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono">{packet.id}</span>
                <span className="rounded border border-zinc-700/60 bg-zinc-900/40 px-1.5 py-0.5">
                  origin: {packet.originType}
                </span>
                <span className="rounded border border-zinc-700/60 bg-zinc-900/40 px-1.5 py-0.5">
                  items: {packet.itemCount}
                </span>
                {pinned ? (
                  <span className="rounded border border-amber-800/60 bg-amber-950/30 px-1.5 py-0.5 text-amber-400">
                    pinned by {packet.pinnedByLineItemCount} line item(s)
                  </span>
                ) : null}
                <span
                  className={`rounded border px-1.5 py-0.5 ${
                    isPromoted
                      ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-300"
                      : "border-zinc-700/60 bg-zinc-900/40 text-zinc-400"
                  }`}
                  title="QuoteLocalPacket.promotionStatus"
                >
                  promotion: {packet.promotionStatus}
                </span>
                {isPromoted && packet.promotedScopePacketId ? (
                  <a
                    href={`/library/packets/${encodeURIComponent(packet.promotedScopePacketId)}`}
                    className="rounded border border-emerald-800/60 bg-emerald-950/30 px-1.5 py-0.5 text-emerald-300 hover:text-emerald-200"
                  >
                    open promoted packet ↗
                  </a>
                ) : null}
              </div>
            </>
          )}
        </div>
        {editable && !editingHeader ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setEditingHeader(true)}
              className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busy || pinned}
              onClick={onDeletePacket}
              title={
                pinned
                  ? "Detach pinning line items first."
                  : "Delete this packet and all its items."
              }
              className="rounded border border-red-900/60 px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        ) : null}
      </header>

      <ItemsTable
        items={packet.items}
        editable={editable}
        busy={busy}
        pinnedWorkflowVersionId={pinnedWorkflowVersionId}
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
      />

      {canPromote ? (
        <div className="mt-3">
          {showPromote ? (
            <PromoteForm
              busy={busy}
              defaultDisplayName={packet.displayName}
              onCancel={() => setShowPromote(false)}
              onSubmit={async (payload) => {
                const result = await onPromotePacket(payload);
                if (result.ok) setShowPromote(false);
                return result;
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowPromote(true)}
              className="rounded border border-violet-800/60 bg-violet-950/20 px-2 py-0.5 text-[11px] text-violet-300 hover:text-violet-200"
              title="Promote this quote-local packet to a new catalog ScopePacket (DRAFT revision)."
            >
              ↑ Promote to catalog (DRAFT revision)
            </button>
          )}
        </div>
      ) : null}

      {editable ? (
        <div className="mt-3">
          {showAddItem ? (
            <NewItemForm
              busy={busy}
              pinnedWorkflowVersionId={pinnedWorkflowVersionId}
              defaultSortOrder={
                packet.items.length > 0
                  ? Math.max(...packet.items.map((i) => i.sortOrder)) + 1
                  : 0
              }
              onCancel={() => setShowAddItem(false)}
              onSubmit={async (draft) => {
                const ok = await onCreateItem(draft);
                if (ok) setShowAddItem(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAddItem(true)}
              className="rounded border border-emerald-800/60 bg-emerald-950/30 px-2 py-0.5 text-[11px] text-emerald-300 hover:text-emerald-200"
            >
              + Add item
            </button>
          )}
        </div>
      ) : null}
    </li>
  );
}

/* ───────────────────────── Items table ───────────────────────── */

type ItemsTableProps = {
  items: QuoteLocalPacketItemDto[];
  editable: boolean;
  busy: boolean;
  pinnedWorkflowVersionId: string | null;
  onUpdateItem: (
    itemId: string,
    patch: Partial<ReturnType<typeof draftToBody>>,
  ) => Promise<boolean | undefined>;
  onDeleteItem: (itemId: string) => void;
};

function ItemsTable({
  items,
  editable,
  busy,
  pinnedWorkflowVersionId,
  onUpdateItem,
  onDeleteItem,
}: ItemsTableProps) {
  if (items.length === 0) {
    return (
      <p className="rounded border border-dashed border-zinc-800 bg-zinc-950/30 px-3 py-2 text-[11px] text-zinc-500">
        No items on this packet yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-zinc-800">
      <table className="w-full text-left text-[11px] text-zinc-300">
        <thead className="bg-zinc-900/60 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-2 py-1.5">Order</th>
            <th className="px-2 py-1.5">Line key</th>
            <th className="px-2 py-1.5">Kind</th>
            <th className="px-2 py-1.5">Title / source</th>
            <th className="px-2 py-1.5">Target node</th>
            <th className="px-2 py-1.5">Tier</th>
            {editable ? <th className="px-2 py-1.5 text-right">Actions</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              editable={editable}
              busy={busy}
              pinnedWorkflowVersionId={pinnedWorkflowVersionId}
              onUpdateItem={onUpdateItem}
              onDeleteItem={onDeleteItem}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemRow({
  item,
  editable,
  busy,
  pinnedWorkflowVersionId,
  onUpdateItem,
  onDeleteItem,
}: {
  item: QuoteLocalPacketItemDto;
  editable: boolean;
  busy: boolean;
  pinnedWorkflowVersionId: string | null;
  onUpdateItem: (
    itemId: string,
    patch: Partial<ReturnType<typeof draftToBody>>,
  ) => Promise<boolean | undefined>;
  onDeleteItem: (itemId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NewItemDraft>(itemToDraft(item));

  if (editing) {
    return (
      <tr>
        <td colSpan={editable ? 7 : 6} className="px-2 py-2">
          <ItemForm
            draft={draft}
            busy={busy}
            onChange={setDraft}
            pinnedWorkflowVersionId={pinnedWorkflowVersionId}
            initialTaskDefinitionId={item.taskDefinitionId}
            initialTaskDefinitionSummary={item.taskDefinition}
            actions={
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await onUpdateItem(item.id, draftToBody(draft));
                    if (ok) setEditing(false);
                  }}
                  className="rounded bg-sky-800/90 px-2 py-0.5 text-[11px] text-sky-50 hover:bg-sky-700 disabled:opacity-50"
                >
                  Save item
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setDraft(itemToDraft(item));
                  }}
                  className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
              </div>
            }
          />
        </td>
      </tr>
    );
  }

  const summary = item.lineKind === "LIBRARY"
    ? item.taskDefinition
      ? `${item.taskDefinition.displayName} (${item.taskDefinition.taskKey})`
      : `taskDefinitionId: ${item.taskDefinitionId ?? "—"}`
    : readEmbeddedTitle(item.embeddedPayloadJson) ?? item.lineKey;

  return (
    <tr className="hover:bg-zinc-800/40">
      <td className="px-2 py-1.5 font-mono text-zinc-400">{item.sortOrder}</td>
      <td className="px-2 py-1.5 font-mono text-zinc-300">{item.lineKey}</td>
      <td className="px-2 py-1.5">
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
            item.lineKind === "LIBRARY"
              ? "border border-sky-800/60 bg-sky-950/30 text-sky-400"
              : "border border-zinc-700/60 bg-zinc-800/30 text-zinc-400"
          }`}
        >
          {item.lineKind}
        </span>
      </td>
      <td className="px-2 py-1.5">
        <p className="text-zinc-200">{summary}</p>
        {item.lineKind === "LIBRARY" && item.taskDefinition?.status !== "PUBLISHED" && item.taskDefinition ? (
          <p className="text-[10px] text-amber-400 mt-0.5">
            TaskDefinition status: {item.taskDefinition.status}
          </p>
        ) : null}
      </td>
      <td className="px-2 py-1.5 font-mono text-zinc-400">{item.targetNodeKey}</td>
      <td className="px-2 py-1.5 font-mono text-zinc-400">{item.tierCode ?? "—"}</td>
      {editable ? (
        <td className="px-2 py-1.5 text-right">
          <div className="inline-flex gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDeleteItem(item.id)}
              className="rounded border border-red-900/60 px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300 disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </td>
      ) : null}
    </tr>
  );
}

/* ─────────────────────── Item draft / form ─────────────────────── */

type NewItemDraft = {
  lineKey: string;
  sortOrder: number;
  tierCode: string;
  lineKind: "EMBEDDED" | "LIBRARY";
  embeddedTitle: string;
  embeddedTaskKind: string;
  embeddedInstructions: string;
  taskDefinitionId: string;
  targetNodeKey: string;
};

function emptyDraft(sortOrder = 0): NewItemDraft {
  return {
    lineKey: "",
    sortOrder,
    tierCode: "",
    lineKind: "EMBEDDED",
    embeddedTitle: "",
    embeddedTaskKind: "",
    embeddedInstructions: "",
    taskDefinitionId: "",
    targetNodeKey: "",
  };
}

function itemToDraft(item: QuoteLocalPacketItemDto): NewItemDraft {
  const embedded = (item.embeddedPayloadJson ?? null) as Record<string, unknown> | null;
  return {
    lineKey: item.lineKey,
    sortOrder: item.sortOrder,
    tierCode: item.tierCode ?? "",
    lineKind: item.lineKind,
    embeddedTitle: typeof embedded?.title === "string" ? (embedded.title as string) : "",
    embeddedTaskKind: typeof embedded?.taskKind === "string" ? (embedded.taskKind as string) : "",
    embeddedInstructions:
      typeof embedded?.instructions === "string" ? (embedded.instructions as string) : "",
    taskDefinitionId: item.taskDefinitionId ?? "",
    targetNodeKey: item.targetNodeKey,
  };
}

function draftToBody(draft: NewItemDraft) {
  const embedded =
    draft.lineKind === "EMBEDDED"
      ? buildEmbeddedPayload(draft)
      : null;
  return {
    lineKey: draft.lineKey.trim(),
    sortOrder: draft.sortOrder,
    tierCode: draft.tierCode.trim() === "" ? null : draft.tierCode,
    lineKind: draft.lineKind,
    embeddedPayloadJson: embedded,
    taskDefinitionId:
      draft.lineKind === "LIBRARY" ? draft.taskDefinitionId.trim() || null : null,
    targetNodeKey: draft.targetNodeKey.trim(),
  };
}

function buildEmbeddedPayload(draft: NewItemDraft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (draft.embeddedTitle.trim() !== "") out.title = draft.embeddedTitle.trim();
  if (draft.embeddedTaskKind.trim() !== "") out.taskKind = draft.embeddedTaskKind.trim();
  if (draft.embeddedInstructions.trim() !== "") out.instructions = draft.embeddedInstructions.trim();
  return out;
}

function readEmbeddedTitle(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
  const t = (payload as Record<string, unknown>).title;
  return typeof t === "string" ? t : null;
}

function NewItemForm({
  defaultSortOrder,
  busy,
  pinnedWorkflowVersionId,
  onCancel,
  onSubmit,
}: {
  defaultSortOrder: number;
  busy: boolean;
  pinnedWorkflowVersionId: string | null;
  onCancel: () => void;
  onSubmit: (draft: NewItemDraft) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<NewItemDraft>(() => emptyDraft(defaultSortOrder));
  const valid = useMemo(
    () => draft.lineKey.trim() !== "" && draft.targetNodeKey.trim() !== "",
    [draft.lineKey, draft.targetNodeKey],
  );

  return (
    <div className="rounded border border-emerald-900/40 bg-emerald-950/10 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80 mb-2">
        New item
      </p>
      <ItemForm
        draft={draft}
        busy={busy}
        onChange={setDraft}
        pinnedWorkflowVersionId={pinnedWorkflowVersionId}
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !valid}
              onClick={() => void onSubmit(draft)}
              className="rounded bg-emerald-800/90 px-2 py-0.5 text-[11px] font-medium text-emerald-50 hover:bg-emerald-700 disabled:opacity-50"
            >
              Add item
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        }
      />
    </div>
  );
}

function ItemForm({
  draft,
  busy,
  onChange,
  actions,
  pinnedWorkflowVersionId,
  initialTaskDefinitionId,
  initialTaskDefinitionSummary,
}: {
  draft: NewItemDraft;
  busy: boolean;
  onChange: (next: NewItemDraft) => void;
  actions: React.ReactNode;
  pinnedWorkflowVersionId: string | null;
  initialTaskDefinitionId?: string | null;
  initialTaskDefinitionSummary?: SelectedTaskDefinitionSummary | null;
}) {
  function set<K extends keyof NewItemDraft>(key: K, value: NewItemDraft[K]) {
    onChange({ ...draft, [key]: value });
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
      <label className="space-y-1">
        <span className="block text-zinc-500">Line key</span>
        <input
          type="text"
          value={draft.lineKey}
          onChange={(e) => set("lineKey", e.target.value)}
          disabled={busy}
          placeholder="e.g. inspect-1"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
        />
      </label>
      <label className="space-y-1">
        <span className="block text-zinc-500">Sort order</span>
        <input
          type="number"
          value={draft.sortOrder}
          onChange={(e) => set("sortOrder", Number.parseInt(e.target.value || "0", 10))}
          disabled={busy}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
        />
      </label>
      <div className="space-y-1">
        <span className="block text-zinc-500">Target node key</span>
        <TargetNodePicker
          pinnedWorkflowVersionId={pinnedWorkflowVersionId}
          value={draft.targetNodeKey}
          disabled={busy}
          onChange={(next) => set("targetNodeKey", next)}
        />
      </div>
      <label className="space-y-1">
        <span className="block text-zinc-500">Tier (optional)</span>
        <input
          type="text"
          value={draft.tierCode}
          onChange={(e) => set("tierCode", e.target.value)}
          disabled={busy}
          placeholder="GOOD / BETTER / BEST / blank = all"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
        />
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="block text-zinc-500">Line kind</span>
        <div className="flex gap-3">
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              name={`kind-${draft.lineKey}`}
              checked={draft.lineKind === "EMBEDDED"}
              onChange={() => set("lineKind", "EMBEDDED")}
              disabled={busy}
            />
            <span>Embedded (inline meaning)</span>
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              name={`kind-${draft.lineKey}`}
              checked={draft.lineKind === "LIBRARY"}
              onChange={() => set("lineKind", "LIBRARY")}
              disabled={busy}
            />
            <span>Library (TaskDefinition reference)</span>
          </label>
        </div>
      </label>

      {draft.lineKind === "EMBEDDED" ? (
        <>
          <label className="space-y-1 sm:col-span-2">
            <span className="block text-zinc-500">Embedded title</span>
            <input
              type="text"
              value={draft.embeddedTitle}
              onChange={(e) => set("embeddedTitle", e.target.value)}
              disabled={busy}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-zinc-500">Embedded task kind (optional)</span>
            <input
              type="text"
              value={draft.embeddedTaskKind}
              onChange={(e) => set("embeddedTaskKind", e.target.value)}
              disabled={busy}
              placeholder="INSPECT / INSTALL / …"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="block text-zinc-500">Embedded instructions (optional)</span>
            <textarea
              rows={2}
              value={draft.embeddedInstructions}
              onChange={(e) => set("embeddedInstructions", e.target.value)}
              disabled={busy}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
            />
          </label>
        </>
      ) : (
        <div className="space-y-1 sm:col-span-2">
          <span className="block text-zinc-500">TaskDefinition (library link)</span>
          <TaskDefinitionPicker
            initialSelectedId={initialTaskDefinitionId ?? null}
            initialSelectedSummary={initialTaskDefinitionSummary ?? null}
            value={draft.taskDefinitionId.trim() === "" ? null : draft.taskDefinitionId}
            disabled={busy}
            onChange={({ id }) => set("taskDefinitionId", id ?? "")}
          />
        </div>
      )}

      <div className="sm:col-span-2 flex justify-end mt-1">{actions}</div>
    </div>
  );
}

/* ───────────────────────── Promote form ───────────────────────── */

const PROMOTE_HELP_TEXT =
  "This creates a NEW catalog ScopePacket on this tenant with a first DRAFT revision and copies every item as a packet task line. The action is irreversible — once promoted, the source packet is locked to COMPLETED and the new catalog packet exists permanently. Future picker visibility (PUBLISHED only) is handled by a later admin-review epic.";

function PromoteForm({
  busy,
  defaultDisplayName,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  defaultDisplayName: string;
  onCancel: () => void;
  onSubmit: (payload: PromotePayload) => Promise<PromoteResult>;
}) {
  const [packetKey, setPacketKey] = useState("");
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [confirmed, setConfirmed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const trimmedKey = packetKey.trim();
  // UI mirror of the server-side slug rule. The server is the source of truth;
  // this is just an early hint so estimators don't submit obvious typos.
  const looksValid =
    trimmedKey.length >= 2 &&
    trimmedKey.length <= 80 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(trimmedKey);
  const canSubmit = looksValid && confirmed && !busy;

  return (
    <div className="rounded border border-violet-900/40 bg-violet-950/10 p-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">
        Promote to catalog (DRAFT revision)
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-400">{PROMOTE_HELP_TEXT}</p>
      <label className="block text-[11px] space-y-1">
        <span className="block text-zinc-500">
          packetKey <span className="text-zinc-600">(slug; lowercase letters/digits/hyphens; unique on this tenant; immutable after promotion)</span>
        </span>
        <input
          type="text"
          value={packetKey}
          onChange={(e) => {
            setPacketKey(e.target.value);
            setLocalError(null);
          }}
          disabled={busy}
          placeholder="e.g. roof-tear-off-v1"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
        />
        {!looksValid && trimmedKey !== "" ? (
          <span className="block text-[10px] text-amber-300/80">
            Must be 2–80 chars, lowercase letters/digits/hyphens, starting and ending with an alphanumeric.
          </span>
        ) : null}
      </label>
      <label className="block text-[11px] space-y-1">
        <span className="block text-zinc-500">
          displayName <span className="text-zinc-600">(optional override; defaults to source displayName)</span>
        </span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={busy}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
        />
      </label>
      <label className="flex items-start gap-2 text-[11px] text-zinc-400">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={busy}
          className="mt-0.5"
        />
        <span>
          I understand this is irreversible: a new catalog ScopePacket will be created and the source quote-local packet will be locked to <code className="text-zinc-300">promotionStatus = COMPLETED</code>.
        </span>
      </label>
      {localError ? (
        <p className="rounded border border-red-900/60 bg-red-950/30 px-2 py-1 text-[11px] text-red-300">
          {localError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={async () => {
            const overrideName = displayName.trim();
            const sourceDefault = defaultDisplayName.trim();
            const payload: PromotePayload = {
              packetKey: trimmedKey,
              ...(overrideName !== "" && overrideName !== sourceDefault
                ? { displayName: overrideName }
                : {}),
            };
            const result = await onSubmit(payload);
            if (!result.ok) {
              setLocalError(result.error);
            }
          }}
          className="rounded bg-violet-700/90 px-3 py-1 text-[11px] font-semibold text-violet-50 hover:bg-violet-600 disabled:opacity-50"
        >
          {busy ? "Promoting…" : "Promote (irreversible)"}
        </button>
      </div>
    </div>
  );
}
