import { getPrisma } from "@/server/db/prisma";
import { getProjectEvidenceRollupReadModel } from "@/server/slice1/reads/project-evidence-rollup";
import { ProjectEvidenceRollupView } from "@/components/report/project-evidence-rollup-view";
import { recordProjectShareAccess } from "@/server/slice1/mutations/project-share-telemetry";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ shareToken: string }> };

export const dynamic = "force-dynamic";

export default async function PortalProjectRollupPage({ params }: PageProps) {
  const { shareToken } = await params;
  const prisma = getPrisma();

  const rollup = await getProjectEvidenceRollupReadModel(prisma, { shareToken });

  if (!rollup) {
    notFound();
  }

  // Record valid telemetry
  await recordProjectShareAccess(prisma, { flowGroupId: rollup.projectId });

  return <ProjectEvidenceRollupView rollup={rollup} token={shareToken} />;
}
