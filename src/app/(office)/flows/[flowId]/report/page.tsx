import { getPrisma } from "@/server/db/prisma";
import { getFlowEvidenceReportReadModel } from "@/server/slice1/reads/flow-evidence-report";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { redirect } from "next/navigation";
import { InternalNotFoundState } from "@/components/internal/internal-state-feedback";
import { FlowEvidenceReportView } from "@/components/report/flow-evidence-report-view";

type Props = { params: Promise<{ flowId: string }> };

export const dynamic = "force-dynamic";

export default async function FlowEvidenceReportPage({ params }: Props) {
  const { flowId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    redirect("/login");
  }

  const report = await getFlowEvidenceReportReadModel(getPrisma(), {
    tenantId: auth.principal.tenantId,
    flowId,
  });

  if (!report) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 text-zinc-200">
        <InternalNotFoundState
          title="Report not found"
          message="This flow record is not visible or does not exist."
          backLink={{ href: `/flows/${flowId}`, label: "← Back to Flow" }}
        />
      </main>
    );
  }

  return <FlowEvidenceReportView report={report} />;
}
