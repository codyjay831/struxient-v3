export type ProjectEvidenceRollupFlowDto = {
  id: string;
  title: string;
  publicShareToken: string | null;
  status: "DRAFT" | "ACTIVE" | "COMPLETED"; // Derived
  publicShareStatus: "UNPUBLISHED" | "PUBLISHED";
  publicShareExpiresAt: string | null;
  stats: {
    totalTasks: number;
    completedTasks: number;
    acceptedTasks: number;
    verifiedPercentage: number;
  };
};

export type ProjectEvidenceRollupDto = {
  projectId: string;
  projectName: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  generatedAt: string;
  
  publicShareStatus: "UNPUBLISHED" | "PUBLISHED";
  publicShareToken: string | null;
  publicShareExpiresAt: string | null;
  publicShareViewCount: number;
  publicShareFirstViewedAt: string | null;
  publicShareLastViewedAt: string | null;
  publicShareReceiptAcknowledgedAt: string | null;
  publicShareClarificationRequestedAt: string | null;
  publicShareClarificationReason: string | null;
  publicShareClarificationResolvedAt: string | null;
  publicShareClarificationResolutionNote: string | null;
  publicShareClarificationEscalatedAt: string | null;
  publicShareNotificationLastSeenAt: string | null;

  interactionStatus: "PUBLISHED" | "VIEWED" | "ACKNOWLEDGED" | "CLARIFICATION_REQUESTED" | "CLARIFICATION_RESOLVED" | "REVOKED" | "EXPIRED" | "PENDING_PUBLISH";
  requiresAttention: boolean;
  shareAccessStatus: "ACTIVE" | "EXPIRED" | "REVOKED" | "PENDING_PUBLISH";

  notificationPriority: "NONE" | "INFO" | "URGENT";
  isClarificationUnresolved: boolean;

  deliveries: {
    id: string;
    deliveredAt: string;
    deliveryMethod: string;
    recipientDetail: string | null;
    shareToken: string;
    providerStatus: string;
    providerError: string | null;
  }[];

  flows: ProjectEvidenceRollupFlowDto[];
  overallStats: {
    totalFlows: number;
    publishedFlows: number;
    totalTasks: number;
    completedTasks: number;
    acceptedTasks: number;
    verifiedPercentage: number;
  };
};
