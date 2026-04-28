import Link from "next/link";
import type { QuoteVersionHistoryItemDto } from "@/server/slice1/reads/quote-version-history-reads";
import type { QuoteVersionStatus } from "@prisma/client";
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

function customerDisplayName(name: string | undefined | null): string | null {
  const t = name?.trim();
  return t && t.length > 0 ? t : null;
}

/** Human-readable lifecycle line (no new data; uses existing head status + activation). */
function humanStatusPhrase(status: QuoteVersionStatus, hasActivation: boolean): string {
  switch (status) {
    case "DRAFT":
      return "Draft quote";
    case "SENT":
      return "Sent quote";
    case "SIGNED":
      return hasActivation ? "Work in progress" : "Signed · ready to start work";
    case "DECLINED":
      return "Customer declined";
    case "VOID":
      return "Withdrawn";
    case "SUPERSEDED":
      return "Superseded";
    default:
      return "Quote";
  }
}

function buildQuickJumpLinks(shell: WorkspaceShell, head: QuoteVersionHistoryItemDto | null) {
  return [
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
}

function MoreInfoBlock({
  quoteId,
  shell,
  head,
  quickJumpLinks,
}: {
  quoteId: string;
  shell: WorkspaceShell;
  head: QuoteVersionHistoryItemDto | null;
  quickJumpLinks: ReturnType<typeof buildQuickJumpLinks>;
}) {
  return (
    <details className="mt-4 border-t border-zinc-800/70 pt-3 text-xs text-zinc-500">
      <summary className="cursor-pointer font-medium text-zinc-500 hover:text-zinc-400">More info</summary>
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap justify-between gap-2">
          <span>Quote number</span>
          <span className="font-mono text-zinc-400">{shell.quote.quoteNumber}</span>
        </div>
        {head ?
          <div className="flex flex-wrap justify-between gap-2">
            <span>Version</span>
            <span className="tabular-nums text-zinc-400">
              v{head.versionNumber} · <span className="font-mono text-zinc-500">{head.id}</span>
            </span>
          </div>
        : null}
        <div className="flex flex-wrap justify-between gap-2">
          <span>Quote ID</span>
          <span className="max-w-[min(20rem,55%)] truncate font-mono text-zinc-400">{shell.quote.id}</span>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <span>Customer ID</span>
          <span className="max-w-[min(20rem,55%)] truncate font-mono text-zinc-400">{shell.customer.id}</span>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <span>Flow group</span>
          <span className="max-w-[min(20rem,55%)] truncate text-right text-zinc-400">{shell.flowGroup.name}</span>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <span>Flow group ID</span>
          <span className="max-w-[min(20rem,55%)] truncate font-mono text-zinc-400">{shell.flowGroup.id}</span>
        </div>
        {shell.flowGroup.jobId ?
          <div className="flex flex-wrap justify-between gap-2">
            <span>Job ID</span>
            <span className="max-w-[min(20rem,55%)] truncate font-mono text-zinc-400">{shell.flowGroup.jobId}</span>
          </div>
        : null}
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-zinc-800/60 pt-2">
          <Link
            href={`/api/customers/${shell.customer.id}`}
            className="text-sky-500/80 hover:text-sky-400 hover:underline"
            prefetch={false}
          >
            Customer API
          </Link>
          <Link
            href={`/api/flow-groups/${shell.flowGroup.id}`}
            className="text-sky-500/80 hover:text-sky-400 hover:underline"
            prefetch={false}
          >
            Flow group API
          </Link>
        </div>
        {isDevQuickJumpEnabled && quickJumpLinks.length > 0 ?
          <div className="border-t border-zinc-800/60 pt-2">
            <InternalQuickJump title="Dev quick links" links={quickJumpLinks} />
          </div>
        : null}
      </div>
      {shell.quote.id !== quoteId ?
        <p className="mt-3 text-xs text-amber-700/90">
          Route quote id <span className="font-mono">{quoteId}</span> does not match loaded shell id.
        </p>
      : null}
    </details>
  );
}

/**
 * Office-oriented shell + context strip (server truth from workspace read).
 */
export function QuoteWorkspaceShellSummary({ quoteId, shell, head, variant = "full" }: Props) {
  const quickJumpLinks = buildQuickJumpLinks(shell, head);
  const customerName = customerDisplayName(shell.customer.name);
  const h1Text = customerName ?? `Quote ${shell.quote.quoteNumber}`;
  const breadcrumbTail = customerName ?? shell.quote.quoteNumber;
  const flowLabel = shell.flowGroup.name?.trim();
  const secondaryLine =
    flowLabel && flowLabel.length > 0 ? flowLabel : "No job address yet";
  const workTitle = head?.title?.trim();

  if (variant === "compact") {
    const statusLine =
      head ?
        `${humanStatusPhrase(head.status, head.hasActivation)} · v${head.versionNumber}`
      : "No version on file yet";

    return (
      <section aria-label="Quote context" className="mb-6 border-b border-zinc-800/90 pb-5">
        <nav className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
          <Link href="/quotes" className="hover:text-zinc-300 transition-colors">
            Quotes
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="truncate text-zinc-400">{breadcrumbTail}</span>
        </nav>
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">{h1Text}</h1>
          <p className="text-sm text-zinc-300">{secondaryLine}</p>
          {workTitle && workTitle.length > 0 ?
            <p className="text-sm leading-snug text-zinc-400">{workTitle}</p>
          : (
            <p className="text-xs text-zinc-600">Work scope not added yet</p>
          )}
          <p className="text-sm text-zinc-500">{statusLine}</p>
        </div>
        <MoreInfoBlock quoteId={quoteId} shell={shell} head={head} quickJumpLinks={quickJumpLinks} />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="workspace-shell-heading"
      className="mb-8 rounded-md border border-zinc-800 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 p-5 shadow-sm shadow-black/20"
    >
      <p id="workspace-shell-heading" className="sr-only">
        Quote context
      </p>
      <div className="min-w-0 space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">{h1Text}</h2>
        <p className="text-sm text-zinc-300">{secondaryLine}</p>
        {workTitle && workTitle.length > 0 ?
          <p className="text-sm leading-snug text-zinc-400">{workTitle}</p>
        : (
          <p className="text-xs text-zinc-600">Work scope not added yet</p>
        )}
        {head ?
          <p className="text-sm text-zinc-500">
            {humanStatusPhrase(head.status, head.hasActivation)} · v{head.versionNumber}
          </p>
        : (
          <p className="pt-1 text-sm text-zinc-500">No version on file yet.</p>
        )}
      </div>

      <MoreInfoBlock quoteId={quoteId} shell={shell} head={head} quickJumpLinks={quickJumpLinks} />
    </section>
  );
}
