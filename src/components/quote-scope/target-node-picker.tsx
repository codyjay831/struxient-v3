"use client";

import { useEffect, useMemo, useState } from "react";
import { humanizeWorkflowNodeId } from "@/lib/workflow-node-display";
import type { WorkflowNodeKeyProjection } from "@/lib/workflow-snapshot-node-projection";
import {
  listCanonicalExecutionStages,
  isCanonicalExecutionStageKey,
} from "@/lib/canonical-execution-stages";

/**
 * Copy / behavior variant for the {@link TargetNodePicker}.
 *
 * - `quoteScopeStage` — quote-scope "Stage" picker (Triangle Mode).
 *   Always shows the 6 canonical execution stages. If a workflow is pinned,
 *   it validates that the selected stage exists on that workflow.
 * - `catalogLibrary` — admin/library context (catalog packet revisions).
 *   Always shows the 6 canonical execution stages.
 */
export type TargetNodePickerCopyVariant = "quoteScopeStage" | "catalogLibrary";

/**
 * `Stage` picker (Triangle Mode): always uses the canonical execution stage vocabulary.
 *
 * The persisted `targetNodeKey: string` contract is unchanged. The label/id
 * presentation is purely cosmetic — the underlying value remains the raw
 * canonical stage key.
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
  copyVariant = "quoteScopeStage",
}: Props) {
  const [load, setLoad] = useState<LoadState>({ kind: "idle" });

  useEffect(() => {
    if (!workflowVersionIdForNodeKeys) {
      setLoad({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setLoad({ kind: "loading" });
    fetchNodeKeys(workflowVersionIdForNodeKeys).then(
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
  }, [workflowVersionIdForNodeKeys]);

  const stages = useMemo(() => listCanonicalExecutionStages(), []);
  const trimmed = value.trim();

  const workflowNodeIds = useMemo(() => {
    if (load.kind !== "ok") return null;
    return new Set(load.nodes.map((n) => n.nodeId));
  }, [load]);

  const valueIsCanonical = isCanonicalExecutionStageKey(trimmed);
  const valueOnWorkflow = workflowNodeIds ? workflowNodeIds.has(trimmed) : null;

  return (
    <div className="space-y-1">
      <select
        value={trimmed}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-200 disabled:opacity-50"
      >
        <option value="">— Choose a Stage —</option>
        {!valueIsCanonical && trimmed !== "" ? (
          <option value={trimmed}>{trimmed} (non-canonical)</option>
        ) : null}
        {stages.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>

      {workflowVersionIdForNodeKeys && valueOnWorkflow === false && trimmed !== "" ? (
        <p className="text-[10px] text-amber-400">
          Warning: Stage <span className="font-mono">{trimmed}</span> is not present on the pinned workflow.
          Compose will fail; ensure the workflow includes this stage ID.
        </p>
      ) : null}

      {!valueIsCanonical && trimmed !== "" ? (
        <p className="text-[10px] text-amber-400">
          Warning: <span className="font-mono">{trimmed}</span> is a non-canonical stage ID.
        </p>
      ) : null}

      <p className="text-[10px] text-zinc-500 italic">
        {copyVariant === "quoteScopeStage"
          ? "Execution stage placement for this task."
          : "Default execution stage for this task line."}
      </p>
    </div>
  );
}
