import { getPrisma } from "@/server/db/prisma";
import { getProjectEvidenceRollupReadModel } from "@/server/slice1/reads/project-evidence-rollup";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { redirect } from "next/navigation";
import { InternalNotFoundState } from "@/components/internal/internal-state-feedback";
import Link from "next/link";
import { ProjectShareControls } from "@/components/report/project-share-controls";

type PageProps = { params: Promise<{ flowGroupId: string }> };

export const dynamic = "force-dynamic";

export default async function ProjectEvidenceRollupPage({ params }: PageProps) {
  const { flowGroupId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    redirect("/login");
  }

  const prisma = getPrisma();
  const rollup = await getProjectEvidenceRollupReadModel(prisma, { 
    tenantId: auth.principal.tenantId, 
    flowGroupId 
  });

  if (!rollup) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 text-zinc-200 sm:px-6 lg:px-8">
        <InternalNotFoundState
          title="Project not found"
          message="This project record is not visible to your tenant."
          backLink={{ href: "/quotes", label: "← Quotes" }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-4 md:p-8 text-zinc-200">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">
          <Link href="/quotes" className="hover:text-zinc-300 transition-colors">Quotes</Link>
          <span>/</span>
          <span className="text-zinc-400">Project Evidence Roll-up</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white mb-1">
          {rollup.projectName}
        </h1>
        <p className="text-sm text-zinc-400 font-medium italic">
          Customer: {rollup.customerName}
        </p>
      </div>

      <div className="mb-8">
        <ProjectShareControls flowGroupId={flowGroupId} rollup={rollup} />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Project Share Governance</h2>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Status</p>
                <span className={`text-[10px] font-black px-2 py-1 rounded border ${
                  rollup.publicShareStatus === "PUBLISHED" ? "bg-sky-500/10 text-sky-400 border-sky-500/20" : "bg-zinc-800 text-zinc-500 border-zinc-700"
                }`}>
                  {rollup.publicShareStatus}
                </span>
              </div>
              {rollup.publicShareExpiresAt && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Expires</p>
                  <span className={`text-[10px] font-black px-2 py-1 rounded border ${
                    new Date(rollup.publicShareExpiresAt) < new Date() ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-zinc-800 text-zinc-400 border-zinc-700"
                  }`}>
                    {new Date(rollup.publicShareExpiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Project Viewer Telemetry</h2>
            <div className="flex flex-wrap gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Total Views</p>
                <p className="text-xl font-black text-white">{rollup.publicShareViewCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">First Accessed</p>
                <p className="text-sm font-bold text-zinc-300">
                  {rollup.publicShareFirstViewedAt ? new Date(rollup.publicShareFirstViewedAt).toLocaleString() : "Never"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Last Accessed</p>
                <p className="text-sm font-bold text-zinc-300">
                  {rollup.publicShareLastViewedAt ? new Date(rollup.publicShareLastViewedAt).toLocaleString() : "Never"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Receipt Acknowledged</p>
                {rollup.publicShareReceiptAcknowledgedAt ? (
                   <p className="text-sm font-bold text-emerald-400">
                     {new Date(rollup.publicShareReceiptAcknowledgedAt).toLocaleString()}
                   </p>
                ) : (
                   <p className="text-sm font-bold text-zinc-600 italic">Not Yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Total Flows</div>
          <div className="text-2xl font-black text-white">{rollup.overallStats.totalFlows}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Total Tasks</div>
          <div className="text-2xl font-black text-white">{rollup.overallStats.totalTasks}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Accepted</div>
          <div className="text-2xl font-black text-emerald-400">{rollup.overallStats.acceptedTasks}</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60 mb-1">Verified %</div>
          <div className="text-2xl font-black text-emerald-400">{rollup.overallStats.verifiedPercentage}%</div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 px-1">Flow Summaries</h2>
        {rollup.flows.map((flow) => (
          <div key={flow.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                  flow.publicShareStatus === "PUBLISHED" 
                    ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" 
                    : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                }`}>
                  {flow.publicShareStatus}
                </span>
                {flow.publicShareExpiresAt && (
                   <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${
                    new Date(flow.publicShareExpiresAt) < new Date() ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                   }`}>
                     Exp: {new Date(flow.publicShareExpiresAt).toLocaleDateString()}
                   </span>
                )}
                <h3 className="font-bold text-white">{flow.title}</h3>
              </div>
              <div className="text-xs text-zinc-500 font-medium">
                {flow.stats.acceptedTasks} / {flow.stats.totalTasks} tasks verified
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all" 
                  style={{ width: `${flow.stats.verifiedPercentage}%` }}
                />
              </div>
              <span className="text-xs font-black text-zinc-400 w-8 text-right">
                {flow.stats.verifiedPercentage}%
              </span>
              <Link 
                href={`/flows/${flow.id}`}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-700 hover:text-white transition-all"
              >
                Open Flow
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
