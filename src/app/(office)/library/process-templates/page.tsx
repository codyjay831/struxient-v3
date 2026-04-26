import Link from "next/link";
import { redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { listWorkflowTemplatesForTenant } from "@/server/slice1";
import { ProcessTemplatesCreateForm } from "@/components/library/process-templates/create-template-form";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 200;

export default async function OfficeLibraryProcessTemplatesPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const canOfficeMutate = principalHasCapability(auth.principal, "office_mutate");

  const items = await listWorkflowTemplatesForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  return (
    <div className="p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between mb-8">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold text-zinc-50">Process templates (admin)</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Internal admin authoring surface. New quotes auto-bind to the canonical execution-stages
            workflow; this page is for migrating existing data, defining alternate published flows
            for admin overrides, and inspecting raw JSON. Authoring is{" "}
            <strong className="text-zinc-400">minimal</strong>: create a template, add a draft, edit JSON, publish.
          </p>
        </div>
        <div className="w-full max-w-md shrink-0">
          <ProcessTemplatesCreateForm canOfficeMutate={canOfficeMutate} />
        </div>
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
              <path d="M12 3v18" />
              <path d="M3 12h18" />
            </svg>
          </div>
          <h2 className="text-zinc-200 font-medium">No process templates yet</h2>
          <p className="text-zinc-500 text-sm mt-1 max-w-sm mx-auto">
            {canOfficeMutate
              ? "Create one using the form above. Published versions are available for admin overrides via the technical-details panel on a quote workspace."
              : "Office admins can create templates. Your account is read-only for mutations."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40 text-[11px] uppercase font-bold tracking-wider text-zinc-500">
                <th className="px-6 py-4">Template</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {items.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-5">
                    <Link
                      href={`/library/process-templates/${t.id}`}
                      className="font-semibold text-zinc-50 hover:text-sky-400 transition-colors"
                    >
                      {t.displayName}
                    </Link>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{t.templateKey}</div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Link
                      href={`/library/process-templates/${t.id}`}
                      className="text-xs font-medium text-sky-400 hover:text-sky-300"
                    >
                      Versions →
                    </Link>
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
