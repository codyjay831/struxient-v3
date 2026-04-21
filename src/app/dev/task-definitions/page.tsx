import Link from "next/link";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { InternalEmptyDiscoveryState } from "@/components/internal/internal-state-feedback";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { listTaskDefinitionsForTenant } from "@/server/slice1/reads/task-definition-reads";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 100;

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  PUBLISHED: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300",
  ARCHIVED: "border-zinc-700 bg-zinc-900/40 text-zinc-500",
};

export default async function DevTaskDefinitionsPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-zinc-300">
          Sign in at{" "}
          <Link href="/dev/login" className="text-sky-400">
            /dev/login
          </Link>{" "}
          or enable dev auth bypass.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-sky-400">
          ← Hub
        </Link>
      </main>
    );
  }

  const items = await listTaskDefinitionsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 text-sky-400">
          <div>
            <InternalBreadcrumb category="Commercial" segments={[{ label: "Task definitions" }]} />
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">
              Task definitions
            </h1>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">
              Curated reusable work intelligence. Each definition carries authored completion
              requirements that the field UI pre-shapes itself against and the runtime validator
              enforces after activation.
            </p>
          </div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-400">
            ← Hub
          </Link>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/dev/task-definitions/new"
          className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 transition-colors"
        >
          + New task definition
        </Link>
        <Link
          href="/api/task-definitions"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Raw JSON
        </Link>
      </div>

      {items.length === 0 ? (
        <InternalEmptyDiscoveryState
          resourceName="Task definitions"
          createInstructions="Authored standards live here. Create one to declare completion requirements for a unit of work."
          action={{ href: "/dev/task-definitions/new", label: "Create a task definition" }}
        />
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-base font-semibold text-zinc-50">{row.displayName}</span>
                  <code className="text-xs text-zinc-500">{row.taskKey}</code>
                </div>
                <span
                  className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    STATUS_BADGE[row.status] ?? STATUS_BADGE.DRAFT
                  }`}
                >
                  {row.status}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                <span>
                  {row.requirementsCount} requirement{row.requirementsCount === 1 ? "" : "s"}
                </span>
                <span>
                  {row.conditionalRulesCount} conditional rule
                  {row.conditionalRulesCount === 1 ? "" : "s"}
                </span>
                <span>{row.packetTaskLineRefCount} packet line refs</span>
                <span>{row.quoteLocalPacketItemRefCount} local-packet refs</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/dev/task-definitions/${row.id}`}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                >
                  Open editor
                </Link>
                <Link
                  href={`/api/task-definitions/${row.id}`}
                  className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-300"
                >
                  JSON
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-8 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-4">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-400">
          Technical details
        </summary>
        <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-zinc-500">
          <p>
            List: <code className="text-zinc-400">GET /api/task-definitions</code> — supports{" "}
            <code className="text-zinc-400">?status=DRAFT,PUBLISHED</code>.
          </p>
          <p>
            Create: <code className="text-zinc-400">POST /api/task-definitions</code> — office_mutate.
          </p>
          <p>
            Read / patch: <code className="text-zinc-400">GET|PATCH /api/task-definitions/&lt;id&gt;</code>.
            Body: partial fields OR exclusive <code className="text-zinc-400">{`{"status":"PUBLISHED"}`}</code>.
          </p>
          <p>Edits permitted only while in DRAFT; status transitions are explicit.</p>
        </div>
      </details>
    </main>
  );
}
