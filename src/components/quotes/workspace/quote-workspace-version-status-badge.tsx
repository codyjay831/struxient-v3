import type { QuoteVersionStatus } from "@prisma/client";

const tone: Record<QuoteVersionStatus, string> = {
  DRAFT: "border-amber-800/80 bg-amber-950/50 text-amber-200",
  SENT: "border-sky-800/80 bg-sky-950/50 text-sky-200",
  SIGNED: "border-violet-800/80 bg-violet-950/50 text-violet-200",
  VOID: "border-rose-900/60 bg-rose-950/40 text-rose-200",
  SUPERSEDED: "border-zinc-700 bg-zinc-900/80 text-zinc-400",
};

export function QuoteWorkspaceVersionStatusBadge({ status }: { status: QuoteVersionStatus }) {
  const cls = tone[status] ?? "border-zinc-700 bg-zinc-900 text-zinc-300";
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {status}
    </span>
  );
}
