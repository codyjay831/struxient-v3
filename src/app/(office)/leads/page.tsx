import Link from "next/link";
import { redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { listLeadsForTenant } from "@/server/slice1/reads/lead-reads";

export const dynamic = "force-dynamic";

export default async function OfficeLeadsListPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const prisma = getPrisma();
  const items = await listLeadsForTenant(prisma, {
    tenantId: auth.principal.tenantId,
    limit: 100,
  });

  const assigneeIds = [...new Set(items.map((i) => i.assignedToUserId).filter(Boolean))] as string[];
  const assignees =
    assigneeIds.length > 0
      ? await prisma.user.findMany({
          where: { tenantId: auth.principal.tenantId, id: { in: assigneeIds } },
          select: { id: true, email: true, displayName: true },
        })
      : [];
  const assigneeLabel = new Map(
    assignees.map((u) => [u.id, (u.displayName && u.displayName.trim()) || u.email] as const),
  );

  const canMutate = principalHasCapability(auth.principal, "office_mutate");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Leads</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Prospective opportunities before a quote shell exists. Convert an OPEN lead to create customer, project,
            and quote in one step.
          </p>
        </div>
        {canMutate ? (
          <Link
            href="/leads/new"
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 transition-colors"
          >
            New Lead
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
          <p className="text-zinc-400 text-sm">No leads yet.</p>
          <p className="text-zinc-500 text-xs mt-2 max-w-md mx-auto">
            Capture inbound interest here before starting a quote. When ready, convert an OPEN lead to land in the
            quote workspace.
          </p>
          {canMutate ? (
            <Link
              href="/leads/new"
              className="inline-block mt-6 text-sm font-medium text-sky-400 hover:text-sky-300"
            >
              Create your first lead
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3 hidden md:table-cell">Contact</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-900/40">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${row.id}`} className="font-medium text-sky-400 hover:text-sky-300">
                      {row.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{row.source ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {row.assignedToUserId ? (assigneeLabel.get(row.assignedToUserId) ?? row.assignedToUserId) : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell max-w-[12rem] truncate">
                    {[row.primaryPhone, row.primaryEmail].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                    {row.createdAt.slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
