import Link from "next/link";
import type { QuoteVersionHistoryItemDto } from "@/server/slice1/reads/quote-version-history-reads";
import { QuoteWorkspaceVersionStatusBadge } from "./quote-workspace-version-status-badge";

type WorkspaceShell = {
  quote: { id: string; quoteNumber: string };
  customer: { id: string; name: string };
  flowGroup: { id: string; name: string };
};

type Props = {
  quoteId: string;
  shell: WorkspaceShell;
  head: QuoteVersionHistoryItemDto | null;
};

/**
 * Office-oriented shell + context strip (server truth from workspace read).
 */
export function QuoteWorkspaceShellSummary({ quoteId, shell, head }: Props) {
  return (
    <section
      aria-labelledby="workspace-shell-heading"
      className="mb-8 rounded-lg border border-zinc-800 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 p-5 shadow-sm shadow-black/20"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p id="workspace-shell-heading" className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Quote number
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">{shell.quote.quoteNumber}</p>
        </div>
        {head ?
          <div className="rounded-md border border-zinc-800/80 bg-zinc-950/80 px-3 py-2 text-right sm:text-left">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Current version</p>
            <div className="mt-1 flex flex-wrap items-center justify-end gap-2 sm:justify-start">
              <span className="text-sm font-medium text-zinc-200">v{head.versionNumber}</span>
              <QuoteWorkspaceVersionStatusBadge status={head.status} />
            </div>
          </div>
        : null}
      </div>

      <dl className="mt-5 grid gap-4 border-t border-zinc-800/80 pt-5 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Customer</dt>
          <dd className="mt-1 text-sm text-zinc-200">{shell.customer.name}</dd>
          <dd className="mt-1 flex items-center gap-2">
            <Link
              href={`/dev/customers`}
              className="text-[11px] text-sky-400 hover:text-sky-300"
              prefetch={false}
            >
              View all customers
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Execution Group</dt>
          <dd className="mt-1 text-sm text-zinc-200">{shell.flowGroup.name}</dd>
          <dd className="mt-1 flex items-center gap-2">
            <Link
              href={`/dev/flow-groups`}
              className="text-[11px] text-sky-400 hover:text-sky-300"
              prefetch={false}
            >
              View all groups
            </Link>
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-zinc-800/40 pt-3">
        <details className="text-[10px] text-zinc-600">
          <summary className="cursor-pointer font-medium hover:text-zinc-500">Reference details</summary>
          <div className="mt-2 space-y-1.5">
            <p>Quote ID: <span className="font-mono">{shell.quote.id}</span></p>
            {head ? <p>Head ID: <span className="font-mono">{head.id}</span></p> : null}
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
              <Link
                href={`/api/customers/${shell.customer.id}`}
                className="underline decoration-zinc-800 hover:text-zinc-500"
                prefetch={false}
              >
                Customer API
              </Link>
              <Link
                href={`/api/flow-groups/${shell.flowGroup.id}`}
                className="underline decoration-zinc-800 hover:text-zinc-500"
                prefetch={false}
              >
                Flow Group API
              </Link>
            </div>
          </div>
        </details>
      </div>

      {shell.quote.id !== quoteId ?
        <p className="mt-4 text-xs text-amber-700/90">
          Route quote id <span className="font-mono">{quoteId}</span> does not match loaded shell id — verify tenant
          data.
        </p>
      : null}
    </section>
  );
}
