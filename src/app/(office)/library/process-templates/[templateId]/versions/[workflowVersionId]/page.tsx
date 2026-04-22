import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { getWorkflowVersionOfficeDetailForTenant } from "@/server/slice1";
import { ProcessTemplatesDraftSnapshotEditor } from "@/components/library/process-templates/draft-snapshot-editor";
import { ProcessTemplatesForkDraftFromVersionButton } from "@/components/library/process-templates/fork-draft-from-version-button";
import { stringifySnapshotForEditor, workflowVersionAllowsSnapshotJsonEdit } from "@/lib/process-templates-office";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ templateId: string; workflowVersionId: string }> };

export default async function OfficeProcessTemplateVersionPage({ params }: PageProps) {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const { templateId, workflowVersionId } = await params;

  const row = await getWorkflowVersionOfficeDetailForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    workflowTemplateId: templateId,
    workflowVersionId,
  });
  if (!row) {
    notFound();
  }

  const editable = workflowVersionAllowsSnapshotJsonEdit(row.status);
  const editorText = stringifySnapshotForEditor(row.snapshotJson);
  const canOfficeMutate = principalHasCapability(auth.principal, "office_mutate");
  const canForkFromThisVersion =
    (row.status === "PUBLISHED" || row.status === "SUPERSEDED") && row.publishedAtIso != null;

  return (
    <div className="p-8">
      <div className="text-xs text-zinc-500 mb-4 space-x-2">
        <Link href="/library/process-templates" className="hover:text-sky-400">
          ← Process templates
        </Link>
        <span className="text-zinc-700">/</span>
        <Link href={`/library/process-templates/${templateId}`} className="hover:text-sky-400">
          {row.templateDisplayName}
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-50">
          Version v{row.versionNumber}{" "}
          <span className="text-sm font-normal text-zinc-500 font-mono">({row.id.slice(0, 8)}…)</span>
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Status: <span className="font-mono text-zinc-300">{row.status}</span>
          {row.publishedAtIso != null && (
            <>
              {" "}
              · Published: <span className="font-mono text-zinc-400">{row.publishedAtIso}</span>
            </>
          )}
        </p>
        {row.forkedFromVersionNumber != null && (
          <p className="text-xs text-zinc-500 mt-2">
            Forked from v{row.forkedFromVersionNumber} (snapshot copy; source version is unchanged).
          </p>
        )}
      </div>

      {editable ? (
        <ProcessTemplatesDraftSnapshotEditor
          workflowVersionId={row.id}
          templateId={templateId}
          initialEditorText={editorText}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-400">
            This version is <strong className="text-zinc-200">{row.status}</strong> — snapshot editing and publish are
            disabled. Published and superseded rows keep a frozen snapshot for history and for forking a new draft.
          </div>
          {canForkFromThisVersion && (
            <ProcessTemplatesForkDraftFromVersionButton
              templateId={templateId}
              sourceWorkflowVersionId={row.id}
              versionSummary={`v${row.versionNumber} (${row.status})`}
              canOfficeMutate={canOfficeMutate}
            />
          )}
          <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 p-4 text-xs font-mono text-zinc-300 leading-relaxed">
            {editorText}
          </pre>
        </div>
      )}
    </div>
  );
}
