export type ComposeSendDisabledReasonInput = {
  hasPinnedWorkflow: boolean;
  hasLastCompose: boolean;
  composeBlocking: boolean;
  stalenessTokenForSendDefined: boolean;
};

/**
 * Plain-language reason why Send proposal is disabled (office workspace).
 * Mirrors `QuoteWorkspaceComposeSendPanel` gating; keep in sync when send rules change.
 */
export function composeSendProposalDisabledReason(input: ComposeSendDisabledReasonInput): string | null {
  if (!input.hasPinnedWorkflow) {
    return "Send is waiting until the work plan is attached to this draft. You can still run Preview proposal to check line items, or contact support if this does not clear.";
  }
  if (!input.hasLastCompose) {
    return "Run Preview proposal first. Sending needs a successful preview so we know this version is up to date.";
  }
  if (input.composeBlocking) {
    return "Fix the blocking issues from preview, run Preview proposal again, then send.";
  }
  if (!input.stalenessTokenForSendDefined) {
    return "Run Preview proposal again to refresh your preview, then try sending.";
  }
  return null;
}
