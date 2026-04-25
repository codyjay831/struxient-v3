"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { QuoteVersionScopeApiDto } from "@/lib/quote-version-scope-dto";
import type { ScopeProposalGroupWithItems } from "@/lib/quote-scope/quote-scope-grouping";
import type { ScopePacketSummaryDto } from "@/server/slice1/reads/scope-packet-catalog-reads";
import type { QuoteLocalPacketDto } from "@/server/slice1/reads/quote-local-packet-reads";
import type { LineItemPresetSummaryDto } from "@/server/slice1/reads/line-item-preset-reads";
import {
  buildExecutionPreviewSummary,
  type LineItemExecutionPreviewDto,
} from "@/lib/quote-line-item-execution-preview";
import { QuickAddLineItemPicker } from "@/components/quote-scope/quick-add-line-item-picker";
import type { LineItemForRecent } from "@/lib/quick-add-line-item-picker-filter";
import {
  buildFieldsFromPacket,
  buildFieldsFromPreset,
} from "@/lib/quote-line-item-prefill";
import { formatExecutionModeLabel } from "@/lib/quote-line-item-execution-mode-label";

type ProposalGroup = QuoteVersionScopeApiDto["proposalGroups"][number];
type LineItem = QuoteVersionScopeApiDto["orderedLineItems"][number];
type GroupWithItems = ScopeProposalGroupWithItems<ProposalGroup, LineItem>;

type EditableReason = "ok" | "missing_capability" | "not_editable_head";

/**
 * Library packet summary as the form consumes it. We only show packets that
 * have at least one PUBLISHED revision (the only revisions a quote line item
 * can pin) — filtering happens client-side from the full summary list.
 */
type LibraryPacketOption = ScopePacketSummaryDto;
/**
 * Local packet summary as the form consumes it (subset of `QuoteLocalPacketDto`,
 * but kept as the full DTO so future fields are available without a re-plumb).
 */
type LocalPacketOption = QuoteLocalPacketDto;

type Props = {
  quoteId: string;
  quoteVersionId: string;
  versionNumber: number;
  proposalGroups: ProposalGroup[];
  groupedLineItems: GroupWithItems[];
  /**
   * All catalog packets visible to this tenant. The form filters internally
   * to those with `latestPublishedRevisionId !== null` — DRAFT-only packets
   * are not pinnable from a quote line item (Triangle Mode pin-XOR rule).
   */
  availableLibraryPackets: LibraryPacketOption[];
  /** All quote-local packets attached to this quote version. */
  availableLocalPackets: LocalPacketOption[];
  /**
   * Tenant-scoped saved-line-item presets (Triangle Mode — Phase 2 / Slice 2).
   * Defaults to `[]` when omitted (the page only loads them on the editable
   * head DRAFT branch). Threaded into `<QuickAddLineItemPicker/>` so the
   * "Saved line items" section can render alongside library packets.
   */
  availablePresets?: LineItemPresetSummaryDto[];
  /**
   * Per-line execution preview keyed by `QuoteLineItem.id` (Triangle Mode,
   * Phase 1, Slice C). When `null`, the preview is suppressed (e.g. on the
   * non-editable branch where the loader was skipped). When present, every
   * line in `groupedLineItems` should have a corresponding entry; missing
   * entries collapse to no-preview rendering rather than throw.
   */
  executionPreviewByLineItemId: Record<string, LineItemExecutionPreviewDto> | null;
  canMutate: boolean;
  editableReason: EditableReason;
};

type ExecutionMode = "SOLD_SCOPE" | "MANIFEST";

type PacketSource = "none" | "library" | "local";

type FormFields = {
  title: string;
  /**
   * Free-form commercial description (Phase 2, Slice 2). Surfaced on the
   * proposal alongside `title`. Server caps at 4000 chars; the form caps at
   * the same value to mirror server validation client-side.
   */
  description: string;
  quantity: string;
  executionMode: ExecutionMode;
  unitPriceCents: string;
  proposalGroupId: string;
  paymentBeforeWork: boolean;
  paymentGateTitleOverride: string;
  /**
   * Tracks which packet pin the user has chosen for a MANIFEST line.
   * - `"none"`: no pin selected (always the case for SOLD_SCOPE; transitional
   *   state for MANIFEST until the user picks).
   * - `"library"`: `scopePacketRevisionId` is the canonical pin.
   * - `"local"`: `quoteLocalPacketId` is the canonical pin.
   *
   * The server enforces the `MANIFEST_SCOPE_PIN_XOR` invariant; this UI field
   * only drives form rendering.
   */
  packetSource: PacketSource;
  scopePacketRevisionId: string;
  quoteLocalPacketId: string;
};

type Banner =
  | { kind: "success"; title: string; message?: string }
  | { kind: "error"; title: string; message?: string }
  | null;

const blankFields = (group: ProposalGroup | undefined): FormFields => ({
  title: "",
  description: "",
  quantity: "1",
  executionMode: "SOLD_SCOPE",
  unitPriceCents: "",
  proposalGroupId: group?.id ?? "",
  paymentBeforeWork: false,
  paymentGateTitleOverride: "",
  packetSource: "none",
  scopePacketRevisionId: "",
  quoteLocalPacketId: "",
});

function deriveInitialFromItem(item: LineItem): FormFields {
  const executionMode: ExecutionMode = item.executionMode === "MANIFEST" ? "MANIFEST" : "SOLD_SCOPE";
  let packetSource: PacketSource = "none";
  if (executionMode === "MANIFEST") {
    if (item.scopePacketRevisionId != null) packetSource = "library";
    else if (item.quoteLocalPacketId != null) packetSource = "local";
  }
  return {
    title: item.title,
    description: item.description ?? "",
    quantity: String(item.quantity),
    executionMode,
    unitPriceCents: "",
    proposalGroupId: item.proposalGroupId,
    paymentBeforeWork: item.paymentBeforeWork,
    paymentGateTitleOverride: item.paymentGateTitleOverride ?? "",
    packetSource,
    scopePacketRevisionId: item.scopePacketRevisionId ?? "",
    quoteLocalPacketId: item.quoteLocalPacketId ?? "",
  };
}

/**
 * Office-side line-item authoring UI.
 *
 *   - Renders one section per proposal group via the shared grouping helper.
 *   - Add: opens an inline form pre-targeted at the section's group with
 *     `sortOrder = max(existing in group) + 1` (1 if empty).
 *   - Edit: inline form per row.
 *   - Delete: confirm + DELETE; row vanishes after `router.refresh()`.
 *
 * MANIFEST line items must pin a packet (library revision XOR quote-local
 * packet) — the picker enforces this client-side and the server re-asserts
 * `MANIFEST_SCOPE_PIN_XOR`. SOLD_SCOPE lines are commercial-only and never
 * carry a packet pin.
 *
 * All mutations call the existing canonical line-item API routes
 * (`POST /api/quote-versions/:quoteVersionId/line-items` and
 * `PATCH/DELETE .../line-items/:lineItemId`). After a successful mutation,
 * the page is refreshed via `router.refresh()` so we re-read canonical
 * server state instead of carrying a divergent local model.
 */
export function ScopeEditor({
  quoteId,
  quoteVersionId,
  versionNumber,
  proposalGroups,
  groupedLineItems,
  availableLibraryPackets,
  availableLocalPackets,
  availablePresets = [],
  executionPreviewByLineItemId,
  canMutate,
  editableReason,
}: Props) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [addingForGroupId, setAddingForGroupId] = useState<string | null>(null);
  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);
  // Triangle Mode Step 1 — quick-add library picker state.
  // Mutually exclusive with `addingForGroupId` for the same group: opening the
  // picker closes any open add form (and vice versa) so authoring stays
  // unambiguous.
  const [libraryPickerForGroupId, setLibraryPickerForGroupId] = useState<string | null>(null);
  // Per-group "staged" prefill carried from the picker into the next render
  // of `LineItemForm`. Cleared on cancel and on successful create — the
  // existing handleCreate is the single submit path; the picker never
  // bypasses it.
  const [pendingPrefillByGroupId, setPendingPrefillByGroupId] = useState<
    Record<string, FormFields>
  >({});

  const noGroups = proposalGroups.length === 0;

  const pinnableLibraryPackets = useMemo(
    () => availableLibraryPackets.filter((p) => p.latestPublishedRevisionId != null),
    [availableLibraryPackets],
  );

  // Flatten existing line items into a minimal shape the picker can use to
  // surface "Recent in this quote". Iteration order matches the visible
  // grouping (group order → sortOrder) so the strip is deterministic.
  const recentLineItemsForPicker: LineItemForRecent[] = useMemo(() => {
    const out: LineItemForRecent[] = [];
    for (const g of groupedLineItems) {
      for (const it of g.items) {
        out.push({
          scopePacketRevisionId: it.scopePacketRevisionId ?? null,
          scopeRevision: it.scopeRevision
            ? { scopePacketId: it.scopeRevision.scopePacketId }
            : null,
        });
      }
    }
    return out;
  }, [groupedLineItems]);

  function clearPendingPrefill(groupId: string) {
    setPendingPrefillByGroupId((prev) => {
      if (!(groupId in prev)) return prev;
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  }

  /**
   * Stage a prefill from a selected library packet, then open the existing
   * line-item form for the target group.
   *
   * Field rules (Triangle Mode Step 1 — UX-only):
   *   - `executionMode` always set to `"MANIFEST"` (library packets always
   *     produce runtime tasks; SOLD_SCOPE is not in the picker).
   *   - `packetSource` set to `"library"` and `scopePacketRevisionId` set to
   *     the packet's `latestPublishedRevisionId` (server invariant requires
   *     a PUBLISHED revision; the picker filters non-pinnable packets out
   *     before we ever reach here).
   *   - `quoteLocalPacketId` cleared (XOR rule, mirrored client-side).
   *   - `quantity` defaults to "1" only if the previously-staged value is
   *     blank (preserves any explicit value the user staged earlier).
   *   - `title` set to the packet display name **only when the existing
   *     staged title is empty** — never overwrites a user-entered title.
   *   - `unitPriceCents` is intentionally never touched here. Estimators
   *     still set price after adding (no schema-backed price recall yet).
   *
   * The submit path is unchanged: the existing form's "Create line item"
   * button still calls `handleCreate`, which still runs validation, still
   * issues the same POST, and still goes through every existing server
   * mutation invariant (XOR, PUBLISHED-only, tenant alignment).
   */
  function prefillFromPacket(
    packet: LibraryPacketOption,
    group: ProposalGroup,
  ) {
    const base: FormFields = pendingPrefillByGroupId[group.id] ?? blankFields(group);
    const result = buildFieldsFromPacket(packet, base);
    if (!result.ok) return;
    const next: FormFields = {
      ...base,
      ...result.fields,
      proposalGroupId: group.id,
    };
    setPendingPrefillByGroupId((prev) => ({ ...prev, [group.id]: next }));
    setLibraryPickerForGroupId(null);
    setEditingLineItemId(null);
    setAddingForGroupId(group.id);
  }

  /**
   * Stage a prefill from a selected `LineItemPreset`, then open the existing
   * line-item form for the target group (Triangle Mode — Phase 2 / Slice 2).
   *
   * Mirrors `prefillFromPacket` in submit-path discipline:
   *   - Never bypasses the form. The user still clicks "Create line item".
   *   - Never bypasses server validation. `MANIFEST_SCOPE_PIN_XOR` and
   *     PUBLISHED-revision discipline are still authoritative.
   *
   * Differences from the packet path:
   *   - **Commercial defaults are copied verbatim** (price, quantity,
   *     description, payment flags) — the preset's whole job is to remember
   *     these. The user can still edit before submit.
   *   - `executionMode` may be SOLD_SCOPE (from a SOLD_SCOPE preset), in
   *     which case both packet ids are cleared.
   *   - For MANIFEST presets the picker has already gated on usability
   *     (`buildFieldsFromPreset` returns `{ ok: false, … }` for missing
   *     packet / no PUBLISHED revision); this handler short-circuits on
   *     unusable presets defensively even though the picker disables them.
   */
  function prefillFromPreset(
    preset: LineItemPresetSummaryDto,
    group: ProposalGroup,
  ) {
    const base: FormFields = pendingPrefillByGroupId[group.id] ?? blankFields(group);
    const result = buildFieldsFromPreset(preset, base);
    if (!result.ok) return;
    const next: FormFields = {
      ...base,
      ...result.fields,
      proposalGroupId: group.id,
    };
    setPendingPrefillByGroupId((prev) => ({ ...prev, [group.id]: next }));
    setLibraryPickerForGroupId(null);
    setEditingLineItemId(null);
    setAddingForGroupId(group.id);
  }

  if (!canMutate) {
    return (
      <ReadOnlyView
        groupedLineItems={groupedLineItems}
        versionNumber={versionNumber}
        editableReason={editableReason}
        quoteId={quoteId}
        availableLibraryPackets={availableLibraryPackets}
        executionPreviewByLineItemId={executionPreviewByLineItemId}
      />
    );
  }

  if (noGroups) {
    return (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-sm text-zinc-300">
        <h2 className="text-base font-semibold text-zinc-100">No proposal groups yet</h2>
        <p className="mt-2 text-zinc-400">
          Line items must belong to a proposal group, and this version has none. Proposal-group
          management isn’t part of this slice — open the workspace to seed groups (or use the
          group API) before authoring line items here.
        </p>
        <div className="mt-3">
          <Link
            href={`/quotes/${quoteId}`}
            className="inline-block rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            Open workspace →
          </Link>
        </div>
      </section>
    );
  }

  async function handleCreate(fields: FormFields, group: GroupWithItems) {
    setBusyKey(`create:${group.id}`);
    setBanner(null);
    try {
      const validation = validateFields(fields);
      if (!validation.ok) {
        setBanner({ kind: "error", title: "Cannot create line item", message: validation.message });
        return;
      }

      // sortOrder strategy: max(existing) + 1, or 1 if empty. Server has the
      // final say on uniqueness via the existing mutation contract; this is
      // just a client-side pick that keeps new items at the bottom of the
      // visible group ordering.
      const nextSort =
        group.items.reduce((acc, it) => (it.sortOrder > acc ? it.sortOrder : acc), 0) + 1;

      const body = {
        proposalGroupId: group.id,
        sortOrder: nextSort,
        title: validation.title,
        description: validation.description,
        quantity: validation.quantity,
        executionMode: fields.executionMode,
        unitPriceCents: validation.unitPriceCents,
        paymentBeforeWork: validation.paymentBeforeWork,
        paymentGateTitleOverride: validation.paymentBeforeWork ? validation.paymentGateTitleOverride : null,
        scopePacketRevisionId: validation.scopePacketRevisionId,
        quoteLocalPacketId: validation.quoteLocalPacketId,
      };

      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/line-items`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setBanner({
          kind: "error",
          title: "Create failed",
          message: json.error?.message ?? `${res.status} ${json.error?.code ?? "ERROR"}`,
        });
        return;
      }
      setAddingForGroupId(null);
      clearPendingPrefill(group.id);
      setBanner({ kind: "success", title: "Line item added", message: validation.title });
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUpdate(item: LineItem, fields: FormFields) {
    setBusyKey(`update:${item.id}`);
    setBanner(null);
    try {
      const validation = validateFields(fields);
      if (!validation.ok) {
        setBanner({ kind: "error", title: "Cannot update line item", message: validation.message });
        return;
      }
      // PATCH only fields the operator can edit in this slice. We always
      // send both packet ids (or null) so the server can transition between
      // SOLD_SCOPE / MANIFEST and library / local packet pins atomically
      // under the MANIFEST_SCOPE_PIN_XOR invariant.
      const patch = {
        title: validation.title,
        description: validation.description,
        quantity: validation.quantity,
        executionMode: fields.executionMode,
        unitPriceCents: validation.unitPriceCents,
        paymentBeforeWork: validation.paymentBeforeWork,
        paymentGateTitleOverride: validation.paymentBeforeWork ? validation.paymentGateTitleOverride : null,
        scopePacketRevisionId: validation.scopePacketRevisionId,
        quoteLocalPacketId: validation.quoteLocalPacketId,
      };
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/line-items/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(patch),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setBanner({
          kind: "error",
          title: "Update failed",
          message: json.error?.message ?? `${res.status} ${json.error?.code ?? "ERROR"}`,
        });
        return;
      }
      setEditingLineItemId(null);
      setBanner({ kind: "success", title: "Line item updated", message: validation.title });
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDelete(item: LineItem) {
    if (
      !window.confirm(
        `Delete line item "${item.title}"? This removes it from the head draft and cannot be undone here.`,
      )
    ) {
      return;
    }
    setBusyKey(`delete:${item.id}`);
    setBanner(null);
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/line-items/${encodeURIComponent(item.id)}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setBanner({
          kind: "error",
          title: "Delete failed",
          message: json.error?.message ?? `${res.status} ${json.error?.code ?? "ERROR"}`,
        });
        return;
      }
      setBanner({ kind: "success", title: "Line item deleted", message: item.title });
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-8">
      {banner ? <BannerView banner={banner} onDismiss={() => setBanner(null)} /> : null}

      {groupedLineItems.map((group) => {
        const isAddingHere = addingForGroupId === group.id;
        const isLibraryPickerHere = libraryPickerForGroupId === group.id;
        return (
          <section
            key={group.id}
            className="rounded-lg border border-zinc-800 bg-zinc-900/20 overflow-hidden"
          >
            <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-4 py-2.5">
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                  {group.name}
                </h2>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {group.items.length} {group.items.length === 1 ? "item" : "items"} · v{versionNumber} draft
                </p>
              </div>
              {!isAddingHere && !isLibraryPickerHere ? (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLibraryPickerForGroupId(group.id);
                        setEditingLineItemId(null);
                      }}
                      className="rounded border border-sky-800/60 bg-sky-950/30 px-2.5 py-1 text-[11px] font-medium text-sky-200 hover:text-sky-100 hover:border-sky-700 transition-colors"
                      title="Pick a saved line or saved work template to prefill a new line"
                    >
                      Insert saved line
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingForGroupId(group.id);
                        setEditingLineItemId(null);
                      }}
                      className="rounded bg-sky-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-sky-600 transition-colors"
                    >
                      + Write a custom line
                    </button>
                  </div>
                  <p className="hidden sm:block max-w-[18rem] text-right text-[10px] text-zinc-500 leading-snug">
                    Write a custom line from scratch, or insert a saved line/work template.
                  </p>
                </div>
              ) : null}
            </header>

            {isLibraryPickerHere ? (
              <div className="border-b border-zinc-800 bg-zinc-950/40 p-4">
                <QuickAddLineItemPicker
                  availableLibraryPackets={availableLibraryPackets}
                  availablePresets={availablePresets}
                  recentLineItems={recentLineItemsForPicker}
                  onSelect={(packet) => prefillFromPacket(packet, group)}
                  onSelectPreset={(preset) => prefillFromPreset(preset, group)}
                  onClose={() => setLibraryPickerForGroupId(null)}
                />
              </div>
            ) : null}

            {isAddingHere ? (
              <div className="border-b border-zinc-800 bg-zinc-950/40 p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                  New line item · {group.name}
                </h3>
                <LineItemForm
                  key={`create-${group.id}`}
                  initial={pendingPrefillByGroupId[group.id] ?? blankFields(group)}
                  proposalGroupOptions={[group]}
                  pinnableLibraryPackets={pinnableLibraryPackets}
                  availableLocalPackets={availableLocalPackets}
                  busy={busyKey === `create:${group.id}`}
                  submitLabel="Create line item"
                  onCancel={() => {
                    setAddingForGroupId(null);
                    clearPendingPrefill(group.id);
                  }}
                  onSubmit={(fields) => void handleCreate(fields, group)}
                />
              </div>
            ) : null}

            {group.items.length === 0 && !isAddingHere ? (
              <p className="px-4 py-6 text-xs text-zinc-500 text-center">
                No line items in this group yet. Use the buttons above to write a custom line or
                insert a saved line.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {group.items.map((item) => {
                  const isEditing = editingLineItemId === item.id;
                  return (
                    <li key={item.id} className="px-4 py-3">
                      {isEditing ? (
                        <LineItemForm
                          key={item.id}
                          initial={deriveInitialFromItem(item)}
                          proposalGroupOptions={[group]}
                          pinnableLibraryPackets={pinnableLibraryPackets}
                          availableLocalPackets={availableLocalPackets}
                          existingItem={item}
                          busy={busyKey === `update:${item.id}`}
                          submitLabel="Save changes"
                          onCancel={() => setEditingLineItemId(null)}
                          onSubmit={(fields) => void handleUpdate(item, fields)}
                        />
                      ) : (
                        <LineItemRow
                          item={item}
                          availableLibraryPackets={availableLibraryPackets}
                          executionPreview={
                            executionPreviewByLineItemId?.[item.id] ?? null
                          }
                          busy={busyKey === `delete:${item.id}`}
                          onEdit={() => {
                            setEditingLineItemId(item.id);
                            setAddingForGroupId(null);
                          }}
                          onDelete={() => void handleDelete(item)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- Subcomponents ---------------- */

function LineItemRow({
  item,
  availableLibraryPackets,
  executionPreview,
  busy,
  onEdit,
  onDelete,
}: {
  item: LineItem;
  availableLibraryPackets: LibraryPacketOption[];
  executionPreview: LineItemExecutionPreviewDto | null;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const packetSummary = describeAttachedPacket(item, availableLibraryPackets);
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-100 truncate">{item.title}</p>
          <p className="mt-1 text-[11px] text-zinc-500">
            <span className="font-mono">qty {item.quantity}</span> ·{" "}
            <span>{formatExecutionModeLabel(item.executionMode)}</span>
            {item.tierCode ? <span className="font-mono"> · tier {item.tierCode}</span> : null}
            {item.paymentBeforeWork ? " · payment before work" : ""}
          </p>
          {packetSummary ? (
            <p className={`mt-1 text-[11px] ${packetSummary.tone}`}>{packetSummary.label}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50 transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="rounded border border-red-900/60 bg-red-950/30 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-900/40 hover:text-red-200 disabled:opacity-50 transition-colors"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
      {executionPreview ? <LineItemExecutionPreviewBlock preview={executionPreview} /> : null}
    </div>
  );
}

function LineItemForm({
  initial,
  proposalGroupOptions,
  pinnableLibraryPackets,
  availableLocalPackets,
  existingItem,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormFields;
  proposalGroupOptions: ProposalGroup[];
  pinnableLibraryPackets: LibraryPacketOption[];
  availableLocalPackets: LocalPacketOption[];
  /** Provided in edit mode so the picker can surface a saved-but-not-latest revision. */
  existingItem?: LineItem;
  busy: boolean;
  submitLabel: string;
  onSubmit: (fields: FormFields) => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<FormFields>(initial);
  const groupName = useMemo(
    () => proposalGroupOptions.find((g) => g.id === fields.proposalGroupId)?.name ?? "(none)",
    [fields.proposalGroupId, proposalGroupOptions],
  );

  // Resetting packet state on executionMode toggle keeps the form aligned
  // with the server-side MANIFEST_SCOPE_PIN_XOR invariant. SOLD_SCOPE always
  // pins nothing; flipping back to MANIFEST forces the user to re-pick.
  function setExecutionMode(next: ExecutionMode) {
    if (next === "SOLD_SCOPE") {
      setFields({
        ...fields,
        executionMode: next,
        packetSource: "none",
        scopePacketRevisionId: "",
        quoteLocalPacketId: "",
      });
      return;
    }
    setFields({ ...fields, executionMode: next });
  }

  function setPacketSource(next: PacketSource) {
    setFields({
      ...fields,
      packetSource: next,
      scopePacketRevisionId: next === "library" ? fields.scopePacketRevisionId : "",
      quoteLocalPacketId: next === "local" ? fields.quoteLocalPacketId : "",
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(fields);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="text-zinc-400">Title</span>
          <input
            type="text"
            value={fields.title}
            onChange={(e) => setFields({ ...fields, title: e.target.value })}
            required
            disabled={busy}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
            placeholder="e.g. Install rooftop unit"
          />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="text-zinc-400">
            Description (optional, max {MAX_DESCRIPTION.toLocaleString()})
          </span>
          <textarea
            value={fields.description}
            onChange={(e) => setFields({ ...fields, description: e.target.value })}
            disabled={busy}
            maxLength={MAX_DESCRIPTION}
            rows={3}
            placeholder="Detail to surface on the proposal alongside the title."
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
          />
        </label>
        <label className="block text-xs">
          <span className="text-zinc-400">Quantity (integer)</span>
          <input
            type="number"
            inputMode="numeric"
            step={1}
            min={0}
            value={fields.quantity}
            onChange={(e) => setFields({ ...fields, quantity: e.target.value })}
            required
            disabled={busy}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
          />
        </label>
        <label className="block text-xs">
          <span className="text-zinc-400">Unit price (cents, optional)</span>
          <input
            type="number"
            inputMode="numeric"
            step={1}
            value={fields.unitPriceCents}
            onChange={(e) => setFields({ ...fields, unitPriceCents: e.target.value })}
            disabled={busy}
            placeholder="e.g. 12500"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
          />
        </label>
      </div>

      <FieldWorkQuestion
        executionMode={fields.executionMode}
        busy={busy}
        onChange={setExecutionMode}
      />

      <PacketPicker
        executionMode={fields.executionMode}
        packetSource={fields.packetSource}
        scopePacketRevisionId={fields.scopePacketRevisionId}
        quoteLocalPacketId={fields.quoteLocalPacketId}
        pinnableLibraryPackets={pinnableLibraryPackets}
        availableLocalPackets={availableLocalPackets}
        existingItem={existingItem}
        busy={busy}
        onSourceChange={setPacketSource}
        onLibraryChange={(id) => setFields({ ...fields, scopePacketRevisionId: id })}
        onLocalChange={(id) => setFields({ ...fields, quoteLocalPacketId: id })}
      />

      <label className="flex items-start gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={fields.paymentBeforeWork}
          onChange={(e) =>
            setFields({
              ...fields,
              paymentBeforeWork: e.target.checked,
              paymentGateTitleOverride: e.target.checked ? fields.paymentGateTitleOverride : "",
            })
          }
          disabled={busy}
        />
        <span>
          Require payment before field work starts for tasks from this line (frozen into the send
          package; Epic 47).
        </span>
      </label>
      {fields.paymentBeforeWork ? (
        <label className="block text-xs">
          <span className="text-zinc-400">Gate title override (optional, max 120)</span>
          <input
            type="text"
            value={fields.paymentGateTitleOverride}
            onChange={(e) => setFields({ ...fields, paymentGateTitleOverride: e.target.value })}
            disabled={busy}
            maxLength={120}
            placeholder="e.g. Deposit before mobilization"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
          />
        </label>
      ) : null}
      <p className="text-[10px] text-zinc-500">
        Proposal group: <span className="text-zinc-400">{groupName}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50 transition-colors"
        >
          {busy ? "Working…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Contractor-friendly replacement for the raw `executionMode` select. Two
 * radio choices wrap the same internal enum values:
 *
 *   - "No — quote-only"            => `executionMode = "SOLD_SCOPE"`
 *   - "Yes — attach a work template" => `executionMode = "MANIFEST"`
 *
 * Both call the existing `setExecutionMode(...)` callback so the form's
 * packet-clearing/preservation logic and the server invariant
 * `MANIFEST_SCOPE_PIN_XOR` continue to be enforced unchanged. The submitted
 * payload still carries the raw enum value.
 */
function FieldWorkQuestion({
  executionMode,
  busy,
  onChange,
}: {
  executionMode: ExecutionMode;
  busy: boolean;
  onChange: (next: ExecutionMode) => void;
}) {
  return (
    <fieldset className="rounded border border-zinc-800 bg-zinc-950/30 p-3 space-y-2">
      <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Does this line create field work?
      </legend>

      <div className="space-y-2">
        <label
          className={`flex items-start gap-2 rounded border p-2 cursor-pointer transition-colors ${
            executionMode === "SOLD_SCOPE"
              ? "border-zinc-600 bg-zinc-900/60"
              : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
          } ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name="executionMode"
            value="SOLD_SCOPE"
            checked={executionMode === "SOLD_SCOPE"}
            onChange={() => onChange("SOLD_SCOPE")}
            disabled={busy}
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="block text-xs font-medium text-zinc-100">No — quote-only</span>
            <span className="mt-0.5 block text-[11px] text-zinc-500">
              Appears on the proposal but does not create crew work.
            </span>
          </span>
        </label>

        <label
          className={`flex items-start gap-2 rounded border p-2 cursor-pointer transition-colors ${
            executionMode === "MANIFEST"
              ? "border-sky-700/70 bg-sky-950/30"
              : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
          } ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name="executionMode"
            value="MANIFEST"
            checked={executionMode === "MANIFEST"}
            onChange={() => onChange("MANIFEST")}
            disabled={busy}
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="block text-xs font-medium text-zinc-100">
              Yes — attach a work template
            </span>
            <span className="mt-0.5 block text-[11px] text-zinc-500">
              Creates crew work after approval using a saved work template or one-off work.
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}

/**
 * MANIFEST-only packet picker. Hidden for SOLD_SCOPE (replaced by an
 * informational note). For MANIFEST, the user must pick exactly one source
 * (library revision XOR quote-local packet); the server re-asserts this
 * via `assertManifestScopePinXor`.
 *
 * When editing an existing line whose pinned library revision is no longer
 * the latest published revision (e.g. a newer revision has since been
 * published), we surface a stable "saved revision" option so the user can
 * either keep it or roll forward by selecting the latest.
 */
function PacketPicker({
  executionMode,
  packetSource,
  scopePacketRevisionId,
  quoteLocalPacketId,
  pinnableLibraryPackets,
  availableLocalPackets,
  existingItem,
  busy,
  onSourceChange,
  onLibraryChange,
  onLocalChange,
}: {
  executionMode: ExecutionMode;
  packetSource: PacketSource;
  scopePacketRevisionId: string;
  quoteLocalPacketId: string;
  pinnableLibraryPackets: LibraryPacketOption[];
  availableLocalPackets: LocalPacketOption[];
  existingItem?: LineItem;
  busy: boolean;
  onSourceChange: (next: PacketSource) => void;
  onLibraryChange: (next: string) => void;
  onLocalChange: (next: string) => void;
}) {
  // Synthetic option: when editing a line whose saved library revision is
  // not the latest published revision of its parent packet, render an extra
  // option so the value remains visible/selectable instead of silently
  // disappearing. Resolves the parent packet by `scopePacketId` (carried in
  // the read DTO) so we can show its display name even when the revision
  // itself is not in the available list.
  //
  // Computed unconditionally before any early return so hook ordering stays
  // stable across executionMode toggles.
  const savedNonLatestLibrary = useMemo(() => {
    if (!existingItem) return null;
    if (!existingItem.scopePacketRevisionId) return null;
    if (!existingItem.scopeRevision) return null;
    const parent = pinnableLibraryPackets.find(
      (p) => p.id === existingItem.scopeRevision!.scopePacketId,
    );
    if (parent && parent.latestPublishedRevisionId === existingItem.scopePacketRevisionId) {
      return null;
    }
    return {
      id: existingItem.scopePacketRevisionId,
      parentDisplayName: parent?.displayName ?? "(unknown packet)",
      parentPacketKey: parent?.packetKey ?? null,
    };
  }, [existingItem, pinnableLibraryPackets]);

  if (executionMode === "SOLD_SCOPE") {
    return (
      <p className="rounded border border-dashed border-zinc-800 bg-zinc-950/40 px-3 py-2 text-[11px] text-zinc-500">
        This line is quote-only. It will appear on the proposal but won&rsquo;t create any crew
        work.
      </p>
    );
  }

  const hasLibrary = pinnableLibraryPackets.length > 0;
  const hasLocal = availableLocalPackets.length > 0;

  return (
    <fieldset className="rounded border border-zinc-800 bg-zinc-950/30 p-3 space-y-2">
      <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Work template (required when this line creates field work)
      </legend>

      <div className="flex flex-wrap gap-3 text-xs text-zinc-300">
        <label className="inline-flex items-center gap-1.5">
          <input
            type="radio"
            name="packetSource"
            value="library"
            checked={packetSource === "library"}
            onChange={() => onSourceChange("library")}
            disabled={busy || (!hasLibrary && !savedNonLatestLibrary)}
          />
          <span className={!hasLibrary && !savedNonLatestLibrary ? "text-zinc-600" : ""}>
            Saved work template
          </span>
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="radio"
            name="packetSource"
            value="local"
            checked={packetSource === "local"}
            onChange={() => onSourceChange("local")}
            disabled={busy || !hasLocal}
          />
          <span className={!hasLocal ? "text-zinc-600" : ""}>One-off work for this quote</span>
        </label>
      </div>

      {packetSource === "library" ? (
        <div className="space-y-1">
          <select
            value={scopePacketRevisionId}
            onChange={(e) => onLibraryChange(e.target.value)}
            disabled={busy}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
          >
            <option value="">— Choose a saved work template —</option>
            {savedNonLatestLibrary ? (
              <option value={savedNonLatestLibrary.id}>
                {savedNonLatestLibrary.parentDisplayName}
                {savedNonLatestLibrary.parentPacketKey
                  ? ` (${savedNonLatestLibrary.parentPacketKey})`
                  : ""}{" "}
                · older saved version
              </option>
            ) : null}
            {pinnableLibraryPackets.map((p) => (
              <option key={p.id} value={p.latestPublishedRevisionId ?? ""}>
                {p.displayName} ({p.packetKey}) · v{p.latestPublishedRevisionNumber ?? "?"}
              </option>
            ))}
          </select>
          {!hasLibrary ? (
            <p className="text-[10px] text-amber-400">
              No saved work templates are available yet. Create one in{" "}
              <Link
                href="/library/packets"
                className="underline underline-offset-2 hover:text-amber-300"
              >
                Library → Packets
              </Link>
              .
            </p>
          ) : (
            <p className="text-[10px] text-zinc-500">
              Pins the latest published version of the chosen template. The line keeps that
              version even if the template is republished later.
            </p>
          )}
        </div>
      ) : null}

      {packetSource === "local" ? (
        <div className="space-y-1">
          <select
            value={quoteLocalPacketId}
            onChange={(e) => onLocalChange(e.target.value)}
            disabled={busy}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
          >
            <option value="">— Choose one-off work —</option>
            {availableLocalPackets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName} · {p.itemCount} item{p.itemCount === 1 ? "" : "s"}
              </option>
            ))}
          </select>
          {!hasLocal ? (
            <p className="text-[10px] text-amber-400">
              No one-off work has been authored on this quote yet. Create some in the
              &ldquo;One-off work for this quote&rdquo; section below.
            </p>
          ) : (
            <p className="text-[10px] text-zinc-500">
              One-off work is authored on this quote and travels with it through freeze/send.
            </p>
          )}
        </div>
      ) : null}

      {packetSource === "none" ? (
        <p className="text-[10px] text-amber-400">
          Pick a work template above. Field-work lines must use exactly one — either a saved work
          template or one-off work for this quote. Saves that pin neither will be rejected.
        </p>
      ) : null}
    </fieldset>
  );
}

function BannerView({ banner, onDismiss }: { banner: NonNullable<Banner>; onDismiss: () => void }) {
  const isError = banner.kind === "error";
  return (
    <section
      role={isError ? "alert" : "status"}
      className={`rounded-lg border p-3 text-xs flex items-start justify-between gap-3 ${
        isError
          ? "border-red-900/60 bg-red-950/30 text-red-200"
          : "border-emerald-900/60 bg-emerald-950/20 text-emerald-200"
      }`}
    >
      <div>
        <p className="font-semibold">{banner.title}</p>
        {banner.message ? <p className="mt-0.5 opacity-90">{banner.message}</p> : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-[11px] opacity-70 hover:opacity-100"
      >
        ✕
      </button>
    </section>
  );
}

function ReadOnlyView({
  groupedLineItems,
  versionNumber,
  editableReason,
  quoteId,
  availableLibraryPackets,
  executionPreviewByLineItemId,
}: {
  groupedLineItems: GroupWithItems[];
  versionNumber: number;
  editableReason: EditableReason;
  quoteId: string;
  availableLibraryPackets: LibraryPacketOption[];
  executionPreviewByLineItemId: Record<string, LineItemExecutionPreviewDto> | null;
}) {
  const reasonMessage =
    editableReason === "missing_capability"
      ? "Your session lacks the office_mutate capability, so the editor is read-only here. Sign in as an office user with elevated permissions to edit scope."
      : "This is not the editable head draft. Open the workspace and use “Create new draft version” to start an editable revision.";
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-xs text-zinc-300">
        <p className="font-semibold text-zinc-100">Read-only view (v{versionNumber})</p>
        <p className="mt-1 text-zinc-400">{reasonMessage}</p>
        <div className="mt-3">
          <Link
            href={`/quotes/${quoteId}`}
            className="inline-block rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            Open workspace →
          </Link>
        </div>
      </section>

      {groupedLineItems.map((group) => (
        <section
          key={group.id}
          className="rounded-lg border border-zinc-800 bg-zinc-900/20 overflow-hidden"
        >
          <header className="border-b border-zinc-800 bg-zinc-900/40 px-4 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
              {group.name}
            </h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {group.items.length} {group.items.length === 1 ? "item" : "items"}
            </p>
          </header>
          {group.items.length === 0 ? (
            <p className="px-4 py-6 text-xs text-zinc-500 text-center">
              No line items in this group.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {group.items.map((item) => {
                const packetSummary = describeAttachedPacket(item, availableLibraryPackets);
                const preview = executionPreviewByLineItemId?.[item.id] ?? null;
                return (
                  <li key={item.id} className="px-4 py-3 space-y-2">
                    <div>
                      <p className="text-sm text-zinc-100">{item.title}</p>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        <span className="font-mono">qty {item.quantity}</span> ·{" "}
                        <span>{formatExecutionModeLabel(item.executionMode)}</span>
                        {item.tierCode ? <span className="font-mono"> · tier {item.tierCode}</span> : null}
                        {item.paymentBeforeWork ? " · payment before work" : ""}
                      </p>
                      {packetSummary ? (
                        <p className={`mt-1 text-[11px] ${packetSummary.tone}`}>{packetSummary.label}</p>
                      ) : null}
                    </div>
                    {preview ? <LineItemExecutionPreviewBlock preview={preview} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * Read-only execution preview rendered under each line item. Triangle Mode
 * surfaces what runtime tasks each MANIFEST line will compose into so the
 * operator can verify the packet → stage binding before send. This is a
 * direct projection of the pinned packet contents — it is not the compose
 * engine. The same data is what `runComposeFromReadModel` would later
 * iterate over (compose remains the source of truth at send/freeze).
 *
 * Five rendered shapes (one per `LineItemExecutionPreviewDto.kind`):
 *  - `soldScopeCommercial`: zinc note, commercial-only.
 *  - `manifestNoPacket`: amber warning matching the picker validator.
 *  - `manifestLibraryMissing` / `manifestLocalMissing`: red diagnostic.
 *  - `manifestLibrary` / `manifestLocal`: header (packet name + revision badge
 *    when library) + a compact list of tasks with stage label and
 *    requirement-kind tags. Empty packets render the header with a "0 tasks"
 *    note so the empty state is explicit, not silent.
 */
function LineItemExecutionPreviewBlock({ preview }: { preview: LineItemExecutionPreviewDto }) {
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

/* ---------------- Pure helpers ---------------- */

/**
 * Resolves a one-line packet attachment summary for a line item, suitable for
 * inline display on `LineItemRow` / `ReadOnlyView`. Returns null when there is
 * nothing meaningful to display (SOLD_SCOPE with no pin — the expected state).
 *
 * For MANIFEST lines that have no pin (an invariant violation that
 * pre-Triangle-Mode data may carry), we return an amber-toned warning so the
 * inconsistency is visible until the operator re-saves the row.
 */
function describeAttachedPacket(
  item: LineItem,
  availableLibraryPackets: LibraryPacketOption[],
): { label: string; tone: string } | null {
  if (item.scopePacketRevisionId && item.scopeRevision) {
    const parent = availableLibraryPackets.find(
      (p) => p.id === item.scopeRevision!.scopePacketId,
    );
    const isLatest =
      parent != null && parent.latestPublishedRevisionId === item.scopePacketRevisionId;
    const namePart = parent
      ? `${parent.displayName} (${parent.packetKey})`
      : "Saved work template";
    return {
      label: isLatest
        ? `Saved work template: ${namePart}`
        : `Saved work template: ${namePart} · older version`,
      tone: isLatest ? "text-sky-300" : "text-amber-400",
    };
  }
  if (item.quoteLocalPacketId && item.quoteLocalPacket) {
    return {
      label: `One-off work for this quote: ${item.quoteLocalPacket.displayName}`,
      tone: "text-emerald-300",
    };
  }
  if (item.executionMode === "MANIFEST") {
    return {
      label:
        "No work template attached — field-work lines need exactly one. Choose a saved work template or one-off work for this quote (saves without one will be rejected).",
      tone: "text-amber-400",
    };
  }
  return null;
}

/* ---------------- Validation ---------------- */

type ValidatedFields =
  | {
      ok: true;
      title: string;
      /**
       * Trimmed description, or `null` when the user left it blank. The
       * server stores the column as nullable; mirroring that here means we
       * never emit empty strings the server would just round-trip back as
       * `null` on the next read.
       */
      description: string | null;
      quantity: number;
      unitPriceCents: number | null;
      paymentBeforeWork: boolean;
      paymentGateTitleOverride: string | null;
      scopePacketRevisionId: string | null;
      quoteLocalPacketId: string | null;
    }
  | { ok: false; message: string };

const MAX_GATE_TITLE_OVERRIDE = 120;
/**
 * Mirror of `MAX_DESCRIPTION` in
 * `src/server/slice1/mutations/quote-line-item-mutations.ts`. Kept in sync
 * by hand — an explicit re-export from the server module would drag a
 * server-only file into the client bundle.
 */
const MAX_DESCRIPTION = 4000;

function validateFields(fields: FormFields): ValidatedFields {
  const title = fields.title.trim();
  if (!title) {
    return { ok: false, message: "Title is required." };
  }
  const descTrimmed = fields.description.trim();
  if (descTrimmed.length > MAX_DESCRIPTION) {
    return {
      ok: false,
      message: `Description must be at most ${MAX_DESCRIPTION} characters.`,
    };
  }
  const description: string | null = descTrimmed.length > 0 ? descTrimmed : null;
  const quantity = Number.parseInt(fields.quantity, 10);
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 0) {
    return { ok: false, message: "Quantity must be a non-negative integer." };
  }

  let unitPriceCents: number | null = null;
  if (fields.unitPriceCents.trim()) {
    const parsed = Number.parseInt(fields.unitPriceCents, 10);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return { ok: false, message: "Unit price (cents) must be an integer if provided." };
    }
    unitPriceCents = parsed;
  }

  const paymentBeforeWork = fields.paymentBeforeWork;
  const ov = fields.paymentGateTitleOverride.trim();
  if (ov.length > MAX_GATE_TITLE_OVERRIDE) {
    return { ok: false, message: `Gate title override must be at most ${MAX_GATE_TITLE_OVERRIDE} characters.` };
  }
  const paymentGateTitleOverride = paymentBeforeWork ? (ov.length > 0 ? ov : null) : null;

  // Packet-pin validation mirrors `assertManifestScopePinXor` so we surface
  // the same rule client-side and avoid a server round-trip on obvious
  // misconfigurations. The server is still authoritative.
  let scopePacketRevisionId: string | null = null;
  let quoteLocalPacketId: string | null = null;
  if (fields.executionMode === "MANIFEST") {
    if (fields.packetSource === "none") {
      return {
        ok: false,
        message:
          "Field-work line items must use exactly one work template — either a saved work template or one-off work for this quote. Pick one above.",
      };
    }
    if (fields.packetSource === "library") {
      const id = fields.scopePacketRevisionId.trim();
      if (!id) {
        return { ok: false, message: "Choose a saved work template to attach." };
      }
      scopePacketRevisionId = id;
    } else {
      const id = fields.quoteLocalPacketId.trim();
      if (!id) {
        return { ok: false, message: "Choose one-off work to attach." };
      }
      quoteLocalPacketId = id;
    }
  }
  // SOLD_SCOPE: both stay null; the server invariant requires neither.

  return {
    ok: true,
    title,
    description,
    quantity,
    unitPriceCents,
    paymentBeforeWork,
    paymentGateTitleOverride,
    scopePacketRevisionId,
    quoteLocalPacketId,
  };
}
