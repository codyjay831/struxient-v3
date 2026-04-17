-- One STARTED / one COMPLETED per (flow, skeleton task) for taskKind SKELETON (canon/04, epic 41).
-- Partial index: RUNTIME rows use runtimeTaskId unique; they leave skeletonTaskId null.

CREATE UNIQUE INDEX "TaskExecution_skeleton_flow_event_key"
ON "TaskExecution" ("flowId", "skeletonTaskId", "eventType")
WHERE "taskKind" = 'SKELETON';
