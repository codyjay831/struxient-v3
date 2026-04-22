import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { getWorkflowTemplateDetailForTenant } from "@/server/slice1";
import { ProcessTemplatesCreateDraftButton } from "@/components/library/process-templates/create-draft-version-button";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  PUBLISHED: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300",
  SUPERSEDED: "border-zinc-600 bg-zinc-900/50 text-zinc-400",
};

type PageProps = { params: Promise<{ templateId: string }> };

export default async function OfficeProcessTemplateDetailPage({ params }: PageProps) {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const { templateId } = await params;
  const detail = await getWorkflowTemplateDetailForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    workflowTemplateId: templateId,
  });
  if (!detail) {
    notFound();
  }

  const canOfficeMutate = principalHasCapability(auth.principal, "office_mutate");

  return (
    <div className="p-8">
      <div className="text-xs text-zinc-500 mb-4">
        <Link href="/library/process-templates" className="hover:text-sky-400">
          ← Process templates
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-50">{detail.template.displayName}</h1>
        <p className="text-sm text-zinc-500 mt-1 font-mono">{detail.template.templateKey}</p>
        <p className="text-xs text-zinc-500 mt-3 max-w-2xl">
          Versions are listed newest first. <strong className="text-zinc-400">Published</strong> and{" "}
          <strong className="text-zinc-400">superseded</strong> rows are read-only. Only{" "}
          <strong className="text-zinc-400">draft</strong> versions can be edited or published from the office UI.
        </p>
      </div>

      <div className="mb-8">
        <ProcessTemplatesCreateDraftButton templateId={detail.template.id} canOfficeMutate={canOfficeMutate} />
      </div>

      {detail.versions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 p-8 text-sm text-zinc-500">
          No versions yet. Create a draft to start authoring.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40 text-[11px] uppercase font-bold tracking-wider text-zinc-500">
                <th className="px-6 py-4">Version</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Published at</th>
                <th className="px-6 py-4 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {detail.versions.map((v) => {
                const readOnly = v.status !== "DRAFT";
                return (
                  <tr key={v.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-zinc-200">
                      <div>v{v.versionNumber}</div>
                      {v.forkedFromVersionNumber != null && (
                        <div className="mt-1 text-[11px] font-sans text-zinc-500 normal-case">
                          Forked from v{v.forkedFromVersionNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          STATUS_BADGE[v.status] ?? STATUS_BADGE.DRAFT
                        }`}
                      >
                        {v.status}
                      </span>
                      {readOnly && (
                        <span className="ml-2 text-[10px] text-zinc-500 normal-case">read-only</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-400 font-mono">
                      {v.publishedAtIso ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/library/process-templates/${detail.template.id}/versions/${v.id}`}
                        className="text-xs font-medium text-sky-400 hover:text-sky-300"
                      >
                        Open
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
