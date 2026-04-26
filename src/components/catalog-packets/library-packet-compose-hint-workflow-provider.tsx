"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type LibraryPacketComposeHintWorkflowOption = {
  id: string;
  label: string;
};

const LibraryPacketComposeHintWorkflowContext = createContext<string | null | undefined>(undefined);

/**
 * Optional published `WorkflowVersion` used only to validate canonical stage
 * alignment on office library packet DRAFT authoring. Does not change persisted
 * packet data beyond what authors pick for stage keys.
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
        <div className="mb-6 space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/20 px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Execution Stages
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              Task lines use Struxient&apos;s standard execution stages. These stages determine
              where work appears during execution. Catalog packets use these stages to ensure
              compatibility across different process templates.
            </p>
          </div>

          <details className="group rounded-lg border border-violet-900/40 bg-violet-950/5 px-4 py-3">
            <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-wider text-violet-300/80 hover:text-violet-200">
              <span className="flex items-center gap-2">
                <span className="transition-transform group-open:rotate-90">▶</span>
                Technical validation (optional)
              </span>
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-[11px] leading-relaxed text-violet-200/75">
                Pick a <span className="font-medium text-violet-100/90">published</span> process-template version to
                validate stage alignment. This does not change the packet—it only helps you verify
                that the stages you pick exist on a specific workflow you expect to use.
              </p>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full max-w-xl rounded border border-violet-900/50 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
                aria-label="Published workflow version for stage validation hints"
              >
                <option value="">None — No specific validation</option>
                {versionOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              {versionOptions.length === 0 ? (
                <p className="text-[10px] text-amber-300/90">
                  No published workflow versions exist for this tenant yet.
                </p>
              ) : null}
            </div>
          </details>
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
