import Link from "next/link";
import type { FlowDiscoveryItemDto } from "@/server/slice1/reads/flow-discovery-reads";
import { InternalBreadcrumb } from "./internal-breadcrumb";

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").replace(/\..+$/, " UTC");
}

type Props = {
  /** Page-level identifier copy, e.g. "Flow detail" or "Execution work feed". */
  surfaceLabel: string;
  /** Short purpose paragraph displayed under the title. */
  purpose: string;
  /** Active page route — used to dim the matching link in the related-records strip. */
  activeRoute: "flow-detail" | "work-feed";
  /** The discovery row for this flow. Optional — when null the page is sparse. */
  context: FlowDiscoveryItemDto | null;
  /** Required for sibling links when context is unavailable. */
  flowId: string;
};

/**
 * Identity + commercial context header shared by /dev/flow/[flowId] and /dev/work-feed/[flowId].
 *
 * Surfaces the same fields the discovery list shows so a tester always knows which record they are
 * looking at. Falls back to a sparse-state notice when no commercial context can be resolved.
 */
import { InternalQuickJump } from "./internal-quick-jump";
// ... (rest of imports)

export function FlowExecutionPageHeader({
  surfaceLabel,
  purpose,
  activeRoute,
  context,
  flowId,
}: Props) {
  const quoteWorkspaceHref = context ? `/dev/quotes/${context.quote.id}` : null;
  const flowDetailHref = `/dev/flow/${flowId}`;
  const workFeedHref = `/dev/work-feed/${flowId}`;

  const breadcrumbSegments = [
    { label: "Flows", href: "/dev/flows" },
    ...(context ? [{ label: context.quote.quoteNumber, href: flowDetailHref }] : []),
    { label: surfaceLabel },
  ];

  const quickJumpLinks = [
    {
      label: "Flow detail",
      href: flowDetailHref,
      isActive: activeRoute === "flow-detail",
    },
    {
      label: "Work feed",
      href: workFeedHref,
      isActive: activeRoute === "work-feed",
    },
    ...(quoteWorkspaceHref
      ? [{ label: "Quote workspace", href: quoteWorkspaceHref, variant: "sky" as const }]
      : []),
    { label: "Back to Flows", href: "/dev/flows" },
    ...(context
      ? [
          {
            label: "Job detail",
            href: `/dev/jobs/${context.flow.jobId}`,
            variant: "emerald" as const,
          },
        ]
      : []),
  ];

  return (
    <header className="mb-6 border-b border-zinc-800 pb-5">
      <div className="flex flex-wrap items-start justify-between gap-3 text-sky-400">
        <div>
          <InternalBreadcrumb category="Execution" segments={breadcrumbSegments} />
          {context ? (
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">
              {context.quote.quoteNumber}{" "}
              <span className="text-sm font-normal text-zinc-500">
                · v{context.quoteVersion.versionNumber} · {context.quoteVersion.status}
              </span>
            </h1>
          ) : (
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">
              Flow {flowId.slice(0, 10)}…
            </h1>
          )}
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">{purpose}</p>
        </div>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-400">
          ← Hub
        </Link>
      </div>

      {context ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-4 border-t border-zinc-800/40 pt-4">
          <div>
            <dt className="uppercase tracking-tight text-zinc-600">Customer</dt>
            <dd className="text-zinc-300">{context.customer.name}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-tight text-zinc-600">Flow group</dt>
            <dd className="text-zinc-300">{context.flowGroup.name}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-tight text-zinc-600">Activated</dt>
            <dd className="text-zinc-300">
              {context.activation
                ? formatTimestamp(context.activation.activatedAt)
                : formatTimestamp(context.flow.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-tight text-zinc-600">Workflow</dt>
            <dd className="text-zinc-300">v{context.workflowVersion.versionNumber}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 rounded border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
          Commercial context could not be resolved for this flow. The execution view below still loads
          from tenant data; if it&apos;s also empty, the flow id may belong to a different tenant or
          no longer exist.
        </p>
      )}

      <div className="mt-5">
        <InternalQuickJump title="Continue testing" links={quickJumpLinks} />
      </div>
    </header>
  );
}
