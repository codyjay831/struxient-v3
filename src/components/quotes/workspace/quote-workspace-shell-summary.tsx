import Link from "next/link";
import type { QuoteVersionHistoryItemDto } from "@/server/slice1/reads/quote-version-history-reads";
import { QuoteWorkspaceVersionStatusBadge } from "./quote-workspace-version-status-badge";
import { InternalQuickJump } from "@/components/internal/internal-quick-jump";

type WorkspaceShell = {
  quote: { id: string; quoteNumber: string };
  customer: { id: string; name: string };
  flowGroup: { id: string; name: string; jobId: string | null };
};

type Props = {
  quoteId: string;
  shell: WorkspaceShell;
  head: QuoteVersionHistoryItemDto | null;
  /** Compact strip for office command center; full card for dev / diagnostics. */
  variant?: "compact" | "full";
};

const isDevQuickJumpEnabled = process.env.NODE_ENV === "development";

/**
 * Office-oriented shell + context strip (server truth from workspace read).
 */
export function QuoteWorkspaceShellSummary({ quoteId, shell, head, variant = "full" }: Props) {
  const quickJumpLinks = [
    ...(head
      ? [
          {
            label: `v${head.versionNumber} Scope`,
            href: `/dev/quote-scope/${head.id}`,
          },
        ]
      : []),
    { label: "All quotes", href: "/dev/quotes" },
    { label: "Customers", href: "/dev/customers" },
    { label: "Flow groups", href: "/dev/flow-groups" },
    ...(shell.flowGroup.jobId
      ? [
          {
            label: "Job anchor",
            href: `/dev/jobs/${shell.flowGroup.jobId}`,
            variant: "emerald" as const,
          },
        ]
      : []),
  ];

  if (variant === "compact") {
    return (
      <section
        aria-label="Quote context"
        className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800/90 bg-zinc-900/40 px-3 py-2.5"
      >
        <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-base font-semibold tracking-tight text-zinc-100">{shell.quote.quoteNumber}</span>
          <span className="text-xs text-zinc-500">·</span>
          <span className="truncate text-xs text-zinc-400">{shell.customer.name}</span>
          <span className="text-xs text-zinc-600">·</span>
          <span className="truncate text-xs text-zinc-500">{shell.flowGroup.name}</span>
        </div>
        {head ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-400">v{head.versionNumber}</span>
            <QuoteWorkspaceVersionStatusBadge status={head.status} />
          </div>
        ) : null}
        <details className="basis-full text-[10px] text-zinc-600 sm:basis-auto sm:ml-auto">
          <summary className="cursor-pointer font-medium text-zinc-500 hover:text-zinc-400">Advanced (support)</summary>
          <div className="mt-2 space-y-2 rounded border border-zinc-800/80 bg-zinc-950/90 p-2">
            <p>
              Quote ID: <span className="font-mono text-zinc-400">{shell.quote.id}</span>
            </p>
            {head ? (
              <p>
                Version ID: <span className="font-mono text-zinc-400">{head.id}</span>
              </p>
            ) : null}
            {shell.flowGroup.jobId ? (
              <p>
                Job ID: <span className="font-mono text-zinc-400">{shell.flowGroup.jobId}</span>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <Link
                href={`/api/customers/${shell.customer.id}`}
                className="underline decoration-zinc-800 hover:text-zinc-400"
                prefetch={false}
              >
                Customer API
              </Link>
              <Link
                href={`/api/flow-groups/${shell.flowGroup.id}`}
                className="underline decoration-zinc-800 hover:text-zinc-400"
                prefetch={false}
              >
                Flow group API
              </Link>
            </div>
            {isDevQuickJumpEnabled && quickJumpLinks.length > 0 ? (
              <div className="border-t border-zinc-800/60 pt-2">
                <InternalQuickJump title="Dev quick links" links={quickJumpLinks} />
              </div>
            ) : null}
          </div>
        </details>
        {shell.quote.id !== quoteId ? (
          <p className="basis-full text-[11px] text-amber-700/90">
            Route quote id <span className="font-mono">{quoteId}</span> does not match loaded shell id.
          </p>
        ) : null}
      </section>
    );
  }

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
        {head ? (
          <div className="rounded-md border border-zinc-800/80 bg-zinc-950/80 px-3 py-2 text-right sm:text-left">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Current version</p>
            <div className="mt-1 flex flex-wrap items-center justify-end gap-2 sm:justify-start">
              <span className="text-sm font-medium text-zinc-200">v{head.versionNumber}</span>
              <QuoteWorkspaceVersionStatusBadge status={head.status} />
            </div>
          </div>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-4 border-t border-zinc-800/80 pt-5 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Customer</dt>
          <dd className="mt-1 text-sm text-zinc-200">{shell.customer.name}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Flow group
          </dt>
          <dd className="mt-1 text-sm text-zinc-200">{shell.flowGroup.name}</dd>
        </div>
      </dl>

      <div className="mt-6 border-t border-zinc-800/10 pt-3">
        <details className="text-[10px] text-zinc-600">
          <summary className="cursor-pointer font-medium hover:text-zinc-500">Advanced (support)</summary>
          <div className="mt-2 space-y-1.5">
            <p>
              Quote ID: <span className="font-mono">{shell.quote.id}</span>
            </p>
            {head ? (
              <p>
                Version ID: <span className="font-mono">{head.id}</span>
              </p>
            ) : null}
            {shell.flowGroup.jobId && (
              <p>
                Job ID: <span className="font-mono">{shell.flowGroup.jobId}</span>
              </p>
            )}
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
                Flow group API
              </Link>
            </div>
            {isDevQuickJumpEnabled && quickJumpLinks.length > 0 ? (
              <div className="mt-3 border-t border-zinc-800/40 pt-2">
                <InternalQuickJump title="Dev quick links" links={quickJumpLinks} />
              </div>
            ) : null}
          </div>
        </details>
      </div>

      {shell.quote.id !== quoteId ? (
        <p className="mt-4 text-xs text-amber-700/90">
          Route quote id <span className="font-mono">{quoteId}</span> does not match loaded shell id — verify tenant
          data.
        </p>
      ) : null}
    </section>
  );
}
