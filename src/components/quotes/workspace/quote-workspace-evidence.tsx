"use client";

import { useState } from "react";
import type { QuoteWorkspaceEvidenceDto } from "@/server/slice1/reads/quote-workspace-reads";
import { MediaThumbnail, MediaViewerModal } from "@/components/execution/execution-media-ux";

type Props = {
  evidence: QuoteWorkspaceEvidenceDto[];
};

export function QuoteWorkspaceEvidence({ evidence }: Props) {
  const [selected, setSelected] = useState<QuoteWorkspaceEvidenceDto | null>(null);

  if (evidence.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
          Job Evidence
        </h3>
        <span className="text-[10px] font-bold text-zinc-600 bg-zinc-950 px-2 py-0.5 rounded-full">
          {evidence.length} Files
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {evidence.slice(0, 8).map((e, i) => (
          <MediaThumbnail 
            key={i}
            attachment={{ 
                key: e.storageKey, 
                fileName: e.fileName, 
                contentType: e.contentType 
            }}
            onClick={() => setSelected(e)}
            size="md"
          />
        ))}
        {evidence.length > 8 && (
          <div className="h-12 w-12 rounded-lg border border-zinc-800 bg-zinc-950 flex items-center justify-center text-[10px] font-bold text-zinc-600">
            +{evidence.length - 8}
          </div>
        )}
      </div>

      {selected && (
        <MediaViewerModal 
          attachment={{ 
            key: selected.storageKey, 
            fileName: selected.fileName, 
            contentType: selected.contentType 
          }} 
          onClose={() => setSelected(null)} 
        />
      )}
      
      <p className="text-[9px] text-zinc-600 italic">
        Showing latest verified field uploads.
      </p>
    </div>
  );
}
