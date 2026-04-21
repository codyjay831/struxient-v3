export type RuntimeTaskExecutionSummary = {
  status: "not_started" | "in_progress" | "completed" | "accepted" | "correction_required";
  startedAt: Date | null;
  completedAt: Date | null;
  reviewedAt: Date | null;
  correctionFeedback: string | null;
  completionProof?: {
    note: string | null;
    attachments: { fileName: string; storageKey: string; contentType: string }[];
    checklist: { label: string; status: "yes" | "no" | "na" }[];
    measurements: { label: string; value: string; unit?: string }[];
    identifiers: { label: string; value: string }[];
    overallResult: string | null;
  } | null;
};

export function deriveRuntimeExecutionSummary(
  events: { 
    eventType: string; 
    createdAt: Date; 
    notes?: string | null;
    completionProof?: { 
      note: string | null; 
      attachments: { fileName: string; storageKey: string; contentType: string }[];
      checklistJson?: any;
      measurementsJson?: any;
      identifiersJson?: any;
      overallResult?: string | null;
    } | null 
  }[],
): RuntimeTaskExecutionSummary {
  const sorted = [...events].sort((a, b) => {
    const t = a.createdAt.getTime() - b.createdAt.getTime();
    if (t !== 0) return t;
    // Tie-breaker for same millisecond: order by event type priority if needed, 
    // but usually STARTED < COMPLETED < REVIEW.
    const priority: Record<string, number> = { STARTED: 1, COMPLETED: 2, CORRECTION_REQUIRED: 3, REVIEW_ACCEPTED: 4 };
    return (priority[a.eventType] || 0) - (priority[b.eventType] || 0);
  });
  
  const startedEvents = sorted.filter((e) => e.eventType === "STARTED");
  const completionEvents = sorted.filter((e) => e.eventType === "COMPLETED");
  
  const firstStarted = startedEvents[0];
  const lastCompleted = completionEvents[completionEvents.length - 1];

  const lastCompletedIndex = lastCompleted ? sorted.indexOf(lastCompleted) : -1;
  const reviewEventsAfterCompletion = lastCompletedIndex !== -1
    ? sorted.slice(lastCompletedIndex + 1).filter(e => e.eventType === "REVIEW_ACCEPTED" || e.eventType === "CORRECTION_REQUIRED")
    : [];

  const lastReview = reviewEventsAfterCompletion[reviewEventsAfterCompletion.length - 1];

  const startedAt = firstStarted?.createdAt ?? null;
  const completedAt = lastCompleted?.createdAt ?? null;
  const reviewedAt = lastReview?.createdAt ?? null;
  const correctionFeedback = lastReview?.eventType === "CORRECTION_REQUIRED" ? lastReview.notes ?? null : null;

  let status: RuntimeTaskExecutionSummary["status"] = "not_started";
  if (lastReview?.eventType === "REVIEW_ACCEPTED") {
    status = "accepted";
  } else if (lastReview?.eventType === "CORRECTION_REQUIRED") {
    status = "correction_required";
  } else if (lastCompleted) {
    status = "completed"; // Pending review
  } else if (firstStarted) {
    status = "in_progress";
  }

  return { 
    status, 
    startedAt, 
    completedAt,
    reviewedAt,
    correctionFeedback,
    completionProof: lastCompleted?.completionProof ? {
      note: lastCompleted.completionProof.note,
      attachments: lastCompleted.completionProof.attachments,
      checklist: (lastCompleted.completionProof.checklistJson as any) || [],
      measurements: (lastCompleted.completionProof.measurementsJson as any) || [],
      identifiers: (lastCompleted.completionProof.identifiersJson as any) || [],
      overallResult: lastCompleted.completionProof.overallResult || null,
    } : null,
  };
}
