"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type LibraryPacketComposeHintWorkflowOption = {
  id: string;
  label: string;
};

const LibraryPacketComposeHintWorkflowContext = createContext<string | null | undefined>(undefined);

/**
 * Optional published `WorkflowVersion` used only to populate `targetNodeKey`
 * choices on office library packet DRAFT authoring. Does not change persisted
 * packet data beyond what authors pick for `targetNodeKey` strings.
 */
export function LibraryPacketComposeHintWorkflowProvider({
  enabled,
  versionOptions,
  children,
}: {
  enabled: boolean;
  versionOptions: LibraryPacketComposeHintWorkflowOption[];
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState("");

  const hintWorkflowVersionId = useMemo(() => {
    if (!enabled || selectedId === "") return null;
    return selectedId;
  }, [enabled, selectedId]);

  return (
    <LibraryPacketComposeHintWorkflowContext.Provider value={hintWorkflowVersionId}>
      {enabled ? (
        <div className="mb-6 rounded-lg border border-violet-900/40 bg-violet-950/15 px-4 py-3">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
            Compose-hint workflow (optional)
          </label>
          <p className="mt-1 text-[11px] leading-relaxed text-violet-200/75">
            Pick a <span className="font-medium text-violet-100/90">published</span> process-template version to
            drive <span className="font-mono text-violet-100/85">targetNodeKey</span> dropdowns below. The packet stays
            template-agnostic on disk — this only helps authors align keys with a workflow they expect to pin on
            quotes. Compose still validates against the quote&apos;s actually pinned template at send time.
          </p>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="mt-2 w-full max-w-xl rounded border border-violet-900/50 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
            aria-label="Published workflow version for target node key hints"
          >
            <option value="">None — free-text targetNodeKey (unchanged)</option>
            {versionOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {versionOptions.length === 0 ? (
            <p className="mt-2 text-[10px] text-amber-300/90">
              No published workflow versions exist for this tenant yet — publish a process template version under
              Library → Process templates, then return here to pick node ids.
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </LibraryPacketComposeHintWorkflowContext.Provider>
  );
}

export function useLibraryPacketComposeHintWorkflowVersionId(): string | null {
  const v = useContext(LibraryPacketComposeHintWorkflowContext);
  if (v === undefined) return null;
  return v;
}
