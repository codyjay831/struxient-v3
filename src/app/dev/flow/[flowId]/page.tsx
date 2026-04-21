import Link from "next/link";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { InternalNotFoundState, InternalSparseState } from "@/components/internal/internal-state-feedback";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { getPrisma } from "@/server/db/prisma";
import { getFlowExecutionReadModel } from "@/server/slice1/reads/flow-execution";
import { getFlowDiscoveryItemForTenant } from "@/server/slice1/reads/flow-discovery-reads";
import { toFlowExecutionApiDto } from "@/lib/flow-execution-dto";
import { InvariantViolationError } from "@/server/slice1/errors";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { FlowExecutionPageHeader } from "@/components/internal/flow-execution-page-header";

type PageProps = { params: Promise<{ flowId: string }> };

export const dynamic = "force-dynamic";

function countByStatus(items: { execution: { status: string } }[]): {
  notStarted: number;
  inProgress: number;
  completed: number;
} {
  let notStarted = 0;
  let inProgress = 0;
  let completed = 0;
  for (const it of items) {
    if (it.execution.status === "in_progress") inProgress += 1;
    else if (it.execution.status === "completed") completed += 1;
    else notStarted += 1;
  }
  return { notStarted, inProgress, completed };
}

export default async function DevFlowExecutionPage({ params }: PageProps) {
  const { flowId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <p className="text-zinc-300">
          Sign in at <Link href="/dev/login" className="text-sky-400">/dev/login</Link> or enable dev auth
          bypass (see .env.example).
        </p>
        <Link href="/dev/flows" className="inline-block text-sm text-sky-400">
          ← Activated flows
        </Link>
      </main>
    );
  }

  try {
    const prisma = getPrisma();
    const [model, context] = await Promise.all([
      getFlowExecutionReadModel(prisma, { tenantId: auth.principal.tenantId, flowId }),
      getFlowDiscoveryItemForTenant(prisma, { tenantId: auth.principal.tenantId, flowId }),
    ]);

    if (!model) {
      return (
        <main className="mx-auto max-w-4xl px-4 py-8 text-zinc-200 sm:px-6 lg:px-8">
          <header className="mb-6 border-b border-zinc-800 pb-5">
            <InternalBreadcrumb
              category="Execution"
              segments={[{ label: "Flows", href: "/dev/flows" }, { label: "Flow not found" }]}
            />
          </header>
          <InternalNotFoundState
            title="Flow not found"
            message="This execution record is not visible to your tenant. It may belong to another tenant or no longer exist."
            backLink={{ href: "/dev/flows", label: "← Activated flows" }}
          />
        </main>
      );
    }

    const dto = toFlowExecutionApiDto(model);
    const skeletonCounts = countByStatus(dto.skeletonTasks);
    const runtimeCounts = countByStatus(dto.runtimeTasks);

    return (
      <main className="mx-auto max-w-3xl p-8 text-zinc-200">
        <FlowExecutionPageHeader
          surfaceLabel="Flow detail"
          purpose="Read-only view of one activated execution record. Inspect skeleton + runtime tasks below, or jump to the work feed to start/complete tasks."
          activeRoute="flow-detail"
          context={context}
          flowId={flowId}
        />

        <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Execution summary
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-tight text-zinc-600">Runtime tasks</p>
              <p className="mt-0.5 text-lg font-semibold text-zinc-100">{dto.runtimeTasks.length}</p>
              <p className="text-[11px] text-zinc-500">
                {runtimeCounts.completed} done · {runtimeCounts.inProgress} in progress ·{" "}
                {runtimeCounts.notStarted} not started
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-tight text-zinc-600">Skeleton tasks</p>
              <p className="mt-0.5 text-lg font-semibold text-zinc-100">{dto.skeletonTasks.length}</p>
              <p className="text-[11px] text-zinc-500">
                {skeletonCounts.completed} done · {skeletonCounts.inProgress} in progress ·{" "}
                {skeletonCounts.notStarted} not started
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-tight text-zinc-600">Workflow nodes</p>
              <p className="mt-0.5 text-lg font-semibold text-zinc-100">{dto.workflowNodeOrder.length}</p>
              <p className="text-[11px] text-zinc-500">from pinned snapshot</p>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-tight text-zinc-600">Activation</dt>
              <p
                className={`mt-0.5 text-sm font-medium ${
                  dto.activation ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {dto.activation ? "Activated" : "Not activated"}
              </p>
              <p className="text-[11px] text-zinc-500">
                {dto.activation ? "Flow can run" : "Start/complete will be blocked"}
              </p>
            </div>
          </div>
        </section>

        {dto.runtimeTasks.length === 0 && dto.skeletonTasks.length === 0 ? (
          <InternalSparseState
            message="No work items yet"
            hint="This usually means the workflow snapshot has no node-aligned tasks and the activated package produced no runtime rows."
            action={context ? { href: `/dev/quotes/${context.quote.id}`, label: "Open quote workspace" } : undefined}
          />
        ) : null}

        <section className="mb-6">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Runtime tasks
          </h2>
          {dto.runtimeTasks.length === 0 ? (
            <p className="rounded border border-dashed border-zinc-800 bg-zinc-950/30 p-3 text-xs text-zinc-500">
              No runtime tasks on this flow.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dto.runtimeTasks.map((t) => (
                <li
                  key={t.id}
                  className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-sky-900/30 bg-sky-950/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-400">
                          Runtime
                        </span>
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            t.execution.status === "completed"
                              ? "border-emerald-800/80 bg-emerald-950/50 text-emerald-300"
                              : t.execution.status === "in_progress"
                                ? "border-sky-800/80 bg-sky-950/50 text-sky-300"
                                : "border-zinc-700 bg-zinc-900 text-zinc-400"
                          }`}
                        >
                          {t.execution.status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </div>
                      <p className="mt-2 font-medium text-zinc-100">{t.displayTitle}</p>
                      <p className="text-[11px] text-zinc-500">node {t.nodeId}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Skeleton tasks
          </h2>
          {dto.skeletonTasks.length === 0 ? (
            <p className="rounded border border-dashed border-zinc-800 bg-zinc-950/30 p-3 text-xs text-zinc-500">
              No skeleton tasks defined on the pinned workflow snapshot.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dto.skeletonTasks.map((t) => (
                <li
                  key={`${t.nodeId}-${t.skeletonTaskId}`}
                  className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-violet-900/30 bg-violet-950/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-400">
                          Skeleton
                        </span>
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            t.execution.status === "completed"
                              ? "border-emerald-800/80 bg-emerald-950/50 text-emerald-300"
                              : t.execution.status === "in_progress"
                                ? "border-sky-800/80 bg-sky-950/50 text-sky-300"
                                : "border-zinc-700 bg-zinc-900 text-zinc-400"
                          }`}
                        >
                          {t.execution.status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </div>
                      <p className="mt-2 font-medium text-zinc-100">{t.displayTitle}</p>
                      <p className="text-[11px] text-zinc-500">node {t.nodeId}</p>
                    </div>
                  </div>
                </li>
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
              Flow: <code className="text-zinc-400">{dto.flow.id}</code>
            </div>
            <div>
              Job: <code className="text-zinc-400">{dto.flow.jobId}</code>
            </div>
            <div>
              Quote version: <code className="text-zinc-400">{dto.flow.quoteVersionId}</code>
            </div>
            <div>
              Workflow version: <code className="text-zinc-400">{dto.flow.workflowVersionId}</code>
            </div>
            {dto.activation ? (
              <div>
                Activation: <code className="text-zinc-400">{dto.activation.id}</code>
              </div>
            ) : null}
            <div>
              <Link
                href={`/api/flows/${dto.flow.id}`}
                className="text-sky-400 hover:text-sky-300"
              >
                GET /api/flows/{dto.flow.id} (raw JSON)
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
  } catch (e) {
    if (e instanceof PrismaClientInitializationError) {
      return (
        <main className="mx-auto max-w-2xl space-y-4 p-8">
          <p className="font-medium text-red-400">Database connection failed</p>
          <p className="text-sm text-zinc-400">{e.message}</p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-500">
            <li>
              Put <code className="text-zinc-400">DATABASE_URL</code> in <code className="text-zinc-400">.env</code> or{" "}
              <code className="text-zinc-400">.env.local</code>.
            </li>
            <li>Confirm Postgres is running.</li>
            <li>Restart <code className="text-zinc-400">npm run dev</code> after changing env files.</li>
          </ul>
          <Link href="/" className="inline-block text-sm text-sky-400">
            ← Hub
          </Link>
        </main>
      );
    }
    if (e instanceof Error && e.message.startsWith("[Struxient] DATABASE_URL")) {
      return (
        <main className="mx-auto max-w-2xl space-y-4 p-8">
          <p className="font-medium text-amber-400">Missing DATABASE_URL</p>
          <p className="text-sm text-zinc-400">{e.message}</p>
          <Link href="/" className="inline-block text-sm text-sky-400">
            ← Hub
          </Link>
        </main>
      );
    }
    if (e instanceof InvariantViolationError) {
      return (
        <main className="mx-auto max-w-2xl p-8">
          <p className="font-medium text-red-400">Invariant violation: {e.code}</p>
          <p className="mt-2 text-sm text-zinc-400">{e.message}</p>
          {e.context ? (
            <pre className="mt-4 overflow-x-auto rounded border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
              {JSON.stringify(e.context, null, 2)}
            </pre>
          ) : null}
        </main>
      );
    }
    throw e;
  }
}
