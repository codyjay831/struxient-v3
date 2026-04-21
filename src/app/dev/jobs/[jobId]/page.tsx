import Link from "next/link";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { InternalNotFoundState, InternalSparseState } from "@/components/internal/internal-state-feedback";
import { InternalQuickJump } from "@/components/internal/internal-quick-jump";
import { getPrisma } from "@/server/db/prisma";
import { getJobShellReadModel } from "@/server/slice1/reads/job-shell";
import { toJobShellApiDto, type JobShellFlowApiDto } from "@/lib/job-shell-dto";
import { tryGetApiPrincipal, type ApiPrincipal } from "@/lib/auth/api-principal";
import { InvariantViolationError } from "@/server/slice1/errors";
import {
  buildJobShellQuickJumpLinks,
  deriveJobHeaderContext,
  formatJobTimestamp,
  presentAuthFailure,
  presentJobShellLoadError,
  summarizeFlowRuntimeTasks,
  type FlowRuntimeSummary,
  type JobShellLoadErrorInput,
} from "./job-shell-page-state";

type PageProps = { params: Promise<{ jobId: string }> };

export const dynamic = "force-dynamic";

/**
 * Internal dev surface for inspecting the job-anchor (created at SIGN) and
 * its associated execution flows. Page-level responsibilities:
 *
 *   1. Resolve the auth principal; render a structured failure panel
 *      (kind-aware) if that fails.
 *   2. Load the job-shell read model inside a try/catch and classify any
 *      error into `JobShellLoadErrorInput` so DB outages, missing env vars,
 *      and invariant violations all land in `JobLoadErrorScreen` rather than
 *      Next's generic 500 boundary.
 *   3. Derive header context, quick-jump links, and per-flow execution
 *      rollups via pure helpers in `./job-shell-page-state.ts` (covered by
 *      unit tests).
 *
 * Auth/tenant gates remain enforced server-side. The `AuthChip` surfaces the
 * already-resolved `principal.authSource` so operators can see whether they
 * are on a real session or the documented dev bypass — it does not weaken
 * the gate.
 */
export default async function DevJobDetailPage({ params }: PageProps) {
  const { jobId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    return <AuthFailureScreen failure={auth.failure} />;
  }

  let model: Awaited<ReturnType<typeof getJobShellReadModel>>;
  try {
    model = await getJobShellReadModel(getPrisma(), {
      tenantId: auth.principal.tenantId,
      jobId,
    });
  } catch (e) {
    return <JobLoadErrorScreen error={classifyJobLoadError(e)} />;
  }

  if (!model) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 text-zinc-200 sm:px-6 lg:px-8">
        <header className="mb-6 border-b border-zinc-800 pb-5">
          <InternalBreadcrumb
            category="Execution"
            segments={[{ label: "Jobs", href: "/dev/jobs" }, { label: "Job not found" }]}
          />
        </header>
        <InternalNotFoundState
          title="Job not found"
          message="This job ID is not visible to your tenant. It may belong to another tenant or no longer exist."
          backLink={{ href: "/dev/jobs", label: "← All jobs" }}
        />
      </main>
    );
  }

  const dto = toJobShellApiDto(model);
  const headerCtx = deriveJobHeaderContext(dto);

  // Newest flow drives the contextual quick-jump entries (work feed + quote
  // workspace). DTO already orders flows by createdAt asc; pick the last.
  const newestFlow = dto.flows.length > 0 ? dto.flows[dto.flows.length - 1] : null;

  const quickJumpLinks = buildJobShellQuickJumpLinks({
    jobId: dto.job.id,
    newestFlow: newestFlow ? { id: newestFlow.id, quoteId: newestFlow.quoteId } : null,
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-zinc-200 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <InternalBreadcrumb
          category="Execution"
          segments={[{ label: "Jobs", href: "/dev/jobs" }, { label: "Job detail" }]}
        />
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-100">Job detail</h1>
              <AuthChip principal={auth.principal} />
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  headerCtx.hasActivatedFlow
                    ? "border-emerald-800/80 bg-emerald-950/50 text-emerald-300"
                    : "border-amber-800/80 bg-amber-950/50 text-amber-300"
                }`}
                title={
                  headerCtx.hasActivatedFlow
                    ? "At least one flow on this job has been activated."
                    : "Job is anchored at SIGN but no flow has been activated yet."
                }
              >
                {headerCtx.hasActivatedFlow ? "Activated" : "Signed (not activated)"}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              {headerCtx.customerName} · {headerCtx.flowGroupName} · {headerCtx.flowCount}{" "}
              flow{headerCtx.flowCount === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Job anchor created on SIGN. Flows are added on activation. Tenant gate enforced
              server-side.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <InternalQuickJump title="Continue testing" links={quickJumpLinks} />
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Execution flows ({dto.flows.length})
        </h2>
        {dto.flows.length === 0 ? (
          <InternalSparseState
            message="No flows activated for this job yet"
            hint="Jobs are anchored at SIGNED status, but flows are only created upon activation. Activate the signed quote version from its workspace to create the first flow."
            action={{ href: "/dev/quotes", label: "Open quote list" }}
          />
        ) : (
          <ul className="space-y-3 text-sm">
            {dto.flows.map((f) => (
              <FlowCard key={f.id} flow={f} />
            ))}
          </ul>
        )}
      </section>

      <details className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-4">
        <summary className="cursor-pointer text-xs font-medium text-zinc-400 hover:text-zinc-300">
          Technical details
        </summary>
        <dl className="mt-3 space-y-1 text-[11px] text-zinc-500">
          <div>
            Job ID: <code className="text-zinc-400">{dto.job.id}</code>
          </div>
          <div>
            Flow group ID: <code className="text-zinc-400">{dto.job.flowGroupId}</code>
          </div>
          <div>
            Customer ID: <code className="text-zinc-400">{headerCtx.customerId}</code>
          </div>
          <div>
            Created: <code className="text-zinc-400">{formatJobTimestamp(dto.job.createdAt)}</code>
          </div>
          <div>
            <Link
              href={`/api/jobs/${dto.job.id}`}
              className="text-sky-400 hover:text-sky-300"
            >
              GET /api/jobs/{dto.job.id} (raw JSON)
            </Link>
          </div>
        </dl>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Raw response
        </p>
        <pre className="mt-2 overflow-x-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-400">
          {JSON.stringify(dto, null, 2)}
        </pre>
      </details>
    </main>
  );
}

/* ---------------- Per-flow card (server-rendered) ---------------- */

function FlowCard({ flow }: { flow: JobShellFlowApiDto }) {
  const summary = summarizeFlowRuntimeTasks(flow);
  const badge = renderHealthBadge(summary, flow.activation !== null);

  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-zinc-100">
            Quote {flow.quoteNumber}{" "}
            <span className="text-[10px] text-zinc-500 font-normal">
              · flow {flow.id.slice(0, 8)}…
            </span>
          </p>
          <p className="text-[11px] text-zinc-500">
            workflow v{flow.workflowVersionId.slice(0, 8)}… · created{" "}
            {formatJobTimestamp(flow.createdAt)}
          </p>
        </div>
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.toneCls}`}
          title={badge.tooltip}
        >
          {badge.label}
        </span>
      </div>

      <FlowRuntimeRollup summary={summary} />

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Link
          href={`/dev/work-feed/${flow.id}`}
          className="rounded bg-sky-700 px-2.5 py-1 text-white hover:bg-sky-600"
        >
          Open work feed
        </Link>
        <Link
          href={`/dev/flow/${flow.id}`}
          className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-200 hover:bg-zinc-800"
        >
          Flow detail
        </Link>
        <Link
          href={`/dev/quotes/${flow.quoteId}`}
          className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-200 hover:bg-zinc-800"
        >
          Quote workspace
        </Link>
        <Link
          href={`/dev/quote-scope/${flow.quoteVersionId}`}
          className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-200 hover:bg-zinc-800"
          title="Inspect the scope of the quote version this flow was activated from."
        >
          Quote scope (v)
        </Link>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300">
          IDs
        </summary>
        <dl className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-zinc-500">
          <div>
            Flow ID: <code className="text-zinc-400">{flow.id}</code>
          </div>
          <div>
            Quote ID: <code className="text-zinc-400">{flow.quoteId}</code>
          </div>
          <div>
            Quote version ID: <code className="text-zinc-400">{flow.quoteVersionId}</code>
          </div>
          <div>
            Workflow version ID: <code className="text-zinc-400">{flow.workflowVersionId}</code>
          </div>
          {flow.activation ? (
            <div>
              Activation ID: <code className="text-zinc-400">{flow.activation.id}</code> ·
              activated {formatJobTimestamp(flow.activation.activatedAt)}
            </div>
          ) : null}
        </dl>
      </details>
    </li>
  );
}

function FlowRuntimeRollup({ summary }: { summary: FlowRuntimeSummary }) {
  if (summary.total === 0) {
    return (
      <p className="mt-3 text-[11px] italic text-amber-300">
        Flow has no runtime tasks. This is unusual once activated; check the flow detail.
      </p>
    );
  }

  const cells = [
    { label: "Accepted", value: summary.accepted, tone: "text-emerald-300" },
    { label: "Awaiting review", value: summary.awaitingReview, tone: "text-sky-300" },
    { label: "In progress", value: summary.inProgress, tone: "text-sky-300" },
    {
      label: "Correction",
      value: summary.correctionRequired,
      tone: summary.correctionRequired > 0 ? "text-red-300" : "text-zinc-400",
    },
    { label: "Not started", value: summary.notStarted, tone: "text-zinc-400" },
  ];

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-5 gap-2 rounded border border-zinc-800/70 bg-zinc-950/30 px-2 py-2 text-center text-[10px]">
        {cells.map((c) => (
          <div key={c.label}>
            <p className={`font-mono text-sm font-semibold ${c.tone}`}>{c.value}</p>
            <p className="mt-0.5 uppercase tracking-wide text-zinc-500">{c.label}</p>
          </div>
        ))}
      </div>
      {summary.blockingStartReasons.length > 0 ? (
        <p className="text-[11px] text-amber-300">
          Start blocked by:{" "}
          {summary.blockingStartReasons.map((r, i) => (
            <span key={r}>
              {i > 0 ? ", " : ""}
              <code className="text-amber-200">{r}</code>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

function renderHealthBadge(
  summary: FlowRuntimeSummary,
  hasActivation: boolean,
): { label: string; toneCls: string; tooltip: string } {
  switch (summary.health) {
    case "all_accepted":
      return {
        label: "All accepted",
        toneCls: "border-emerald-800/80 bg-emerald-950/50 text-emerald-300",
        tooltip: `All ${summary.total} runtime tasks have been reviewed and accepted.`,
      };
    case "in_progress":
      return {
        label: "In progress",
        toneCls: "border-sky-800/80 bg-sky-950/50 text-sky-300",
        tooltip: `${summary.accepted} accepted · ${summary.awaitingReview} awaiting review · ${summary.inProgress} in progress · ${summary.notStarted} not started`,
      };
    case "blocked":
      return {
        label: "Blocked",
        toneCls: "border-amber-800/80 bg-amber-950/50 text-amber-300",
        tooltip: `Start blocked by: ${summary.blockingStartReasons.join(", ")}`,
      };
    case "ready":
      return {
        label: "Ready to start",
        toneCls: "border-sky-800/80 bg-sky-950/50 text-sky-300",
        tooltip: `Activated. ${summary.notStarted} task${summary.notStarted === 1 ? "" : "s"} ready to be started.`,
      };
    case "not_activated":
      return {
        label: "Not activated",
        toneCls: "border-amber-800/80 bg-amber-950/50 text-amber-300",
        tooltip: "Flow row exists but has no Activation. Activate from the quote workspace.",
      };
    case "empty":
      return {
        label: hasActivation ? "Empty (anomaly)" : "Empty",
        toneCls: "border-zinc-700 bg-zinc-900/60 text-zinc-300",
        tooltip: "Flow has zero runtime tasks. This is unusual once activated.",
      };
  }
}

/* ---------------- Inline screens (server-rendered) ---------------- */

function AuthChip({ principal }: { principal: ApiPrincipal }) {
  const isSession = principal.authSource === "session";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        isSession
          ? "border border-emerald-700/60 bg-emerald-900/30 text-emerald-200"
          : "border border-amber-700/60 bg-amber-900/30 text-amber-200"
      }`}
      title={
        isSession
          ? "Authenticated via real NextAuth session."
          : "Authenticated via STRUXIENT_DEV_AUTH_BYPASS — non-production only."
      }
    >
      auth: {principal.authSource} · role: {principal.role.toLowerCase()}
    </span>
  );
}

function AuthFailureScreen({
  failure,
}: {
  failure: Parameters<typeof presentAuthFailure>[0];
}) {
  const p = presentAuthFailure(failure);
  const toneCls =
    p.tone === "amber"
      ? "border-amber-900/60 bg-amber-950/20 text-amber-200"
      : "border-red-900/60 bg-red-950/20 text-red-200";
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-8 text-zinc-200">
      <header className="border-b border-zinc-800 pb-4">
        <InternalBreadcrumb
          category="Execution"
          segments={[{ label: "Jobs", href: "/dev/jobs" }, { label: "Auth required" }]}
        />
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Job detail</h1>
      </header>
      <section className={`rounded-lg border p-5 shadow-sm ${toneCls}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">
          Auth failure · {p.failureKind}
        </p>
        <p className="mt-1 text-sm font-semibold">{p.title}</p>
        <p className="mt-1 text-xs leading-relaxed opacity-90">{p.message}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-relaxed opacity-90">
          {p.remediation.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>
      <div className="flex flex-wrap gap-3 text-xs">
        <Link
          href="/dev/login"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/dev/jobs"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          ← All jobs
        </Link>
        <Link
          href="/"
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          Hub
        </Link>
      </div>
    </main>
  );
}

function JobLoadErrorScreen({ error }: { error: JobShellLoadErrorInput }) {
  const p = presentJobShellLoadError(error);
  const toneCls =
    p.tone === "amber"
      ? "border-amber-900/60 bg-amber-950/20 text-amber-200"
      : "border-red-900/60 bg-red-950/20 text-red-200";
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-8 text-zinc-200">
      <header className="border-b border-zinc-800 pb-4">
        <InternalBreadcrumb
          category="Execution"
          segments={[{ label: "Jobs", href: "/dev/jobs" }, { label: "Load error" }]}
        />
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Job detail</h1>
      </header>
      <section className={`rounded-lg border p-5 shadow-sm ${toneCls}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">
          Load failure · {p.errorKind}
          {p.code ? ` · ${p.code}` : ""}
        </p>
        <p className="mt-1 text-sm font-semibold">{p.title}</p>
        <p className="mt-1 text-xs leading-relaxed opacity-90">{p.message}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-relaxed opacity-90">
          {p.remediation.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        {p.context !== undefined ? (
          <pre className="mt-3 overflow-auto rounded border border-current/30 bg-black/40 p-2 font-mono text-[10px] leading-snug">
            {JSON.stringify(p.context, null, 2)}
          </pre>
        ) : null}
      </section>
      <div className="flex flex-wrap gap-3 text-xs">
        <Link
          href="/dev/jobs"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          ← All jobs
        </Link>
        <Link
          href="/"
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          Hub
        </Link>
      </div>
    </main>
  );
}

/**
 * Page-side error → helper-input adapter. Mirrors the catch ladder used by
 * `/dev/quotes/[quoteId]` and `/dev/quote-scope/[quoteVersionId]` so behavior
 * is consistent across adjacent commercial/execution surfaces. Pure-helper
 * presentation lives in `./job-shell-page-state.ts` (re-exported from the
 * workspace helper).
 */
function classifyJobLoadError(e: unknown): JobShellLoadErrorInput {
  if (e instanceof PrismaClientInitializationError) {
    return { kind: "prisma_init", message: e.message };
  }
  if (e instanceof Error && e.message.startsWith("[Struxient] DATABASE_URL")) {
    return { kind: "missing_database_url", message: e.message };
  }
  if (e instanceof InvariantViolationError) {
    return e.context !== undefined
      ? { kind: "invariant", code: e.code, message: e.message, context: e.context }
      : { kind: "invariant", code: e.code, message: e.message };
  }
  if (e instanceof Error) {
    return { kind: "unknown", message: e.message };
  }
  return { kind: "unknown", message: "Unknown failure while loading job detail." };
}
