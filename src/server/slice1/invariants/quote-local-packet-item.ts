import type { QuoteLocalPacketLineKind } from "@prisma/client";
import { InvariantViolationError } from "../errors";

/**
 * Line-kind payload rules (service-level; not DB-enforced).
 * Keeps local packet rows composable without silent empty LIBRARY/EMBEDDED rows.
 */
export function assertQuoteLocalPacketItemLineKindPayload(params: {
  lineKind: QuoteLocalPacketLineKind;
  embeddedPayloadJson: unknown;
  taskDefinitionId: string | null;
  quoteLocalPacketItemId?: string;
}): void {
  if (params.lineKind === "LIBRARY") {
    if (params.taskDefinitionId == null || params.taskDefinitionId === "") {
      throw new InvariantViolationError(
        "QUOTE_LOCAL_PACKET_ITEM_LIBRARY_WITHOUT_DEFINITION",
        "QuoteLocalPacketItem with lineKind LIBRARY requires taskDefinitionId",
        { quoteLocalPacketItemId: params.quoteLocalPacketItemId },
      );
    }
    return;
  }

  if (params.lineKind === "EMBEDDED") {
    if (params.embeddedPayloadJson == null) {
      throw new InvariantViolationError(
        "QUOTE_LOCAL_PACKET_ITEM_EMBEDDED_WITHOUT_PAYLOAD",
        "QuoteLocalPacketItem with lineKind EMBEDDED requires embeddedPayloadJson",
        { quoteLocalPacketItemId: params.quoteLocalPacketItemId },
      );
    }
  }
}
