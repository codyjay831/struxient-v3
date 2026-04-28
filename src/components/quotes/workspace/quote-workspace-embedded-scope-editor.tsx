"use client";

import type { ComponentProps } from "react";
import { ScopeEditor } from "@/app/(office)/quotes/[quoteId]/scope/scope-editor";

type Props = ComponentProps<typeof ScopeEditor>;

/**
 * Thin client boundary so the office quote workspace can mount {@link ScopeEditor}
 * without re-exporting props at the page level.
 */
export function QuoteWorkspaceEmbeddedScopeEditor(props: Props) {
  return <ScopeEditor {...props} />;
}
