"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorkflowNodeKeyProjection } from "@/lib/workflow-snapshot-node-projection";

export type TargetNodePickerCopyVariant = "quoteScopePinned" | "catalogLibraryHint";

/**
 * `targetNodeKey` picker: loads projected node ids from `GET …/workflow-versions/:id/node-keys`
 * when a workflow version id is supplied; otherwise free-text (compose validates later).
 *
 * - **Quote scope**: pass the quote version&apos;s pinned workflow version id.
 * - **Catalog library packet (office)**: pass the optional compose-hint published version id.
 *
 * The persisted `targetNodeKey: string` contract is unchanged.
 */

type Props = {
  workflowVersionIdForNodeKeys: string | null;
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  copyVariant?: TargetNodePickerCopyVariant;
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

export function TargetNodePicker({
  workflowVersionIdForNodeKeys,
  value,
  disabled,
  onChange,
  copyVariant = "quoteScopePinned",
}: Props) {
  if (workflowVersionIdForNodeKeys == null || workflowVersionIdForNodeKeys === "") {
    return (
      <FreeTextFallback
        value={value}
        disabled={disabled}
        onChange={onChange}
        copyVariant={copyVariant}
      />
    );
  }
  return (
    <WorkflowSnapshotNodeKeyPicker
      workflowVersionId={workflowVersionIdForNodeKeys}
      value={value}
      disabled={disabled}
      onChange={onChange}
      copyVariant={copyVariant}
    />
  );
}

function WorkflowSnapshotNodeKeyPicker({
  workflowVersionId,
  value,
  disabled,
  onChange,
  copyVariant,
}: {
  workflowVersionId: string;
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  copyVariant: TargetNodePickerCopyVariant;
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
            message: err instanceof Error ? err.message : "Failed to load workflow nodes.",
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

  const snapshotLabel =
    copyVariant === "catalogLibraryHint" ? "selected compose-hint workflow snapshot" : "current pinned workflow snapshot";

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
          copyVariant={copyVariant}
          fallbackHint="Falling back to free-text entry."
        />
      </div>
    );
  }

  if (load.nodes.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] text-amber-400">The workflow snapshot has no addressable nodes.</p>
        <FreeTextFallback
          value={value}
          disabled={disabled}
          onChange={onChange}
          copyVariant={copyVariant}
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
          Saved <span className="font-mono">{trimmed}</span> is not present on the {snapshotLabel}. Compose will
          reject it if the quote&apos;s pinned template does not include this id; pick a node from the list to fix.
        </p>
      ) : (
        <p className="text-[10px] text-zinc-500">
          {copyVariant === "catalogLibraryHint"
            ? "Choices come from the selected published workflow version (compose hint only — the packet row still stores a plain string)."
            : "Choices come from the pinned workflow version's snapshot nodes."}
        </p>
      )}
    </div>
  );
}

function FreeTextFallback({
  value,
  disabled,
  onChange,
  copyVariant,
  fallbackHint,
}: {
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  copyVariant: TargetNodePickerCopyVariant;
  fallbackHint?: string;
}) {
  const placeholder =
    copyVariant === "catalogLibraryHint"
      ? "node id (e.g. install-node)"
      : "node id on the pinned workflow snapshot";

  const defaultHint =
    copyVariant === "catalogLibraryHint"
      ? "No compose-hint workflow selected — enter a node id that exists on the template you plan to pin, or choose a published version above."
      : "No workflow is pinned to this quote version yet. Validity will be checked when compose runs.";

  return (
    <div className="space-y-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-[11px] text-zinc-200 disabled:opacity-50"
      />
      <p className="text-[10px] text-zinc-500">{fallbackHint ?? defaultHint}</p>
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
