import { InvariantViolationError } from "../errors";

/**
 * Quote-local packet is version-scoped; tenant must match owning quote (not library packet canon).
 *
 * @see docs/implementation/decision-packs/quotelocalpacket-schema-decision-pack.md
 */
export function assertQuoteLocalPacketTenantMatchesQuote(params: {
  packetTenantId: string;
  packetQuoteVersionId: string;
  quoteTenantId: string;
  quoteVersionId: string;
  quoteLocalPacketId?: string;
}): void {
  if (params.packetQuoteVersionId !== params.quoteVersionId) {
    throw new InvariantViolationError(
      "LINE_LOCAL_PACKET_VERSION_MISMATCH",
      "QuoteLocalPacket.quoteVersionId must match the parent quote version",
      {
        quoteLocalPacketId: params.quoteLocalPacketId,
        packetQuoteVersionId: params.packetQuoteVersionId,
        quoteVersionId: params.quoteVersionId,
      },
    );
  }

  if (params.packetTenantId !== params.quoteTenantId) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_TENANT_MISMATCH",
      "QuoteLocalPacket.tenantId must equal Quote.tenantId for the owning version",
      {
        quoteLocalPacketId: params.quoteLocalPacketId,
        packetTenantId: params.packetTenantId,
        quoteTenantId: params.quoteTenantId,
      },
    );
  }
}
