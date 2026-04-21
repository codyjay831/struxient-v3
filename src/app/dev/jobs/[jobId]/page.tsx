import Link from "next/link";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { InternalNotFoundState, InternalSparseState } from "@/components/internal/internal-state-feedback";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { getPrisma } from "@/server/db/prisma";
import { getJobShellReadModel } from "@/server/slice1/reads/job-shell";
import { toJobShellApiDto } from "@/lib/job-shell-dto";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { InternalQuickJump } from "@/components/internal/internal-quick-jump";

type PageProps = { params: Promise<{ jobId: string }> };

export const dynamic = "force-dynamic";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").replace(/\..+$/, " UTC");
}

export default async function DevJobDetailPage({ params }: PageProps) {
  const { jobId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <p className="text-zinc-300">
          Sign in at <Link href="/dev/login" className="text-sky-400">/dev/login</Link> or enable dev auth
          bypass (see .env.example).
        </p>
        <Link href="/dev/jobs" className="inline-block text-sm text-sky-400">
          ← Jobs
        </Link>
      </main>
    );
  }

  try {
    const model = await getJobShellReadModel(getPrisma(), {
      tenantId: auth.principal.tenantId,
      jobId,
    });

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

    const quickJumpLinks = [
      { label: "All jobs", href: "/dev/jobs" },
      { label: "Activated flows", href: "/dev/flows" },
      { label: "Customers", href: "/dev/customers" },
      { label: "Flow groups", href: "/dev/flow-groups" },
    ];

    return (
      <main className="mx-auto max-w-4xl px-4 py-8 text-zinc-200 sm:px-6 lg:px-8">
        <header className="mb-6 border-b border-zinc-800 pb-5">
          <InternalBreadcrumb
            category="Execution"
            segments={[{ label: "Jobs", href: "/dev/jobs" }, { label: "Job detail" }]}
          />
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">Job Detail</h1>
              <p className="mt-1 text-sm text-zinc-400">
                View execution flows and lifecycle for this job anchor
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
              hint="Jobs are anchored at SIGNED status, but flows are only created upon activation."
              action={{ href: "/dev/quotes", label: "Open quote list" }}
            />
          ) : (
            <ul className="space-y-3 text-sm">
              {dto.flows.map((f) => (
                <li
                  key={f.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-zinc-100">
                        Quote {f.quoteNumber} (Flow {f.id.slice(0, 8)}…)
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        workflow v{f.workflowVersionId.slice(0, 8)}… · created{" "}
                        {formatTimestamp(f.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        f.activation
                          ? "border-emerald-800/80 bg-emerald-950/50 text-emerald-300"
                          : "border-amber-800/80 bg-amber-950/50 text-amber-300"
                      }`}
                    >
                      {f.activation ? "Activated" : "Not activated"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Link
                      href={`/dev/work-feed/${f.id}`}
                      className="rounded bg-sky-700 px-2.5 py-1 text-white hover:bg-sky-600"
                    >
                      Open work feed
                    </Link>
                    <Link
                      href={`/dev/flow/${f.id}`}
                      className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-200 hover:bg-zinc-800"
                    >
                      Flow detail
                    </Link>
                    <Link
                      href={`/dev/quotes/${f.quoteId}`}
                      className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-200 hover:bg-zinc-800"
                    >
                      Quote workspace
                    </Link>
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
              Job ID: <code className="text-zinc-400">{dto.job.id}</code>
            </div>
            <div>
              Flow Group ID: <code className="text-zinc-400">{dto.job.flowGroupId}</code>
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
  } catch (e) {
    if (e instanceof PrismaClientInitializationError) {
      return (
        <main className="mx-auto max-w-2xl space-y-4 p-8">
          <p className="font-medium text-red-400">Database connection failed</p>
          <p className="text-sm text-zinc-400">{e.message}</p>
          <Link href="/" className="inline-block text-sm text-sky-400">
            ← Hub
          </Link>
        </main>
      );
    }
    throw e;
  }
}
