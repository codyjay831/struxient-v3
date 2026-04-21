import { InternalNotFoundState } from "@/components/internal/internal-state-feedback";
import { getPrisma } from "@/server/db/prisma";
import { getFlowExecutionReadModel } from "@/server/slice1/reads/flow-execution";
import { getFlowDiscoveryItemForTenant } from "@/server/slice1/reads/flow-discovery-reads";
import { toFlowExecutionApiDto } from "@/lib/flow-execution-dto";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { FlowExecutionPageHeader } from "@/components/internal/flow-execution-page-header";
import { ExecutionWorkFeed } from "@/components/execution/execution-work-feed";
import { FlowShareControls } from "@/components/execution/flow-share-controls";
import { redirect } from "next/navigation";
import Link from "next/link";

type PageProps = { params: Promise<{ flowId: string }> };

export const dynamic = "force-dynamic";

export default async function OfficeFlowExecutionPage({ params }: PageProps) {
  const { flowId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    redirect("/login");
  }

  const prisma = getPrisma();
  const [model, context] = await Promise.all([
    getFlowExecutionReadModel(prisma, { tenantId: auth.principal.tenantId, flowId }),
    getFlowDiscoveryItemForTenant(prisma, { tenantId: auth.principal.tenantId, flowId }),
  ]);

  if (!model || !context) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 text-zinc-200 sm:px-6 lg:px-8">
        <InternalNotFoundState
          title="Flow not found"
          message="This execution record is not visible to your tenant."
          backLink={{ href: "/quotes", label: "← Quotes" }}
        />
      </main>
    );
  }

  const dto = toFlowExecutionApiDto(model);
  const canExecuteTasks = principalHasCapability(auth.principal, "field_execute");
  const canReviewTasks = principalHasCapability(auth.principal, "office_mutate");

  return (
    <main className="mx-auto max-w-3xl p-4 md:p-8 text-zinc-200">
      <div className="flex justify-between items-start">
        <FlowExecutionPageHeader
          surfaceLabel="Work Feed"
          purpose="Start and complete work items for this flow."
          activeRoute="work-feed"
          context={context}
          flowId={flowId}
          // Redirect production breadcrumbs back to production quotes
          backLinkOverride="/quotes"
        />
        <div className="pt-2 flex gap-2">
          <Link 
            href={`/projects/${context.flowGroup.id}/evidence`}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-700 hover:text-white transition-all"
          >
            <span>⎔ Project Roll-up</span>
          </Link>
          <Link 
            href={`/flows/${flowId}/report`}
            target="_blank"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-700 hover:text-white transition-all"
          >
            <span>⎙ Report</span>
          </Link>
          {dto.flow.publicShareToken && (
             <Link 
               href={`/portal/flows/${dto.flow.publicShareToken}`}
               target="_blank"
               className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-900/20 border border-sky-800/40 text-[10px] font-black uppercase tracking-widest text-sky-400 hover:bg-sky-900/40 transition-all ml-2"
             >
               <span>🔗 Portal</span>
             </Link>
          )}
        </div>
      </div>

      <div className="mb-8">
        <FlowShareControls 
          flowId={flowId} 
          share={dto.flow} 
          customer={dto.customer}
          project={dto.project}
          tenant={dto.tenant}
          deliveries={dto.deliveries} 
        />
      </div>

      <ExecutionWorkFeed 
        flowId={flowId} 
        initialData={dto} 
        canExecuteTasks={canExecuteTasks} 
        canReviewTasks={canReviewTasks}
      />
    </main>
  );
}
