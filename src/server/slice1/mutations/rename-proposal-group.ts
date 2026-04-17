import type { PrismaClient } from "@prisma/client";
import { InvariantViolationError } from "../errors";
import { assertQuoteVersionDraft } from "../invariants/quote-version";
import { bumpComposePreviewStalenessToken } from "./compose-staleness";

const MAX_NAME_LEN = 200;

export type RenamedProposalGroupDto = {
  id: string;
  quoteVersionId: string;
  name: string;
  sortOrder: number;
};

/**
 * Tenant-scoped rename; version id in URL must match the group's version (no cross-version moves).
 */
export async function renameProposalGroupForTenant(
  client: PrismaClient,
  params: {
    tenantId: string;
    quoteVersionId: string;
    proposalGroupId: string;
    name: string;
  },
): Promise<RenamedProposalGroupDto | "not_found"> {
  const name = params.name.trim();
  if (!name) {
    throw new InvariantViolationError(
      "INVALID_PROPOSAL_GROUP_NAME",
      "Proposal group name must be non-empty after trim.",
      { proposalGroupId: params.proposalGroupId },
    );
  }
  if (name.length > MAX_NAME_LEN) {
    throw new InvariantViolationError(
      "INVALID_PROPOSAL_GROUP_NAME",
      `Proposal group name must be at most ${MAX_NAME_LEN} characters.`,
      { proposalGroupId: params.proposalGroupId, length: name.length },
    );
  }

  const group = await client.proposalGroup.findFirst({
    where: { id: params.proposalGroupId },
    select: {
      id: true,
      quoteVersionId: true,
      name: true,
      sortOrder: true,
      quoteVersion: {
        select: {
          id: true,
          status: true,
          quote: { select: { tenantId: true } },
        },
      },
    },
  });

  if (!group) {
    return "not_found";
  }

  if (group.quoteVersion.quote.tenantId !== params.tenantId) {
    return "not_found";
  }

  if (group.quoteVersionId !== params.quoteVersionId) {
    throw new InvariantViolationError(
      "PROPOSAL_GROUP_VERSION_MISMATCH",
      "Proposal group does not belong to the given quote version.",
      {
        proposalGroupId: params.proposalGroupId,
        quoteVersionId: params.quoteVersionId,
        actualQuoteVersionId: group.quoteVersionId,
      },
    );
  }

  assertQuoteVersionDraft({
    status: group.quoteVersion.status,
    quoteVersionId: group.quoteVersion.id,
  });

  const updated = await client.proposalGroup.update({
    where: { id: group.id },
    data: { name },
    select: { id: true, quoteVersionId: true, name: true, sortOrder: true },
  });

  await bumpComposePreviewStalenessToken(client, group.quoteVersionId);

  return updated;
}
