"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  readCompletionRequirementCount,
  readEmbeddedInstructions,
  readEmbeddedTitle,
  type NewItemDraft,
} from "@/lib/quote-local-packet-item-authoring";
import { formatQuoteLocalPacketPromotionStatusLabel } from "@/lib/quote-local-packet-promotion-status-label";

/**
 * Saved-packet summary row used by the "Add to existing saved template"
 * promotion picker. Sourced from `listScopePacketsForTenant` so we don't
 * need a second fetch — the office scope page already loads it for the
 * library/local packet pickers above.
 */
export type SavedPacketOption = {
  id: string;
  packetKey: string;
  displayName: string;
  /** True when at least one revision on the packet is currently DRAFT. */
  hasDraftRevision: boolean;
};

type Props = {
  quoteVersionId: string;
  isDraft: boolean;
  canOfficeMutate: boolean;
  initialPackets: QuoteLocalPacketDto[];
  /**
   * Pinned workflow version id for the host quote version. When non-null, the
   * Stage field renders as a snapshot-driven picker populated from that
   * workflow's snapshot nodes. When null, the picker LOCKS in
   * `quoteScopeStage` mode and the author must pin a workflow first — we no
   * longer accept free-text node ids in normal quote authoring (Triangle
   * Mode). See `TargetNodePicker` (`target-node-picker.tsx`).
   */
  pinnedWorkflowVersionId: string | null;
  /**
   * Tenant catalog packets used by the secondary promotion path "Add to
   * existing saved template as new draft revision". Optional so dev /
   * read-only mounts can omit it; when missing or empty, the affordance
   * is hidden entirely (the existing promote-to-NEW path stays available).
   */
  availableSavedPackets?: SavedPacketOption[];
  /**
   * Line titles that pin each local packet (from scope line items). Presentation-only;
   * derived on the scope page without changing packet read APIs.
   */
  lineItemTitlesByLocalPacketId?: Record<string, string[]>;
  /** Override primary heading (e.g. secondary “unattached” disclosure on the quote workspace). */
  sectionTitle?: string;
  /** Override section `id` for anchors (avoid duplicate ids when multiple mounts exist). */
  sectionDomId?: string;
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
  availableSavedPackets,
  lineItemTitlesByLocalPacketId,
  sectionTitle = "Custom work on this quote",
  sectionDomId = "quote-local-field-work",
}: Props) {
  const router = useRouter();
  const [packets, setPackets] = useState<QuoteLocalPacketDto[]>(initialPackets);
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  /** Brief ring highlight when URL hash targets `#field-work-{packetId}`. */
  const [hashHighlightPacketId, setHashHighlightPacketId] = useState<string | null>(null);

  // After `router.refresh()`, the server re-renders this client boundary with a new
  // `initialPackets` reference (e.g. field work created from a line item above). Without
  // syncing, `packets` would stay frozen at first mount and the lower editor would miss
  // new groups until a full reload. Mutations in this component still update `packets`
  // locally; the next refresh aligns with the server snapshot.
  useEffect(() => {
    setPackets(initialPackets);
  }, [initialPackets]);

  // Inline new-packet form
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const editable = isDraft && canOfficeMutate;

  useEffect(() => {
    let highlightTimer: ReturnType<typeof setTimeout> | undefined;
    const applyHash = () => {
      if (highlightTimer) clearTimeout(highlightTimer);
      const raw = window.location.hash.replace(/^#/, "");
      if (!raw.startsWith("field-work-")) {
        setHashHighlightPacketId(null);
        return;
      }
      const packetId = raw.slice("field-work-".length);
      if (!packets.some((p) => p.id === packetId)) {
        setHashHighlightPacketId(null);
        return;
      }
      setHashHighlightPacketId(packetId);
      requestAnimationFrame(() => {
        document.getElementById(`field-work-${packetId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      highlightTimer = setTimeout(() => setHashHighlightPacketId(null), 2400);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      if (highlightTimer) clearTimeout(highlightTimer);
    };
  }, [packets]);

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
    if (!window.confirm("Delete this custom work? All tasks inside it will be removed too.")) return;
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

  /**
   * Secondary promotion path: copy this quote-local packet into an EXISTING
   * tenant `ScopePacket` as the next editable DRAFT revision. Hits the
   * same `/promote` endpoint as the primary path; the API dispatches on
   * body shape (`targetScopePacketId` ⇒ this path).
   *
   * UX contract: on success, return the destination ids so the caller
   * (PromoteIntoExistingForm) can navigate the user straight to the new
   * draft revision in the office library — they will edit/publish from
   * there, NOT from this surface.
   */
  async function handlePromotePacketIntoExisting(
    packetId: string,
    payload: { targetScopePacketId: string },
  ): Promise<
    | { ok: true; targetScopePacketId: string; revisionId: string }
    | { ok: false; error: string }
  > {
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
          body: JSON.stringify({ targetScopePacketId: payload.targetScopePacketId }),
        },
      );
      if (!res.ok) {
        const msg = await readApiError(res);
        setGlobalError(msg);
        return { ok: false, error: msg };
      }
      const body = (await res.json()) as {
        data: {
          promotion: {
            promotedScopePacketId: string;
            scopePacketRevision: { id: string };
          };
          quoteLocalPacket: QuoteLocalPacketDto | null;
        };
      };
      const refreshed = body.data.quoteLocalPacket;
      if (refreshed) {
        setPackets((prev) => prev.map((p) => (p.id === packetId ? refreshed : p)));
      }
      refresh();
      return {
        ok: true,
        targetScopePacketId: body.data.promotion.promotedScopePacketId,
        revisionId: body.data.promotion.scopePacketRevision.id,
      };
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteItem(packetId: string, itemId: string) {
    if (!editable) return;
    if (!window.confirm("Delete this task?")) return;
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
    <section id={sectionDomId} className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800/90 pb-3">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">{sectionTitle}</h2>
        <span className="text-xs font-normal text-zinc-500 normal-case">
          {packets.length} custom work groups
        </span>
      </div>

      {!isDraft ? (
        <p className="rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300/90">
          This quote version is no longer a draft. This custom work can&rsquo;t be edited here.
        </p>
      ) : !canOfficeMutate ? (
        <p className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-400">
          Sign in as an office user with <code className="text-zinc-300">office_mutate</code> to add or edit custom work on this quote.
        </p>
      ) : null}

      {globalError ? (
        <p className="rounded border border-red-900/60 bg-red-950/30 px-3 py-2 text-[11px] text-red-300">
          {globalError}
        </p>
      ) : null}

      {packets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-700/80 bg-zinc-950/40 px-4 py-4 text-sm leading-relaxed text-zinc-400">
          No custom work on this quote yet. Add custom work below to plan crew tasks without changing
          saved work in the library.
        </p>
      ) : (
        <ul className="space-y-5">
          {packets.map((packet) => (
            <PacketRow
              key={packet.id}
              packet={packet}
              editable={editable}
              busy={busy}
              pinnedWorkflowVersionId={pinnedWorkflowVersionId}
              hashHighlighted={hashHighlightPacketId === packet.id}
              lineItemTitlesForPacket={lineItemTitlesByLocalPacketId?.[packet.id]}
              onUpdatePacket={(patch) => handleUpdatePacket(packet.id, patch)}
              onDeletePacket={() => handleDeletePacket(packet.id)}
              onCreateItem={(draft) => handleCreateItem(packet.id, draft)}
              onUpdateItem={(itemId, patch) => handleUpdateItem(packet.id, itemId, patch)}
              onDeleteItem={(itemId) => handleDeleteItem(packet.id, itemId)}
              onPromotePacket={(payload) => handlePromotePacket(packet.id, payload)}
              onPromotePacketIntoExisting={
                availableSavedPackets && availableSavedPackets.length > 0
                  ? (payload) => handlePromotePacketIntoExisting(packet.id, payload)
                  : null
              }
              availableSavedPackets={availableSavedPackets ?? []}
            />
          ))}
        </ul>
      )}

      {editable ? (
        <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/30 p-3 space-y-2">
          <p className="text-xs font-medium text-zinc-400">New editable custom work</p>
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
              {busy ? "Working…" : "Create custom work"}
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

type PromoteIntoExistingPayload = { targetScopePacketId: string };
type PromoteIntoExistingResult =
  | { ok: true; targetScopePacketId: string; revisionId: string }
  | { ok: false; error: string };

type PacketRowProps = {
  packet: QuoteLocalPacketDto;
  editable: boolean;
  busy: boolean;
  pinnedWorkflowVersionId: string | null;
  /**
   * When set, used as the row `id` (e.g. inline under a line item) to avoid
   * colliding with `#field-work-{packetId}` on the full-page editor.
   */
  rowDomId?: string;
  /** True briefly when navigated via `#field-work-{packet.id}`. */
  hashHighlighted?: boolean;
  /** Line item titles that pin this packet (optional; from scope page). */
  lineItemTitlesForPacket?: string[];
  onUpdatePacket: (patch: { displayName?: string; description?: string | null }) => void;
  onDeletePacket: () => void;
  onCreateItem: (draft: NewItemDraft) => Promise<boolean | undefined>;
  onUpdateItem: (
    itemId: string,
    patch: Partial<ReturnType<typeof draftToBody>>,
  ) => Promise<boolean | undefined>;
  onDeleteItem: (itemId: string) => void;
  onPromotePacket: (payload: PromotePayload) => Promise<PromoteResult>;
  /**
   * When `null`, the secondary "Add to existing saved template" affordance
   * is hidden entirely (e.g. there are no saved packets on the tenant yet,
   * or the host page chose not to thread the option list through).
   */
  onPromotePacketIntoExisting:
    | ((payload: PromoteIntoExistingPayload) => Promise<PromoteIntoExistingResult>)
    | null;
  availableSavedPackets: SavedPacketOption[];
  /** `inline`: under line-item preview — lighter chrome, no duplicate title, advanced tucked away. */
  presentation?: "default" | "inline";
  /** Inside workspace “Crew work” shell — drop extra borders and tuck source into details. */
  unifiedWorkSection?: boolean;
};

function PacketRow({
  packet,
  editable,
  busy,
  pinnedWorkflowVersionId,
  rowDomId,
  hashHighlighted = false,
  lineItemTitlesForPacket,
  onUpdatePacket,
  onDeletePacket,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onPromotePacket,
  onPromotePacketIntoExisting,
  availableSavedPackets,
  presentation = "default",
  unifiedWorkSection = false,
}: PacketRowProps) {
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState(packet.displayName);
  const [headerDescription, setHeaderDescription] = useState(packet.description ?? "");
  const [addTaskMode, setAddTaskMode] = useState<"none" | "embedded" | "library">("none");
  const [showPromote, setShowPromote] = useState(false);
  const [showPromoteExisting, setShowPromoteExisting] = useState(false);
  const pinned = packet.pinnedByLineItemCount > 0;
  const canPromote = editable && packet.promotionStatus === "NONE" && packet.itemCount > 0;
  const canPromoteIntoExisting =
    canPromote &&
    onPromotePacketIntoExisting !== null &&
    availableSavedPackets.length > 0;
  const isPromoted =
    packet.promotionStatus === "COMPLETED" && packet.promotedScopePacketId !== null;

  const isInline = presentation === "inline";
  const titles = lineItemTitlesForPacket?.filter((t) => t.trim().length > 0) ?? [];
  const usedByLabel =
    pinned && titles.length > 0
      ? isInline
        ? titles.length === 1
          ? "Used by this line"
          : `Shared by ${titles.length} lines`
        : titles.length === 1
          ? `Used by: ${titles[0]}`
          : `Used by: ${titles.join(" · ")}`
      : pinned
        ? `Used by ${packet.pinnedByLineItemCount} line item${packet.pinnedByLineItemCount === 1 ? "" : "s"}`
        : null;

  const rowId = rowDomId ?? `field-work-${packet.id}`;
  const shellClass =
    isInline && unifiedWorkSection
      ? `space-y-2 transition-shadow duration-300 ${
          hashHighlighted ? "ring-2 ring-sky-500/60 ring-offset-1 ring-offset-zinc-950" : ""
        }`
      : isInline
        ? `rounded-md border border-zinc-700/50 bg-zinc-950/45 p-2.5 sm:p-3 transition-shadow duration-300 ${
            hashHighlighted ? "ring-2 ring-sky-500/60 ring-offset-1 ring-offset-zinc-950" : ""
          }`
        : `rounded-lg border border-zinc-800/80 bg-zinc-950/30 p-4 shadow-sm shadow-black/10 transition-shadow duration-300 ${
            hashHighlighted ? "ring-2 ring-sky-500/70 ring-offset-2 ring-offset-zinc-950" : ""
          }`;

  const showInlineHeaderBadges = !(isInline && unifiedWorkSection);

  const technicalDetailsInner = (
    <div className="mt-1 flex flex-wrap gap-2 font-mono text-[10px] text-zinc-500">
      <span className="rounded bg-zinc-900 px-1.5 py-0.5">{packet.id}</span>
      <span className="rounded border border-zinc-700/60 bg-zinc-900/40 px-1.5 py-0.5">
        origin: {packet.originType}
      </span>
      <span
        className={`rounded border px-1.5 py-0.5 ${
          isPromoted
            ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-300"
            : "border-zinc-700/60 bg-zinc-900/40 text-zinc-400"
        }`}
        title="Save-to-library status for this custom work"
      >
        {formatQuoteLocalPacketPromotionStatusLabel(packet.promotionStatus)}
      </span>
      {isPromoted && packet.promotedScopePacketId ? (
        <a
          href={`/library/packets/${encodeURIComponent(packet.promotedScopePacketId)}`}
          className="rounded border border-emerald-800/60 bg-emerald-950/30 px-1.5 py-0.5 text-emerald-300 hover:text-emerald-200"
        >
          Open promoted packet ↗
        </a>
      ) : null}
    </div>
  );

  const defaultTechnicalDetails = (
    <details className="mt-3 text-xs text-zinc-600">
      <summary className="cursor-pointer text-zinc-600 hover:text-zinc-400 select-none">
        Technical details
      </summary>
      {technicalDetailsInner}
    </details>
  );

  const promoteControls = canPromote ? (
    showPromote ? (
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
    ) : showPromoteExisting && onPromotePacketIntoExisting !== null ? (
      <PromoteIntoExistingForm
        busy={busy}
        availableSavedPackets={availableSavedPackets}
        onCancel={() => setShowPromoteExisting(false)}
        onSubmit={async (payload) => {
          const result = await onPromotePacketIntoExisting(payload);
          if (result.ok) setShowPromoteExisting(false);
          return result;
        }}
      />
    ) : (
      <>
        <button
          type="button"
          onClick={() => setShowPromote(true)}
          className="rounded border border-violet-800/60 bg-violet-950/20 px-2 py-0.5 text-[11px] text-violet-300 hover:text-violet-200"
          title="Save this task packet as a brand-new reusable saved task packet in the library (creates a new packet with its first DRAFT revision)."
        >
          ↑ Save as new template (DRAFT revision)
        </button>
        {canPromoteIntoExisting ? (
          <button
            type="button"
            onClick={() => setShowPromoteExisting(true)}
            className="rounded border border-violet-800/60 bg-violet-950/20 px-2 py-0.5 text-[11px] text-violet-300 hover:text-violet-200"
            title="Add this task packet to an existing saved task packet as the next editable draft revision."
          >
            ↗ Add to existing saved template
          </button>
        ) : null}
      </>
    )
  ) : null;

  return (
    <li id={rowId} className={shellClass}>
      <header
        className={`flex flex-wrap items-start justify-between gap-2 ${
          isInline ? "border-b border-zinc-800/40 pb-2 mb-2" : "border-b border-zinc-800 pb-2 mb-3"
        }`}
      >
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
          ) : isInline ? (
            <>
              <p className="sr-only">{packet.displayName}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-500">
                {showInlineHeaderBadges && usedByLabel ? (
                  <span className="rounded border border-zinc-700/50 bg-zinc-900/40 px-1.5 py-0.5 text-zinc-500">
                    {usedByLabel}
                  </span>
                ) : null}
                {packet.description ? (
                  <span className="text-zinc-600 leading-snug max-w-full">{packet.description}</span>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-zinc-50 leading-snug">{packet.displayName}</p>
              {packet.description ? (
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{packet.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-400">
                  {packet.itemCount} {packet.itemCount === 1 ? "task" : "tasks"}
                </span>
                {usedByLabel ? (
                  <span className="rounded-md border border-zinc-700/80 bg-zinc-900/60 px-2 py-0.5 text-zinc-400">
                    {usedByLabel}
                  </span>
                ) : null}
              </div>
              {defaultTechnicalDetails}
            </>
          )}
        </div>
        {editable && !editingHeader ? (
          <div className={`flex gap-1 shrink-0 ${isInline ? "items-start pt-0.5" : ""}`}>
            <button
              type="button"
              onClick={() => setEditingHeader(true)}
              className={
                isInline
                  ? "rounded border border-zinc-700/70 px-1.5 py-0.5 text-[9px] text-zinc-500 hover:text-zinc-300"
                  : "rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200"
              }
            >
              {isInline ? "Rename" : "Edit"}
            </button>
            <button
              type="button"
              disabled={busy || pinned}
              onClick={onDeletePacket}
              title={
                pinned
                  ? "Detach pinning line items first."
                  : "Delete this custom work and all its tasks."
              }
              className={
                isInline
                  ? "rounded border border-red-900/50 px-1.5 py-0.5 text-[9px] text-red-400/90 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                  : "rounded border border-red-900/60 px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
              }
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
        presentation={presentation}
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
        onAddFirstTask={() => setAddTaskMode("embedded")}
        onAddFirstFromLibrary={() => setAddTaskMode("library")}
        suppressEmptyAddButtons={addTaskMode !== "none"}
      />

      {!isInline && promoteControls ? (
        <div className="mt-3 flex flex-wrap gap-2">{promoteControls}</div>
      ) : null}

      {editable ? (
        <div className="mt-3 space-y-2">
          {addTaskMode === "embedded" ? (
            <EmbeddedTaskAuthoringForm
              key={`emb-${packet.id}`}
              variant="create"
              busy={busy}
              pinnedWorkflowVersionId={pinnedWorkflowVersionId}
              defaultSortOrder={
                packet.items.length > 0
                  ? Math.max(...packet.items.map((i) => i.sortOrder)) + 1
                  : 0
              }
              existingLineKeys={packet.items.map((i) => i.lineKey)}
              onCancel={() => setAddTaskMode("none")}
              submitLabel="Add task"
              onSubmit={async (draft) => {
                const ok = await onCreateItem(draft);
                if (ok) setAddTaskMode("none");
              }}
            />
          ) : null}
          {addTaskMode === "library" ? (
            <LibraryTaskCreateForm
              key={`lib-${packet.id}`}
              busy={busy}
              pinnedWorkflowVersionId={pinnedWorkflowVersionId}
              defaultSortOrder={
                packet.items.length > 0
                  ? Math.max(...packet.items.map((i) => i.sortOrder)) + 1
                  : 0
              }
              existingLineKeys={packet.items.map((i) => i.lineKey)}
              onCancel={() => setAddTaskMode("none")}
              onSubmit={async (draft) => {
                const ok = await onCreateItem(draft);
                if (ok) setAddTaskMode("none");
              }}
            />
          ) : null}
          {addTaskMode === "none" && packet.items.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAddTaskMode("embedded")}
                className={
                  isInline
                    ? "rounded-md border border-emerald-700/70 bg-emerald-950/35 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-950/50"
                    : "rounded border border-emerald-800/60 bg-emerald-950/30 px-2 py-0.5 text-[11px] text-emerald-300 hover:text-emerald-200"
                }
              >
                Add task
              </button>
              <button
                type="button"
                onClick={() => setAddTaskMode("library")}
                className={
                  isInline
                    ? "rounded-md border border-zinc-600/80 bg-zinc-900/60 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                    : "rounded border border-zinc-700 bg-zinc-900/50 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
                }
              >
                Add from task library
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {isInline ? (
        <details className="mt-2 rounded border border-zinc-800/35 bg-zinc-900/25 px-2 py-1.5">
          <summary className="cursor-pointer list-none text-[10px] font-medium text-zinc-500 hover:text-zinc-400 select-none [&::-webkit-details-marker]:hidden">
            Technical details
          </summary>
          <div className="mt-2 space-y-3 border-t border-zinc-800/40 pt-2">
            {unifiedWorkSection && titles.length > 0 ? (
              <p className="text-[10px] text-zinc-500 leading-relaxed font-sans">
                Lines using this work: {titles.join(" · ")}
              </p>
            ) : null}
            {technicalDetailsInner}
            {promoteControls ? (
              <div className="flex flex-wrap gap-2 border-t border-zinc-800/30 pt-2">{promoteControls}</div>
            ) : null}
          </div>
        </details>
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
  presentation?: "default" | "inline";
  onUpdateItem: (
    itemId: string,
    patch: Partial<ReturnType<typeof draftToBody>>,
  ) => Promise<boolean | undefined>;
  onDeleteItem: (itemId: string) => void;
  onAddFirstTask: () => void;
  onAddFirstFromLibrary: () => void;
  suppressEmptyAddButtons?: boolean;
};

function ItemsTable({
  items,
  editable,
  busy,
  pinnedWorkflowVersionId,
  presentation = "default",
  onUpdateItem,
  onDeleteItem,
  onAddFirstTask,
  onAddFirstFromLibrary,
  suppressEmptyAddButtons,
}: ItemsTableProps) {
  const isInline = presentation === "inline";
  if (items.length === 0) {
    return (
      <div
        className={
          isInline
            ? "rounded-md border border-amber-900/30 bg-amber-950/15 px-3 py-2.5 space-y-1.5"
            : "rounded-lg border border-amber-900/35 bg-amber-950/20 px-4 py-4 space-y-2"
        }
      >
        <p className={isInline ? "text-xs font-medium text-amber-100/95" : "text-sm font-semibold text-amber-100"}>
          No tasks yet.
        </p>
        <p
          className={
            isInline
              ? "text-[11px] text-amber-200/85 leading-relaxed"
              : "text-sm text-amber-200/90 leading-relaxed"
          }
        >
          Add the first crew task for this custom work.
        </p>
        {editable && !suppressEmptyAddButtons ? (
          <div className={`flex flex-wrap gap-2 ${isInline ? "pt-1" : "pt-2"}`}>
            <button
              type="button"
              onClick={onAddFirstTask}
              className={
                isInline
                  ? "rounded-md bg-emerald-700/95 px-2.5 py-1 text-[11px] font-semibold text-emerald-50 hover:bg-emerald-600"
                  : "rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-600 shadow-sm"
              }
            >
              Add first task
            </button>
            <button
              type="button"
              onClick={onAddFirstFromLibrary}
              className={
                isInline
                  ? "rounded-md border border-zinc-600/70 bg-zinc-900/50 px-2 py-1 text-[10px] font-medium text-zinc-300 hover:text-zinc-100"
                  : "rounded border border-zinc-700 bg-zinc-900/50 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
              }
            >
              Add from task library
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={
        isInline
          ? "overflow-x-auto rounded-md border border-zinc-800/55"
          : "overflow-x-auto rounded-lg border border-zinc-800/80"
      }
    >
      <table className={`w-full text-left ${isInline ? "text-xs text-zinc-300" : "text-sm text-zinc-300"}`}>
        <thead
          className={
            isInline
              ? "bg-zinc-900/50 text-[10px] font-medium text-zinc-500 normal-case"
              : "bg-zinc-900/70 text-xs font-semibold text-zinc-500 normal-case"
          }
        >
          <tr>
            <th className={isInline ? "px-2 py-1.5" : "px-3 py-2.5"}>Task</th>
            <th className={isInline ? "px-2 py-1.5" : "px-3 py-2.5"}>Stage</th>
            <th className={isInline ? "px-2 py-1.5" : "px-3 py-2.5"}>Notes</th>
            {editable ? (
              <th className={`text-right ${isInline ? "px-2 py-1.5" : "px-3 py-2.5"}`}>Actions</th>
            ) : null}
          </tr>
        </thead>
        <tbody className={isInline ? "divide-y divide-zinc-800/70" : "divide-y divide-zinc-800"}>
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              allItems={items}
              editable={editable}
              busy={busy}
              pinnedWorkflowVersionId={pinnedWorkflowVersionId}
              compact={isInline}
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
  allItems,
  editable,
  busy,
  pinnedWorkflowVersionId,
  compact = false,
  onUpdateItem,
  onDeleteItem,
}: {
  item: QuoteLocalPacketItemDto;
  allItems: QuoteLocalPacketItemDto[];
  editable: boolean;
  busy: boolean;
  pinnedWorkflowVersionId: string | null;
  compact?: boolean;
  onUpdateItem: (
    itemId: string,
    patch: Partial<ReturnType<typeof draftToBody>>,
  ) => Promise<boolean | undefined>;
  onDeleteItem: (itemId: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr>
        <td colSpan={editable ? 4 : 3} className="px-2 py-2 align-top">
          {item.lineKind === "LIBRARY" ? (
            <LibraryItemEditor
              item={item}
              busy={busy}
              collisionKeys={lineKeysForPacketCollision(allItems, item.id)}
              pinnedWorkflowVersionId={pinnedWorkflowVersionId}
              onCancel={() => setEditing(false)}
              onSave={async (draft) => {
                const ok = await onUpdateItem(item.id, draftToBody(draft));
                if (ok) setEditing(false);
              }}
            />
          ) : (
            <EmbeddedTaskAuthoringForm
              variant="edit"
              initialDraft={itemToDraft(item)}
              defaultSortOrder={item.sortOrder}
              existingLineKeys={lineKeysForPacketCollision(allItems, item.id)}
              busy={busy}
              pinnedWorkflowVersionId={pinnedWorkflowVersionId}
              onCancel={() => setEditing(false)}
              submitLabel="Save task"
              onSubmit={async (draft) => {
                const ok = await onUpdateItem(item.id, draftToBody(draft));
                if (ok) setEditing(false);
              }}
            />
          )}
        </td>
      </tr>
    );
  }

  const embeddedTitle = readEmbeddedTitle(item.embeddedPayloadJson);
  const embeddedInstructions = readEmbeddedInstructions(item.embeddedPayloadJson);
  const reqCount = readCompletionRequirementCount(item.embeddedPayloadJson);

  const taskLabel =
    item.lineKind === "LIBRARY"
      ? item.taskDefinition?.displayName ?? "Saved task definition"
      : embeddedTitle && embeddedTitle.trim() !== ""
        ? embeddedTitle
        : "Untitled task";

  const notesPreview =
    item.lineKind === "LIBRARY"
      ? "Linked from your task library"
      : embeddedInstructions && embeddedInstructions.trim() !== ""
        ? embeddedInstructions.length > 120
          ? `${embeddedInstructions.slice(0, 120)}…`
          : embeddedInstructions
        : "—";

  const cellPad = compact ? "px-2 py-1.5" : "px-3 py-2.5";
  const titleCls = compact
    ? "text-xs font-semibold text-zinc-100 leading-snug"
    : "text-sm font-semibold text-zinc-50 leading-snug";

  return (
    <tr className={compact ? "hover:bg-zinc-800/20" : "hover:bg-zinc-800/30"}>
      <td className={`${cellPad} align-top`}>
        {item.lineKind === "LIBRARY" ? (
          <div>
            <p
              className={
                compact
                  ? "text-[9px] font-medium uppercase tracking-wide text-sky-400/85"
                  : "text-[10px] font-medium uppercase tracking-wide text-sky-400/90"
              }
            >
              Saved task definition
            </p>
            <p className={titleCls}>{taskLabel}</p>
            {item.taskDefinition?.status && item.taskDefinition.status !== "PUBLISHED" ? (
              <p className="text-[10px] text-amber-400 mt-0.5">Status: {item.taskDefinition.status}</p>
            ) : null}
          </div>
        ) : (
          <div>
            <p className={titleCls}>{taskLabel}</p>
            {reqCount > 0 ? (
              <span className="mt-1 inline-block rounded border border-amber-900/50 bg-amber-950/30 px-1.5 py-0.5 text-[9px] font-medium text-amber-200">
                Proof / checklist ({reqCount})
              </span>
            ) : null}
          </div>
        )}
      </td>
      <td className={`${cellPad} ${compact ? "text-xs" : "text-sm"} text-zinc-300 align-top`}>
        {humanizeCanonicalExecutionStageKey(item.targetNodeKey)}
      </td>
      <td
        className={`${cellPad} ${compact ? "text-[10px] max-w-[200px]" : "text-xs max-w-[260px]"} text-zinc-500 align-top whitespace-pre-wrap break-words leading-relaxed`}
      >
        {notesPreview}
      </td>
      {editable ? (
        <td className={`${cellPad} text-right align-top`}>
          <div className="inline-flex gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={
                compact
                  ? "rounded border border-zinc-700/80 px-1.5 py-0.5 text-[9px] text-zinc-400 hover:text-zinc-200"
                  : "rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200"
              }
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDeleteItem(item.id)}
              className={
                compact
                  ? "rounded border border-red-900/55 px-1.5 py-0.5 text-[9px] text-red-400/95 hover:text-red-300 disabled:opacity-40"
                  : "rounded border border-red-900/60 px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300 disabled:opacity-40"
              }
            >
              Delete
            </button>
          </div>
        </td>
      ) : null}
    </tr>
  );
}

/* ───────────────────────── Promote form ───────────────────────── */

const PROMOTE_HELP_TEXT =
  "This creates a new saved task packet in your library with a first draft revision and copies every item as a template task line. The action is irreversible — once saved, the source task packet on this quote is locked and the new packet exists permanently. Office admins can publish, edit, or supersede it later from the library.";

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
        Save as new template (draft revision)
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
          I understand this is irreversible: a new saved template will be created in the library
          and this task packet on the quote will be locked.
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

/* ─────────────── Promote into existing saved template ─────────────── */

const PROMOTE_INTO_EXISTING_HELP_TEXT =
  "This creates a new editable DRAFT revision on the saved task packet you pick, containing the items from this quote task packet. The published revision is NOT changed — you'll review and publish the new draft from the office library. The source task packet on this quote is locked once promoted.";

function PromoteIntoExistingForm({
  busy,
  availableSavedPackets,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  availableSavedPackets: SavedPacketOption[];
  onCancel: () => void;
  onSubmit: (
    payload: { targetScopePacketId: string },
  ) => Promise<
    | { ok: true; targetScopePacketId: string; revisionId: string }
    | { ok: false; error: string }
  >;
}) {
  const [targetId, setTargetId] = useState<string>("");
  const [confirmed, setConfirmed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<
    { targetScopePacketId: string; revisionId: string } | null
  >(null);

  const sortedOptions = useMemo(
    () =>
      [...availableSavedPackets].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    [availableSavedPackets],
  );

  const selected = sortedOptions.find((p) => p.id === targetId) ?? null;
  const targetHasDraft = selected?.hasDraftRevision === true;
  const canSubmit = selected !== null && !targetHasDraft && confirmed && !busy;

  if (success) {
    const revisionHref = `/library/packets/${encodeURIComponent(
      success.targetScopePacketId,
    )}/revisions/${encodeURIComponent(success.revisionId)}`;
    return (
      <div className="rounded border border-emerald-900/50 bg-emerald-950/20 p-3 text-[11px] text-emerald-200/90 space-y-2">
        <p>
          New draft revision created on the selected saved template. The
          published revision was not changed.
        </p>
        <a
          href={revisionHref}
          className="inline-block rounded border border-emerald-700/60 bg-emerald-900/40 px-2 py-0.5 text-emerald-100 hover:text-white"
        >
          Open new draft revision ↗
        </a>
        <button
          type="button"
          onClick={onCancel}
          className="ml-2 rounded border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:text-zinc-100"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="rounded border border-violet-900/40 bg-violet-950/10 p-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">
        Add to existing saved template (DRAFT revision)
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-400">
        {PROMOTE_INTO_EXISTING_HELP_TEXT}
      </p>
      <label className="block text-[11px] space-y-1">
        <span className="block text-zinc-500">Target saved template</span>
        <select
          value={targetId}
          onChange={(e) => {
            setTargetId(e.target.value);
            setLocalError(null);
          }}
          disabled={busy}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
        >
          <option value="">— pick a saved template —</option>
          {sortedOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName} ({p.packetKey}){p.hasDraftRevision ? "  • already has a draft" : ""}
            </option>
          ))}
        </select>
      </label>
      {targetHasDraft ? (
        <p className="rounded border border-amber-900/50 bg-amber-950/20 px-2 py-1 text-[11px] text-amber-300">
          This saved template already has an editable draft. Open that draft
          and merge changes there instead — only one editable draft is allowed
          per saved template.
        </p>
      ) : null}
      <label className="flex items-start gap-2 text-[11px] text-zinc-400">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={busy || selected === null || targetHasDraft}
          className="mt-0.5"
        />
        <span>
          I understand a new editable draft revision will be created on the
          selected saved task packet, and this quote task packet will be locked.
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
            if (selected === null) return;
            const result = await onSubmit({ targetScopePacketId: selected.id });
            if (result.ok) {
              setSuccess({
                targetScopePacketId: result.targetScopePacketId,
                revisionId: result.revisionId,
              });
            } else {
              setLocalError(result.error);
            }
          }}
          className="rounded bg-violet-700/90 px-3 py-1 text-[11px] font-semibold text-violet-50 hover:bg-violet-600 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add as new draft revision"}
        </button>
      </div>
    </div>
  );
}

export type QuoteLocalSinglePacketEditorProps = {
  initialPacket: QuoteLocalPacketDto;
  pinnedWorkflowVersionId: string | null;
  availableSavedPackets: SavedPacketOption[];
  lineItemTitlesForPacket?: string[];
  isDraft: boolean;
  canOfficeMutate: boolean;
  /** Unique per host row; must not collide with full-page `#field-work-*`. */
  rowDomId: string;
  onClose?: () => void;
  /** Nested under quote workspace “Crew work” — lighter chrome. */
  unifiedWorkSection?: boolean;
};

/**
 * One quote-local packet row for inline editing (e.g. under a line item).
 * Uses the same API routes as {@link QuoteLocalPacketEditor}; no global section ids.
 */
export function QuoteLocalSinglePacketEditor({
  initialPacket,
  pinnedWorkflowVersionId,
  availableSavedPackets,
  lineItemTitlesForPacket,
  isDraft,
  canOfficeMutate,
  rowDomId,
  onClose,
  unifiedWorkSection = false,
}: QuoteLocalSinglePacketEditorProps) {
  const router = useRouter();
  const [packet, setPacket] = useState<QuoteLocalPacketDto>(initialPacket);
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    setPacket(initialPacket);
  }, [initialPacket]);

  const editable = isDraft && canOfficeMutate;

  function refresh() {
    router.refresh();
  }

  async function handleUpdatePacket(patch: { displayName?: string; description?: string | null }) {
    if (!editable) return;
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch(`/api/quote-local-packets/${encodeURIComponent(packet.id)}`, {
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
      setPacket(body.data);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePacket() {
    if (!editable) return;
    if (!window.confirm("Delete this custom work? All tasks inside it will be removed too.")) return;
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch(`/api/quote-local-packets/${encodeURIComponent(packet.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        setGlobalError(await readApiError(res));
        return;
      }
      refresh();
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateItem(draft: NewItemDraft) {
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
  ) {
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
        itemCount: prev.itemCount - 1,
      }));
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handlePromotePacket(payload: {
    packetKey: string;
    displayName?: string;
  }): Promise<
    | { ok: true; promotedScopePacketId: string }
    | { ok: false; error: string }
  > {
    if (!editable) return { ok: false, error: "Not editable" };
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch(`/api/quote-local-packets/${encodeURIComponent(packet.id)}/promote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          packetKey: payload.packetKey.trim(),
          ...(payload.displayName !== undefined ? { displayName: payload.displayName } : {}),
        }),
      });
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
        setPacket(refreshed);
      }
      refresh();
      return { ok: true, promotedScopePacketId: body.data.promotion.promotedScopePacketId };
    } finally {
      setBusy(false);
    }
  }

  async function handlePromotePacketIntoExisting(payload: { targetScopePacketId: string }): Promise<
    | { ok: true; targetScopePacketId: string; revisionId: string }
    | { ok: false; error: string }
  > {
    if (!editable) return { ok: false, error: "Not editable" };
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch(`/api/quote-local-packets/${encodeURIComponent(packet.id)}/promote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetScopePacketId: payload.targetScopePacketId }),
      });
      if (!res.ok) {
        const msg = await readApiError(res);
        setGlobalError(msg);
        return { ok: false, error: msg };
      }
      const body = (await res.json()) as {
        data: {
          promotion: {
            promotedScopePacketId: string;
            scopePacketRevision: { id: string };
          };
          quoteLocalPacket: QuoteLocalPacketDto | null;
        };
      };
      const refreshed = body.data.quoteLocalPacket;
      if (refreshed) {
        setPacket(refreshed);
      }
      refresh();
      return {
        ok: true,
        targetScopePacketId: body.data.promotion.promotedScopePacketId,
        revisionId: body.data.promotion.scopePacketRevision.id,
      };
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1.5 ml-1.5 border-l-2 border-zinc-600/40 pl-2.5 sm:ml-2 sm:pl-3 space-y-1.5">
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
      <ul className="list-none p-0 m-0 space-y-0">
        <PacketRow
          rowDomId={rowDomId}
          packet={packet}
          editable={editable}
          busy={busy}
          pinnedWorkflowVersionId={pinnedWorkflowVersionId}
          presentation="inline"
          unifiedWorkSection={unifiedWorkSection}
          hashHighlighted={false}
          lineItemTitlesForPacket={lineItemTitlesForPacket}
          onUpdatePacket={handleUpdatePacket}
          onDeletePacket={handleDeletePacket}
          onCreateItem={(draft) => handleCreateItem(draft)}
          onUpdateItem={(itemId, patch) => handleUpdateItem(itemId, patch)}
          onDeleteItem={(itemId) => void handleDeleteItem(itemId)}
          onPromotePacket={(payload) => handlePromotePacket(payload)}
          onPromotePacketIntoExisting={
            availableSavedPackets.length > 0
              ? (payload) => handlePromotePacketIntoExisting(payload)
              : null
          }
          availableSavedPackets={availableSavedPackets}
        />
      </ul>
    </div>
  );
}
