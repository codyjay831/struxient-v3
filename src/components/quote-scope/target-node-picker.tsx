"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorkflowNodeKeyProjection } from "@/lib/workflow-snapshot-node-projection";

/**
 * QuoteLocalPacketItem `targetNodeKey` picker.
 *
 * - When a workflow is pinned: lazy-fetches a projected node-key list and
 *   renders a native <select> bound to the draft's targetNodeKey value.
 *   If the saved value is not present in the current snapshot, it surfaces
 *   inline as a "not in current snapshot" warning but is preserved so the
 *   author can keep, change, or clear it.
 * - When no workflow is pinned: degrades to the existing free-text input
 *   with explanatory copy. Compose validates `targetNodeKey` later.
 *
 * The save contract on `targetNodeKey: string` is unchanged.
 */

type Props = {
  pinnedWorkflowVersionId: string | null;
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
};

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; nodes: WorkflowNodeKeyProjection[] }
  | { kind: "error"; message: string };

async function fetchNodeKeys(workflowVersionId: string): Promise<WorkflowNodeKeyProjection[]> {
  const url = `/api/workflow-versions/${encodeURIComponent(workflowVersionId)}/node-keys`;
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
  const body = (await res.json()) as {
    data?: { nodes?: WorkflowNodeKeyProjection[] };
  };
  return body.data?.nodes ?? [];
}

export function TargetNodePicker({ pinnedWorkflowVersionId, value, disabled, onChange }: Props) {
  if (pinnedWorkflowVersionId == null) {
    return <FreeTextFallback value={value} disabled={disabled} onChange={onChange} />;
  }
  return (
    <PinnedWorkflowPicker
      workflowVersionId={pinnedWorkflowVersionId}
      value={value}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

/* ─────────────────── Pinned-workflow select ─────────────────── */

function PinnedWorkflowPicker({
  workflowVersionId,
  value,
  disabled,
  onChange,
}: {
  workflowVersionId: string;
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const [load, setLoad] = useState<LoadState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    fetchNodeKeys(workflowVersionId).then(
      (nodes) => {
        if (!cancelled) setLoad({ kind: "ok", nodes });
      },
      (err) => {
        if (!cancelled) {
          setLoad({
            kind: "error",
            message: err instanceof Error ? err.message : "Failed to load node keys.",
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [workflowVersionId]);

  const trimmed = value.trim();
  const valueIsKnown = useMemo(() => {
    if (load.kind !== "ok") return null;
    if (trimmed === "") return null;
    return load.nodes.some((n) => n.nodeId === trimmed);
  }, [load, trimmed]);

  if (load.kind === "loading" || load.kind === "idle") {
    return (
      <div className="space-y-1">
        <p className="text-[10px] text-zinc-500">Loading workflow nodes…</p>
        <ReadOnlyValue value={value} />
      </div>
    );
  }

  if (load.kind === "error") {
    return (
      <div className="space-y-1">
        <p className="text-[10px] text-red-300">Failed to load workflow nodes: {load.message}</p>
        <FreeTextFallback
          value={value}
          disabled={disabled}
          onChange={onChange}
          fallbackHint="Falling back to free-text entry."
        />
      </div>
    );
  }

  if (load.nodes.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] text-amber-400">
          The pinned workflow snapshot has no addressable nodes.
        </p>
        <FreeTextFallback
          value={value}
          disabled={disabled}
          onChange={onChange}
          fallbackHint="Compose will validate this value when run."
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <select
        value={trimmed === "" ? "" : trimmed}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-[11px] text-zinc-200 disabled:opacity-50"
      >
        <option value="">— Choose a workflow node —</option>
        {valueIsKnown === false ? (
          <option value={trimmed}>{trimmed} (not in current snapshot)</option>
        ) : null}
        {load.nodes.map((n) => (
          <option key={n.nodeId} value={n.nodeId}>
            {n.nodeId}
            {n.taskCount > 0 ? `  ·  ${n.taskCount} skeleton task${n.taskCount === 1 ? "" : "s"}` : ""}
          </option>
        ))}
      </select>
      {valueIsKnown === false ? (
        <p className="text-[10px] text-amber-400">
          Saved <span className="font-mono">{trimmed}</span> is not present on the current pinned
          workflow snapshot. Compose will reject it; pick a node from the list to fix.
        </p>
      ) : (
        <p className="text-[10px] text-zinc-500">
          Choices come from the pinned workflow version&apos;s snapshot nodes.
        </p>
      )}
    </div>
  );
}

/* ─────────────────── Free-text fallback ─────────────────── */

function FreeTextFallback({
  value,
  disabled,
  onChange,
  fallbackHint,
}: {
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  fallbackHint?: string;
}) {
  return (
    <div className="space-y-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="node id on the pinned workflow snapshot"
        className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-[11px] text-zinc-200 disabled:opacity-50"
      />
      <p className="text-[10px] text-zinc-500">
        {fallbackHint ??
          "No workflow is pinned to this quote version yet. Validity will be checked when compose runs."}
      </p>
    </div>
  );
}

function ReadOnlyValue({ value }: { value: string }) {
  return (
    <p className="rounded border border-dashed border-zinc-800 bg-zinc-950/50 px-2 py-1 font-mono text-[11px] text-zinc-400">
      {value === "" ? "—" : value}
    </p>
  );
}
