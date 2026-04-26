import Link from "next/link";
import { redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { listTaskDefinitionsForTenant } from "@/server/slice1/reads/task-definition-reads";

/**
 * Office-surface library index for TaskDefinitions.
 *
 * Reuses `listTaskDefinitionsForTenant` — same tenant-scoped read consumed by
 * `/dev/task-definitions`. Office admins (`office_mutate`) get an inline
 * "+ New" entry point and an "Edit" affordance per row; everyone else sees a
 * read-only inspector. Authoring posts to the same `/api/task-definitions`
 * routes that the dev surface uses (server gate + tenant scope unchanged).
 */
export const dynamic = "force-dynamic";

const LIST_LIMIT = 200;

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  PUBLISHED: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300",
  ARCHIVED: "border-zinc-700 bg-zinc-900/40 text-zinc-500",
};

export default async function OfficeLibraryTaskDefinitionsPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const items = await listTaskDefinitionsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  const canAuthor = principalHasCapability(auth.principal, "office_mutate");

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Task definitions</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
            Curated reusable work intelligence. Each definition declares completion
            requirements that the field UI shapes itself against and the runtime validator
            enforces after activation. Editing a definition does not affect previously sent
            quotes — their requirements were frozen at send time.
          </p>
        </div>
        {canAuthor ? (
          <Link
            href="/library/task-definitions/new"
            className="shrink-0 rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition-colors"
          >
            New task definition
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-500"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <h2 className="text-zinc-200 font-medium">No task definitions yet</h2>
          <p className="text-zinc-500 text-sm mt-1 max-w-sm mx-auto">
            Task definitions describe a unit of field work — what evidence the tech must
            capture, and any conditional follow-ups. They are referenced by saved packet
            lines and one-off quote work.
          </p>
          {canAuthor ? (
            <Link
              href="/library/task-definitions/new"
              className="mt-6 inline-block rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition-colors"
            >
              Create your first task definition
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40 text-[11px] uppercase font-bold tracking-wider text-zinc-500">
                <th className="px-6 py-4">Task</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Requirements</th>
                <th className="px-6 py-4 text-right">Conditional rules</th>
                <th className="px-6 py-4 text-right">Used by</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {items.map((td) => {
                const totalRefs = td.packetTaskLineRefCount + td.quoteLocalPacketItemRefCount;
                return (
                  <tr key={td.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-5">
                      <Link
                        href={`/library/task-definitions/${td.id}`}
                        className="font-semibold text-zinc-50 hover:text-sky-400 transition-colors"
                      >
                        {td.displayName}
                      </Link>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        {td.taskKey}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          STATUS_BADGE[td.status] ?? STATUS_BADGE.DRAFT
                        }`}
                      >
                        {td.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="text-sm font-mono text-zinc-300">
                        {td.requirementsCount}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="text-sm font-mono text-zinc-300">
                        {td.conditionalRulesCount}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="text-sm font-mono text-zinc-300">{totalRefs}</span>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {td.packetTaskLineRefCount} packet ·{" "}
                        {td.quoteLocalPacketItemRefCount} local
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Link
                        href={`/library/task-definitions/${td.id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-50 rounded text-xs font-medium transition-all"
                      >
                        {canAuthor && td.status === "DRAFT" ? "Edit" : "Open"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
