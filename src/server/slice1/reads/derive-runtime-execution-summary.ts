export type RuntimeTaskExecutionSummary = {
  status: "not_started" | "in_progress" | "completed";
  startedAt: Date | null;
  completedAt: Date | null;
};

export function deriveRuntimeExecutionSummary(
  events: { eventType: string; createdAt: Date }[],
): RuntimeTaskExecutionSummary {
  const started = events
    .filter((e) => e.eventType === "STARTED")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  const completed = events
    .filter((e) => e.eventType === "COMPLETED")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  const startedAt = started?.createdAt ?? null;
  const completedAt = completed?.createdAt ?? null;
  const status =
    completedAt != null ? "completed" : startedAt != null ? "in_progress" : "not_started";
  return { status, startedAt, completedAt };
}
