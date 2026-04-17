import type { QuoteVersionStatus } from "@prisma/client";

const tone: Record<QuoteVersionStatus, string> = {
  DRAFT: "border-amber-800/80 bg-amber-950/50 text-amber-200",
  SENT: "border-sky-800/80 bg-sky-950/50 text-sky-200",
  SIGNED: "border-violet-800/80 bg-violet-950/50 text-violet-200",
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
