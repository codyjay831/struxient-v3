"use client";

import { useEffect, useMemo, useState } from "react";
import { filterTaskDefinitionSummariesByQuery } from "@/lib/task-definition-picker-filter";
import type { TaskDefinitionSummaryDto } from "@/server/slice1/reads/task-definition-reads";

/**
 * Compact summary used to display a previously-selected TaskDefinition that
 * may not appear in the picker's PUBLISHED-only fetch (e.g. existing items
 * pointing at DRAFT/ARCHIVED definitions). The QuoteLocalPacketItem read DTO
 * already hydrates this shape from the relation.
 */
export type SelectedTaskDefinitionSummary = {
  id: string;
  taskKey: string;
  displayName: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

type Props = {
  /** The currently saved id (server truth) on the underlying item, if any. */
  initialSelectedId: string | null;
  /** Pre-hydrated summary for the initial id (e.g. from item.taskDefinition). */
  initialSelectedSummary: SelectedTaskDefinitionSummary | null;
  /** External controlled value (the editor's draft taskDefinitionId). */
  value: string | null;
  /** Disable interactive controls. */
  disabled?: boolean;
  onChange: (next: { id: string | null; summary: SelectedTaskDefinitionSummary | null }) => void;
};

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; items: TaskDefinitionSummaryDto[] }
  | { kind: "error"; message: string };

const FETCH_LIMIT = 200;

async function fetchPublishedTaskDefinitions(): Promise<TaskDefinitionSummaryDto[]> {
  const url = `/api/task-definitions?status=PUBLISHED&limit=${FETCH_LIMIT}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string; code?: string } };
      msg = body.error?.message ?? body.error?.code ?? msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  const body = (await res.json()) as { data?: { items?: TaskDefinitionSummaryDto[] } };
  return body.data?.items ?? [];
}

export function TaskDefinitionPicker({
  initialSelectedId,
  initialSelectedSummary,
  value,
  disabled,
  onChange,
}: Props) {
  const [load, setLoad] = useState<LoadState>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedSummary, setSelectedSummary] = useState<SelectedTaskDefinitionSummary | null>(
    initialSelectedSummary,
  );

  // If the controlled value is cleared externally, drop our cached summary.
  useEffect(() => {
    if (value === null) {
      setSelectedSummary(null);
      return;
    }
    if (initialSelectedSummary && initialSelectedSummary.id === value) {
      setSelectedSummary(initialSelectedSummary);
    }
    // We otherwise keep whatever summary the user just selected via the picker.
  }, [value, initialSelectedSummary]);

  async function ensureLoaded() {
    if (load.kind === "loading" || load.kind === "ok") return;
    setLoad({ kind: "loading" });
    try {
      const items = await fetchPublishedTaskDefinitions();
      setLoad({ kind: "ok", items });
    } catch (err) {
      setLoad({ kind: "error", message: err instanceof Error ? err.message : "Failed to load." });
    }
  }

  function openPicker() {
    if (disabled) return;
    setOpen(true);
    void ensureLoaded();
  }

  function closePicker() {
    setOpen(false);
    setQuery("");
  }

  function handleSelect(item: TaskDefinitionSummaryDto) {
    const summary: SelectedTaskDefinitionSummary = {
      id: item.id,
      taskKey: item.taskKey,
      displayName: item.displayName,
      status: item.status,
    };
    setSelectedSummary(summary);
    onChange({ id: item.id, summary });
    closePicker();
  }

  function handleClear() {
    setSelectedSummary(null);
    onChange({ id: null, summary: null });
  }

  const filtered = useMemo(() => {
    if (load.kind !== "ok") return [];
    return filterTaskDefinitionSummariesByQuery(load.items, query);
  }, [load, query]);

  const showStaleSummary =
    !!value && !!selectedSummary && selectedSummary.id === value && selectedSummary.status !== "PUBLISHED";

  return (
    <div className="space-y-2">
      {value && selectedSummary ? (
        <SelectedSummaryCard
          summary={selectedSummary}
          stale={showStaleSummary}
          disabled={disabled}
          onChange={openPicker}
          onClear={handleClear}
        />
      ) : value && initialSelectedId === value && !selectedSummary ? (
        <UnknownSelectedCard id={value} disabled={disabled} onChange={openPicker} onClear={handleClear} />
      ) : (
        <div>
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled}
            className="rounded border border-sky-800/60 bg-sky-950/30 px-2 py-1 text-[11px] font-medium text-sky-300 hover:text-sky-200 disabled:opacity-40"
          >
            Pick a task definition…
          </button>
          <p className="mt-1 text-[10px] text-zinc-500">
            Tenant-scoped, published library only.
          </p>
        </div>
      )}

      {open ? (
        <PickerPanel
          load={load}
          query={query}
          onQueryChange={setQuery}
          filtered={filtered}
          onSelect={handleSelect}
          onCancel={closePicker}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}

/* ───────────────────────── Selected summary ───────────────────────── */

function SelectedSummaryCard({
  summary,
  stale,
  disabled,
  onChange,
  onClear,
}: {
  summary: SelectedTaskDefinitionSummary;
  stale: boolean;
  disabled?: boolean;
  onChange: () => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded border border-sky-800/40 bg-sky-950/20 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-sky-100">{summary.displayName}</p>
          <p className="mt-0.5 font-mono text-[10px] text-sky-300/80">{summary.taskKey}</p>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[9px] uppercase tracking-wider">
            <span
              className={`rounded px-1.5 py-0.5 font-semibold ${
                summary.status === "PUBLISHED"
                  ? "border border-emerald-800/60 bg-emerald-950/30 text-emerald-300"
                  : summary.status === "DRAFT"
                    ? "border border-amber-800/60 bg-amber-950/30 text-amber-300"
                    : "border border-zinc-700/60 bg-zinc-800/30 text-zinc-400"
              }`}
            >
              {summary.status}
            </span>
            <span className="rounded border border-zinc-700/60 bg-zinc-900/40 px-1.5 py-0.5 font-mono text-zinc-500 normal-case">
              {summary.id}
            </span>
          </div>
          {stale ? (
            <p className="mt-1.5 text-[10px] text-amber-400">
              Linked task definition is not currently published. Existing items remain stable;
              changing the selection will only offer published definitions.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={onChange}
            disabled={disabled}
            className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:text-zinc-100 disabled:opacity-40"
          >
            Change
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="rounded border border-red-900/60 px-2 py-0.5 text-[10px] text-red-300 hover:text-red-200 disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

function UnknownSelectedCard({
  id,
  disabled,
  onChange,
  onClear,
}: {
  id: string;
  disabled?: boolean;
  onChange: () => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded border border-amber-900/40 bg-amber-950/20 p-2 text-[11px] text-amber-200">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Linked task definition</p>
          <p className="mt-0.5 font-mono text-[10px] text-amber-300/80">{id}</p>
          <p className="mt-1 text-[10px] text-amber-300/70">
            Summary not pre-loaded for this id. Pick again to refresh.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={onChange}
            disabled={disabled}
            className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:text-zinc-100 disabled:opacity-40"
          >
            Change
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="rounded border border-red-900/60 px-2 py-0.5 text-[10px] text-red-300 hover:text-red-200 disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Picker panel ───────────────────────── */

function PickerPanel({
  load,
  query,
  onQueryChange,
  filtered,
  onSelect,
  onCancel,
  disabled,
}: {
  load: LoadState;
  query: string;
  onQueryChange: (next: string) => void;
  filtered: TaskDefinitionSummaryDto[];
  onSelect: (item: TaskDefinitionSummaryDto) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded border border-zinc-700 bg-zinc-950 p-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by display name or task key…"
          disabled={disabled || load.kind !== "ok"}
          className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600"
        />
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200"
        >
          Close
        </button>
      </div>

      <div className="mt-2">
        {load.kind === "loading" ? (
          <p className="px-2 py-3 text-[11px] text-zinc-500">Loading published task definitions…</p>
        ) : load.kind === "error" ? (
          <p className="px-2 py-3 text-[11px] text-red-300">Failed to load: {load.message}</p>
        ) : load.kind === "idle" ? (
          <p className="px-2 py-3 text-[11px] text-zinc-500">Preparing…</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-zinc-500">
            {load.items.length === 0
              ? "No published task definitions exist in this tenant yet."
              : `No matches for “${query}”.`}
          </p>
        ) : (
          <ul className="max-h-64 overflow-y-auto divide-y divide-zinc-800 rounded border border-zinc-800">
            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  disabled={disabled}
                  className="w-full text-left px-2 py-1.5 hover:bg-zinc-900/60 focus:bg-zinc-900/60 focus:outline-none disabled:opacity-50"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-medium text-zinc-100">{item.displayName}</span>
                    <span className="font-mono text-[10px] text-zinc-500">{item.taskKey}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5 text-[9px] uppercase tracking-wider text-zinc-500">
                    <span className="rounded border border-emerald-800/60 bg-emerald-950/30 px-1 text-emerald-300">
                      {item.status}
                    </span>
                    <span className="rounded border border-zinc-700/60 bg-zinc-900/40 px-1 text-zinc-500 normal-case">
                      {item.requirementsCount} reqs · {item.conditionalRulesCount} rules
                    </span>
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
