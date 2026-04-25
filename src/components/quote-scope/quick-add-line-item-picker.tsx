"use client";

import { useMemo, useState } from "react";
import {
  computeRecentLibraryPacketIds,
  filterLibraryPacketsByQuery,
  filterPinnableLibraryPackets,
  filterPresetsByQuery,
  type LineItemForRecent,
} from "@/lib/quick-add-line-item-picker-filter";
import {
  buildFieldsFromPreset,
  type PresetUnusableReason,
} from "@/lib/quote-line-item-prefill";
import type { LineItemPresetSummaryDto } from "@/server/slice1/reads/line-item-preset-reads";
import type { ScopePacketSummaryDto } from "@/server/slice1/reads/scope-packet-catalog-reads";

/**
 * Quick-add line-item picker (Triangle Mode — Step 1 + Phase 2 / Slice 2).
 *
 * Inline panel that lets an estimator quickly start a new line item from
 * one of three sources, without bypassing the existing line-item form:
 *
 *   1. **Saved line items** (`LineItemPreset`) — commercial defaults from
 *      the tenant catalog (Phase 2). MANIFEST presets pin a packet's latest
 *      published revision; SOLD_SCOPE presets prefill commercial fields and
 *      leave packet pins blank.
 *   2. **Recent in this quote** — small strip of parent packets the user
 *      has already used elsewhere on this quote.
 *   3. **Library packets** — published `ScopePacket`s the tenant can pin.
 *
 * Design canon respected:
 *   - **Reads no new data.** Both `availableLibraryPackets` and
 *     `availablePresets` are loaded by `(office)/quotes/[quoteId]/scope/page.tsx`.
 *     This component is a pure consumer.
 *   - **Pinnable only.** Library packets are pre-filtered to those with a
 *     `latestPublishedRevisionId`. Presets are surfaced regardless of
 *     usability so the operator can see why a preset is currently disabled
 *     (re-link affordance), but selection is blocked when MANIFEST + missing
 *     packet OR + missing PUBLISHED revision.
 *   - **Selection emits a typed event, not a partial form.** The parent
 *     owns the prefill mapping (see `prefillFromPacket` /
 *     `prefillFromPreset` in `scope-editor.tsx`) so the picker stays
 *     decoupled from the form's internals.
 *   - **No SOLD_SCOPE for raw packets.** A library packet always implies
 *     MANIFEST. SOLD_SCOPE only enters the form via a SOLD_SCOPE preset.
 *   - **No auto-create.** Selection only stages a prefill — the user still
 *     clicks the existing form's "Create line item" button.
 */
export type QuickAddLineItemPickerProps = {
  /**
   * Full tenant-scoped catalog summary list (already loaded by the page).
   * The picker filters internally to `latestPublishedRevisionId !== null` so
   * callers can pass the unfiltered list without pre-massaging.
   */
  availableLibraryPackets: ReadonlyArray<ScopePacketSummaryDto>;
  /**
   * Tenant-scoped saved-line-item presets (Phase 2 / Slice 2). May be empty
   * (no presets exist yet) or omitted entirely (older callers / non-DRAFT
   * branches that don't load presets). Defaults to `[]` so the picker
   * renders the existing packet-only flow unchanged.
   *
   * The picker pre-computes usability per row using `buildFieldsFromPreset`;
   * unusable rows render with a reason badge and a disabled select button.
   */
  availablePresets?: ReadonlyArray<LineItemPresetSummaryDto>;
  /**
   * Existing line items on this quote version (any group), used to compute
   * the small "Recent in this quote" affordance. Pass `[]` to disable.
   * Shape is intentionally minimal — only the parent packet id reachable
   * via `scopeRevision.scopePacketId` is needed.
   */
  recentLineItems?: ReadonlyArray<LineItemForRecent>;
  /**
   * Called with the selected packet summary. The parent is responsible for
   * (a) computing the prefill, (b) opening the line-item form, and
   * (c) closing this picker (typically via the `onClose` callback).
   *
   * Only emitted for packets the picker has already verified are pinnable
   * (`latestPublishedRevisionId !== null`).
   */
  onSelect: (packet: ScopePacketSummaryDto) => void;
  /**
   * Called with the selected preset summary. Only emitted for presets the
   * picker has already verified are usable (MANIFEST → packet present and
   * PUBLISHED; SOLD_SCOPE always usable). Optional so the picker keeps
   * working in callers that haven't wired the preset path yet.
   */
  onSelectPreset?: (preset: LineItemPresetSummaryDto) => void;
  /** Close the picker without selecting. */
  onClose: () => void;
};

const RECENT_LIMIT = 3;

function unusableReasonLabel(reason: PresetUnusableReason): string {
  switch (reason) {
    case "manifest_packet_missing":
      return "Linked packet was deleted — re-link before using this preset.";
    case "manifest_no_published_revision":
      return "Linked packet has no PUBLISHED revision yet — publish before using.";
  }
}

export function QuickAddLineItemPicker({
  availableLibraryPackets,
  availablePresets = [],
  recentLineItems = [],
  onSelect,
  onSelectPreset,
  onClose,
}: QuickAddLineItemPickerProps) {
  const [query, setQuery] = useState("");

  const pinnable = useMemo(
    () => filterPinnableLibraryPackets(availableLibraryPackets),
    [availableLibraryPackets],
  );

  const filtered = useMemo(() => filterLibraryPacketsByQuery(pinnable, query), [pinnable, query]);

  // Per-preset usability — recomputed per render so DRAFT publish elsewhere
  // becomes visible after a `router.refresh()`. Cheap (O(n) over a small list)
  // and avoids stale "(usable)" rows.
  const presetEntries = useMemo(
    () =>
      availablePresets.map((p) => {
        const result = buildFieldsFromPreset(p, undefined);
        return {
          preset: p,
          usable: result.ok,
          reason: result.ok ? null : result.reason,
        };
      }),
    [availablePresets],
  );

  const filteredPresets = useMemo(
    () => filterPresetsByQuery(presetEntries.map((e) => e.preset), query),
    [presetEntries, query],
  );

  const presetEntryById = useMemo(() => {
    const m = new Map<string, (typeof presetEntries)[number]>();
    for (const e of presetEntries) m.set(e.preset.id, e);
    return m;
  }, [presetEntries]);

  const recentPackets = useMemo(() => {
    if (query.trim().length > 0) return [];
    const recentIds = computeRecentLibraryPacketIds(recentLineItems, RECENT_LIMIT);
    if (recentIds.length === 0) return [];
    const byId = new Map<string, ScopePacketSummaryDto>();
    for (const p of pinnable) byId.set(p.id, p);
    const out: ScopePacketSummaryDto[] = [];
    for (const id of recentIds) {
      const p = byId.get(id);
      if (p) out.push(p);
    }
    return out;
  }, [pinnable, recentLineItems, query]);

  const totalAvailable = availableLibraryPackets.length;
  const totalPinnable = pinnable.length;
  const totalPresets = availablePresets.length;
  const hasPresetSection = totalPresets > 0;

  return (
    <div className="rounded border border-zinc-700 bg-zinc-950 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Insert from library
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200"
        >
          Close
        </button>
      </div>

      <p className="text-[10px] text-zinc-500 leading-relaxed">
        Saved line items prefill price + scope. Library packets pin scope only — set price after
        adding. Either way, you still click <span className="text-zinc-300">Create</span>.
      </p>

      <input
        type="text"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by display name or key…"
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600"
      />

      {hasPresetSection ? (
        <PresetSection
          entries={filteredPresets.map((p) => presetEntryById.get(p.id)!).filter(Boolean)}
          totalPresets={totalPresets}
          query={query}
          onSelectPreset={onSelectPreset}
        />
      ) : null}

      {recentPackets.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
            Recent in this quote
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {recentPackets.map((p) => (
              <li key={`recent-${p.id}`}>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className="rounded border border-sky-800/60 bg-sky-950/30 px-2 py-0.5 text-[10px] text-sky-200 hover:text-sky-100 hover:border-sky-700"
                  title={`${p.displayName} (${p.packetKey}) · v${p.latestPublishedRevisionNumber ?? "?"}`}
                >
                  <span className="font-medium">{p.displayName}</span>
                  <span className="ml-1 font-mono text-sky-400/70">
                    v{p.latestPublishedRevisionNumber ?? "?"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
          Library packets
        </p>
        {totalPinnable === 0 ? (
          <EmptyState totalAvailable={totalAvailable} />
        ) : filtered.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-zinc-500">
            No library-packet matches for &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <ul className="max-h-64 overflow-y-auto divide-y divide-zinc-800 rounded border border-zinc-800">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className="w-full text-left px-2 py-1.5 hover:bg-zinc-900/60 focus:bg-zinc-900/60 focus:outline-none"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-medium text-zinc-100 truncate min-w-0">
                      {p.displayName}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500 shrink-0">{p.packetKey}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] uppercase tracking-wider text-zinc-500">
                    <span className="rounded border border-zinc-700/60 bg-zinc-900/40 px-1 text-zinc-300 normal-case">
                      Library packet
                    </span>
                    <span className="rounded border border-emerald-800/60 bg-emerald-950/30 px-1 text-emerald-300 normal-case">
                      v{p.latestPublishedRevisionNumber ?? "?"} published
                    </span>
                    {p.publishedRevisionCount > 1 ? (
                      <span className="rounded border border-zinc-700/60 bg-zinc-900/40 px-1 text-zinc-500 normal-case">
                        {p.publishedRevisionCount} published revisions
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type PresetEntry = {
  preset: LineItemPresetSummaryDto;
  usable: boolean;
  reason: PresetUnusableReason | null;
};

function PresetSection({
  entries,
  totalPresets,
  query,
  onSelectPreset,
}: {
  entries: PresetEntry[];
  totalPresets: number;
  query: string;
  onSelectPreset: ((preset: LineItemPresetSummaryDto) => void) | undefined;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
        Saved line items
      </p>
      {entries.length === 0 ? (
        <p className="px-2 py-3 text-[11px] text-zinc-500">
          {query.trim().length > 0
            ? `No saved line item matches for "${query}".`
            : `No saved line items on this tenant yet (${totalPresets} total).`}
        </p>
      ) : (
        <ul className="max-h-64 overflow-y-auto divide-y divide-zinc-800 rounded border border-zinc-800">
          {entries.map((entry) => (
            <PresetRow
              key={entry.preset.id}
              entry={entry}
              onSelectPreset={onSelectPreset}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PresetRow({
  entry,
  onSelectPreset,
}: {
  entry: PresetEntry;
  onSelectPreset: ((preset: LineItemPresetSummaryDto) => void) | undefined;
}) {
  const { preset, usable, reason } = entry;
  const disabled = !usable || onSelectPreset == null;
  const titleAttr = !usable && reason ? unusableReasonLabel(reason) : preset.displayName;
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled || !usable) return;
          onSelectPreset?.(preset);
        }}
        title={titleAttr}
        className={
          disabled
            ? "w-full text-left px-2 py-1.5 opacity-60 cursor-not-allowed"
            : "w-full text-left px-2 py-1.5 hover:bg-zinc-900/60 focus:bg-zinc-900/60 focus:outline-none"
        }
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-medium text-zinc-100 truncate min-w-0">
            {preset.displayName}
          </span>
          {preset.presetKey ? (
            <span className="font-mono text-[10px] text-zinc-500 shrink-0">{preset.presetKey}</span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] uppercase tracking-wider text-zinc-500">
          <span className="rounded border border-violet-800/60 bg-violet-950/30 px-1 text-violet-200 normal-case">
            Saved line item
          </span>
          <span className="rounded border border-zinc-700/60 bg-zinc-900/40 px-1 text-zinc-400 normal-case">
            {preset.defaultExecutionMode === "MANIFEST" ? "Manifest" : "Sold scope"}
          </span>
          {preset.defaultScopePacket ? (
            <span
              className="rounded border border-zinc-700/60 bg-zinc-900/40 px-1 text-zinc-300 normal-case truncate max-w-[16rem]"
              title={preset.defaultScopePacket.displayName}
            >
              Packet: {preset.defaultScopePacket.displayName}
              {preset.defaultScopePacket.latestPublishedRevisionNumber != null
                ? ` · v${preset.defaultScopePacket.latestPublishedRevisionNumber}`
                : ""}
            </span>
          ) : preset.defaultExecutionMode === "MANIFEST" ? (
            <span className="rounded border border-amber-800/60 bg-amber-950/30 px-1 text-amber-300 normal-case">
              Packet missing
            </span>
          ) : null}
          {!usable && reason ? (
            <span className="rounded border border-amber-800/60 bg-amber-950/30 px-1 text-amber-300 normal-case">
              {reason === "manifest_packet_missing"
                ? "Re-link required"
                : "No published revision"}
            </span>
          ) : null}
        </div>
        {!usable && reason ? (
          <p className="mt-1 text-[10px] text-amber-400/90">{unusableReasonLabel(reason)}</p>
        ) : null}
      </button>
    </li>
  );
}

function EmptyState({ totalAvailable }: { totalAvailable: number }) {
  if (totalAvailable === 0) {
    return (
      <p className="px-2 py-3 text-[11px] text-amber-400">
        No library packets are visible to this tenant yet.
      </p>
    );
  }
  return (
    <p className="px-2 py-3 text-[11px] text-amber-400">
      {totalAvailable} library packet{totalAvailable === 1 ? "" : "s"} exist on this tenant, but
      none have a published revision yet. Publish a revision in Library → Packets to make it
      pinnable.
    </p>
  );
}
