/**
 * Client-side mirror of compose-preview validation rows returned by
 * `POST /api/quote-versions/:id/compose-preview` (see `ComposePreviewValidationItem`
 * in `src/server/slice1/compose-preview/build-compose-preview.ts`).
 */
export type ComposePreviewValidationClientItem = {
  code: string;
  message: string;
  lineItemId?: string;
  planTaskId?: string;
};

export type ComposePreviewClientData = {
  quoteVersionId: string;
  stalenessToken: string | null;
  staleness: "fresh" | "stale";
  errors: ComposePreviewValidationClientItem[];
  warnings: ComposePreviewValidationClientItem[];
  stats: {
    lineItemCount: number;
    planTaskCount: number;
    packageTaskCount: number;
    skeletonSlotCount: number;
    soldSlotCount: number;
  };
};
