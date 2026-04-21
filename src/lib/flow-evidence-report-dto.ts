import type { RuntimeTaskExecutionSummary } from "@/server/slice1/reads/derive-runtime-execution-summary";

export type FlowEvidenceReportTaskDto = {
  kind: "SKELETON" | "RUNTIME";
  id: string;
  nodeId: string;
  displayTitle: string;
  status: RuntimeTaskExecutionSummary["status"];
  startedAt: string | null;
  completedAt: string | null;
  reviewedAt: string | null;
  verified: boolean; // status === 'accepted'
  proof: RuntimeTaskExecutionSummary["completionProof"];
};

export type FlowEvidenceReportDto = {
  reportId: string;
  generatedAt: string;
  flow: {
    id: string;
    quoteNumber: string;
    createdAt: string;
    receiptAcknowledgedAt: string | null;
    clarificationRequestedAt: string | null;
    clarificationReason: string | null;
    expiresAt: string | null;
  };
  job: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    name: string;
  };
  tasks: FlowEvidenceReportTaskDto[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    acceptedTasks: number;
    verifiedPercentage: number;
  };
};
