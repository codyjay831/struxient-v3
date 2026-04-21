import { getPrisma } from "@/server/db/prisma";
import { getFlowEvidenceReportReadModel } from "@/server/slice1/reads/flow-evidence-report";
import { recordFlowShareAccess } from "@/server/slice1/mutations/flow-share-telemetry";
import { InternalNotFoundState } from "@/components/internal/internal-state-feedback";
import { FlowEvidenceReportView } from "@/components/report/flow-evidence-report-view";

type Props = { params: Promise<{ shareToken: string }> };

export const dynamic = "force-dynamic";

/**
 * Publicly accessible (but tokenized) customer viewer for verified evidence.
 * No login required if the token is valid.
 */
export default async function CustomerVerifiedEvidencePage({ params }: Props) {
  const { shareToken } = await params;

  const report = await getFlowEvidenceReportReadModel(getPrisma(), {
    shareToken,
  });

  if (!report) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <InternalNotFoundState
            title="Access Denied"
            message="This link is invalid or has expired. Please contact your project administrator."
          />
        </div>
      </div>
    );
  }

  // Record valid access telemetry (don't block the customer view experience)
  void recordFlowShareAccess(getPrisma(), { flowId: report.flow.id });

  // Pass the token down so media retrieval can use it
  return <FlowEvidenceReportView report={report} token={shareToken} />;
}
