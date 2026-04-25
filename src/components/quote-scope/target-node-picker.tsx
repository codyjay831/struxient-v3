"use client";

import { useEffect, useMemo, useState } from "react";
import { humanizeWorkflowNodeId } from "@/lib/workflow-node-display";
import type { WorkflowNodeKeyProjection } from "@/lib/workflow-snapshot-node-projection";

/**
 * Copy / behavior variant for the {@link TargetNodePicker}.
 *
 * - `quoteScopePinned` — quote-scope authoring (legacy variant). Falls back to
 *   free-text entry when no workflow is pinned. Retained for back-compat with
 *   any caller that has not yet opted into the safer `quoteScopeStage` mode.
 * - `quoteScopeStage` — quote-scope "Stage" picker (Triangle Mode). When no
 *   workflow is pinned, the picker LOCKS instead of falling back to free
 *   text, so authoring cannot silently persist node ids that compose will
 *   later reject. Renders human-friendly labels alongside the raw node id.
 * - `catalogLibraryHint` — admin/library context (catalog packet revisions).
 *   Free-text fallback is retained because the library row may target an
 *   id on a not-yet-pinned future template.
 */
export type TargetNodePickerCopyVariant =
  | "quoteScopePinned"
  | "quoteScopeStage"
  | "catalogLibraryHint";

/**
 * `targetNodeKey` picker: loads projected node ids from `GET …/workflow-versions/:id/node-keys`
 * when a workflow version id is supplied; otherwise either free-text or a locked
 * "pin a workflow first" state, depending on `copyVariant`.
 *
 * - **Quote scope (Triangle Mode)**: pass `copyVariant="quoteScopeStage"` and
 *   the quote version&apos;s pinned workflow version id (or `null`).
 * - **Catalog library packet (office)**: pass `copyVariant="catalogLibraryHint"`
 *   and the optional compose-hint published version id.
 *
 * The persisted `targetNodeKey: string` contract is unchanged. The label/id
 * presentation is purely cosmetic — the underlying value remains the raw
 * snapshot node id.
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
    if (copyVariant === "quoteScopeStage") {
      return <LockedStageFallback value={value} reason="noWorkflowPinned" />;
    }
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
    copyVariant === "catalogLibraryHint"
      ? "selected compose-hint workflow snapshot"
      : "current pinned workflow snapshot";

  const isStage = copyVariant === "quoteScopeStage";

  if (load.kind === "loading" || load.kind === "idle") {
    return (
      <div className="space-y-1">
        <p className="text-[10px] text-zinc-500">
          {isStage ? "Loading workflow stages…" : "Loading workflow nodes…"}
        </p>
        <ReadOnlyValue value={value} />
      </div>
    );
  }

  if (load.kind === "error") {
    if (isStage) {
      return (
        <div className="space-y-1">
          <p className="text-[10px] text-red-300">Failed to load workflow stages: {load.message}</p>
          <LockedStageFallback value={value} reason="loadError" />
        </div>
      );
    }
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
    if (isStage) {
      return (
        <div className="space-y-1">
          <p className="text-[10px] text-amber-400">
            The pinned workflow snapshot has no addressable stages.
          </p>
          <LockedStageFallback value={value} reason="emptySnapshot" />
        </div>
      );
    }
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
        <option value="">{isStage ? "— Choose a workflow stage —" : "— Choose a workflow node —"}</option>
        {valueIsKnown === false ? (
          <option value={trimmed}>
            {isStage ? `${trimmed} (saved value, not on current workflow)` : `${trimmed} (not in current snapshot)`}
          </option>
        ) : null}
        {load.nodes.map((n) => (
          <option key={n.nodeId} value={n.nodeId}>
            {formatNodeOptionLabel(n, copyVariant)}
          </option>
        ))}
      </select>
      {valueIsKnown === false ? (
        <p className="text-[10px] text-amber-400">
          {isStage ? (
            <>
              Saved <span className="font-mono">{trimmed}</span> is not a stage on the pinned workflow. Compose will
              reject it; pick a stage from the list to fix.
            </>
          ) : (
            <>
              Saved <span className="font-mono">{trimmed}</span> is not present on the {snapshotLabel}. Compose will
              reject it if the quote&apos;s pinned template does not include this id; pick a node from the list to fix.
            </>
          )}
        </p>
      ) : (
        <p className="text-[10px] text-zinc-500">
          {isStage
            ? "Stages come from the pinned workflow version. The raw node id is shown beside each label so technical operators can verify the binding."
            : copyVariant === "catalogLibraryHint"
              ? "Choices come from the selected published workflow version (compose hint only — the packet row still stores a plain string)."
              : "Choices come from the pinned workflow version's snapshot nodes."}
        </p>
      )}
    </div>
  );
}

function formatNodeOptionLabel(
  n: WorkflowNodeKeyProjection,
  copyVariant: TargetNodePickerCopyVariant,
): string {
  const taskSuffix =
    n.taskCount > 0
      ? `  ·  ${n.taskCount} skeleton task${n.taskCount === 1 ? "" : "s"}`
      : "";

  if (copyVariant === "quoteScopeStage") {
    const label = n.displayName ?? humanizeWorkflowNodeId(n.nodeId);
    const head = label === n.nodeId ? n.nodeId : `${label}  ·  ${n.nodeId}`;
    return `${head}${taskSuffix}`;
  }

  if (n.displayName != null && n.displayName !== n.nodeId) {
    return `${n.displayName}  ·  ${n.nodeId}${taskSuffix}`;
  }
  return `${n.nodeId}${taskSuffix}`;
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

/**
 * Locked replacement for {@link FreeTextFallback} used by the
 * `quoteScopeStage` variant. We never render an editable input here so an
 * author cannot silently persist an unverified `targetNodeKey` while the
 * quote has no pinned workflow (or the pinned workflow has no stages).
 */
function LockedStageFallback({
  value,
  reason,
}: {
  value: string;
  reason: "noWorkflowPinned" | "loadError" | "emptySnapshot";
}) {
  const message =
    reason === "noWorkflowPinned"
      ? "Pin a workflow version on this quote to choose a stage."
      : reason === "emptySnapshot"
        ? "The pinned workflow has no stages — pin a different version to choose one."
        : "Stages could not be loaded. Try again, or pin a different workflow version.";

  return (
    <div className="space-y-1">
      <select
        value=""
        onChange={() => {
          /* locked */
        }}
        disabled
        className="w-full rounded border border-dashed border-zinc-700 bg-zinc-950/50 px-2 py-1 font-mono text-[11px] text-zinc-500 disabled:opacity-60"
      >
        <option value="">— Stage selection unavailable —</option>
      </select>
      <p className="text-[10px] text-zinc-500">{message}</p>
      {value.trim() !== "" ? (
        <p className="rounded border border-dashed border-zinc-800 bg-zinc-950/50 px-2 py-1 font-mono text-[11px] text-zinc-400">
          saved value: {value}
        </p>
      ) : null}
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
