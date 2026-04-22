import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { getJobShellReadModel } from "@/server/slice1/reads/job-shell";
import { toJobShellApiDto, type JobShellFlowApiDto } from "@/lib/job-shell-dto";
import {
  deriveJobHeaderContext,
  formatJobTimestamp,
  summarizeFlowRuntimeTasks,
  type FlowRuntimeSummary,
} from "@/lib/jobs/job-shell-summary";
import type { TaskStartBlockReason } from "@/server/slice1/eligibility/task-actionability";
import { getJobHandoffForTenant } from "@/server/slice1/reads/job-handoff-reads";
import { toJobHandoffApiDto } from "@/lib/job-handoff-dto";
import { JobHandoffPanel } from "@/components/jobs/job-handoff-panel";

/**
 * Office-surface job-anchor inspector.
 *
 * Reuses the canon job-shell pipeline:
 *   - `getJobShellReadModel`        → tenant-gated, single-query fetch
 *   - `toJobShellApiDto`            → canon serialization (incl. actionability)
 *   - `summarizeFlowRuntimeTasks`   → per-flow rollup (status counts + health
 *                                     + blocking-start reasons)
 *   - `deriveJobHeaderContext`      → header identity projection
 *
 * Server-rendered shell; field handoff edits go through `JobHandoffPanel` →
 * `/api/jobs/.../handoff*`. The work feed at `/flows/[flowId]` is the
 * canonical place to act on individual runtime tasks.
 *
 * Diagnostics intentionally omitted: raw IDs, workflow version numbers,
 * Prisma error panels, and `GET /api/jobs/...` deep-links stay on
 * `/dev/jobs/[jobId]`. Auth failures redirect to the canonical sign-in
 * surface; missing/foreign jobs surface as 404 — operators should never see
 * verbose `ResolvePrincipalFailure` panels.
 */
export const dynamic = "force-dynamic";

type OfficeJobDetailPageProps = {
  params: Promise<{ jobId: string }>;
};

const HEALTH_BADGE: Record<
  FlowRuntimeSummary["health"],
  { label: string; style: string }
> = {
  not_activated: {
    label: "Not Activated",
    style: "text-amber-400 bg-amber-950/30 border-amber-800/50",
  },
  ready: {
    label: "Ready",
    style: "text-sky-400 bg-sky-950/30 border-sky-800/50",
  },
  in_progress: {
    label: "In Progress",
    style: "text-violet-400 bg-violet-950/30 border-violet-800/50",
  },
  blocked: {
    label: "Blocked",
    style: "text-rose-400 bg-rose-950/30 border-rose-800/50",
  },
  all_accepted: {
    label: "All Accepted",
    style: "text-emerald-400 bg-emerald-950/30 border-emerald-800/50",
  },
  empty: {
    label: "No Tasks",
    style: "text-zinc-400 bg-zinc-900/40 border-zinc-700/50",
  },
};

const BLOCK_REASON_LABEL: Record<TaskStartBlockReason, string> = {
  FLOW_NOT_ACTIVATED: "Flow not activated",
  PAYMENT_GATE_UNSATISFIED: "Payment gate unsatisfied",
  HOLD_ACTIVE: "Operational hold active",
  TASK_ALREADY_STARTED: "Task already started",
  TASK_ALREADY_COMPLETED: "Task already completed",
  TASK_ALREADY_ACCEPTED: "Task already accepted",
};

function blockReasonLabel(reason: TaskStartBlockReason): string {
  return BLOCK_REASON_LABEL[reason] ?? reason;
}

export default async function OfficeJobDetailPage({ params }: OfficeJobDetailPageProps) {
  const { jobId } = await params;

  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const readModel = await getJobShellReadModel(getPrisma(), {
    tenantId: auth.principal.tenantId,
    jobId,
  });

  if (!readModel) {
    notFound();
  }

  const dto = toJobShellApiDto(readModel);
  const header = deriveJobHeaderContext(dto);

  const handoffRow = await getJobHandoffForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    jobId,
  });
  const handoffInitial = handoffRow ? toJobHandoffApiDto(handoffRow) : null;

  const flowsWithSummary = dto.flows.map((flow) => ({
    flow,
    summary: summarizeFlowRuntimeTasks(flow),
  }));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-2">
        <Link
          href="/jobs"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← All jobs
        </Link>
      </div>

      <div className="mb-8 pb-6 border-b border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-zinc-50 truncate">
              {header.customerName}
            </h1>
            <p className="text-sm text-zinc-400 mt-1">{header.flowGroupName}</p>
            <p className="text-[11px] text-zinc-600 mt-2">
              Job opened {formatJobTimestamp(dto.job.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold uppercase border ${
                header.hasActivatedFlow
                  ? "text-emerald-400 bg-emerald-950/30 border-emerald-800/50"
                  : "text-sky-400 bg-sky-950/30 border-sky-800/50"
              }`}
            >
              {header.hasActivatedFlow ? "Activated" : "Signed"}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold uppercase border text-zinc-300 bg-zinc-900/40 border-zinc-700/50">
              {header.flowCount} {header.flowCount === 1 ? "Flow" : "Flows"}
            </span>
          </div>
        </div>
      </div>

      <JobHandoffPanel
        jobId={jobId}
        initial={handoffInitial}
        hasActivation={header.hasActivatedFlow}
        canOfficeMutate={principalHasCapability(auth.principal, "office_mutate")}
        canFieldExecute={principalHasCapability(auth.principal, "field_execute")}
      />

      {flowsWithSummary.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-10 text-center">
          <h2 className="text-zinc-200 font-medium">No execution flows yet</h2>
          <p className="text-zinc-500 text-sm mt-1 max-w-md mx-auto">
            Activate a signed quote version to create the first flow on this job.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {flowsWithSummary.map(({ flow, summary }) => (
            <FlowCard key={flow.id} flow={flow} summary={summary} />
          ))}
        </div>
      )}
    </div>
  );
}

function FlowCard({
  flow,
  summary,
}: {
  flow: JobShellFlowApiDto;
  summary: FlowRuntimeSummary;
}) {
  const badge = HEALTH_BADGE[summary.health];

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
      <header className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/40 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="text-base font-semibold text-zinc-50">{flow.quoteNumber}</h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badge.style}`}
            >
              {badge.label}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            {flow.activation
              ? `Activated ${formatJobTimestamp(flow.activation.activatedAt)}`
              : "Not yet activated"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/quotes/${flow.quoteId}`}
            className="inline-flex items-center px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-50 rounded text-xs font-medium transition-all"
          >
            Quote workspace
          </Link>
          {flow.activation ? (
            <Link
              href={`/flows/${flow.id}`}
              className="inline-flex items-center px-3 py-1.5 bg-sky-700 hover:bg-sky-600 text-white rounded text-xs font-medium transition-colors"
            >
              Work feed
            </Link>
          ) : null}
        </div>
      </header>

      <div className="px-6 py-5">
        <RuntimeCountsGrid summary={summary} />

        {summary.blockingStartReasons.length > 0 ? (
          <div className="mt-5 rounded-lg border border-rose-900/50 bg-rose-950/20 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
              Blocking start reasons
            </p>
            <ul className="mt-2 space-y-1">
              {summary.blockingStartReasons.map((reason) => (
                <li key={reason} className="text-sm text-rose-200">
                  • {blockReasonLabel(reason)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RuntimeCountsGrid({ summary }: { summary: FlowRuntimeSummary }) {
  const cells: { label: string; value: number; tone: string }[] = [
    { label: "Total", value: summary.total, tone: "text-zinc-200" },
    { label: "Accepted", value: summary.accepted, tone: "text-emerald-300" },
    {
      label: "Awaiting Review",
      value: summary.awaitingReview,
      tone: "text-amber-300",
    },
    {
      label: "In Progress",
      value: summary.inProgress,
      tone: "text-violet-300",
    },
    {
      label: "Correction Required",
      value: summary.correctionRequired,
      tone: "text-rose-300",
    },
    { label: "Not Started", value: summary.notStarted, tone: "text-zinc-400" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2.5"
        >
          <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {cell.label}
          </dt>
          <dd className={`mt-1 text-xl font-mono font-semibold ${cell.tone}`}>
            {cell.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
