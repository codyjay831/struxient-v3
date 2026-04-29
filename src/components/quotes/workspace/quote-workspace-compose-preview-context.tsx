"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ComposePreviewClientData } from "@/lib/workspace/quote-workspace-compose-preview-client-types";

type ComposePreviewContextValue = {
  quoteId: string;
  lastCompose: ComposePreviewClientData | null;
  setLastCompose: (data: ComposePreviewClientData | null) => void;
};

const ComposePreviewContext = createContext<ComposePreviewContextValue | null>(null);

export function QuoteWorkspaceComposePreviewProvider({
  quoteId,
  children,
}: {
  quoteId: string;
  children: ReactNode;
}) {
  const [lastCompose, setLastComposeState] = useState<ComposePreviewClientData | null>(null);
  const setLastCompose = useCallback((data: ComposePreviewClientData | null) => {
    setLastComposeState(data);
  }, []);

  const value = useMemo(
    () => ({
      quoteId,
      lastCompose,
      setLastCompose,
    }),
    [quoteId, lastCompose, setLastCompose],
  );

  return <ComposePreviewContext.Provider value={value}>{children}</ComposePreviewContext.Provider>;
}

/**
 * Workspace compose preview snapshot (last successful `compose-preview` response).
 * Safe outside provider: returns null compose + no-op setter.
 */
export function useQuoteWorkspaceComposePreview(): ComposePreviewContextValue {
  const v = useContext(ComposePreviewContext);
  if (!v) {
    return {
      quoteId: "",
      lastCompose: null,
      setLastCompose: () => {},
    };
  }
  return v;
}
