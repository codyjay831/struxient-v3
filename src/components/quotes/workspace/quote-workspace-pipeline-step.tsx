import type { ReactNode } from "react";

type Props = {
  step: number;
  title: string;
  hint?: string;
  isRecommended?: boolean;
  /** When true, step chrome is visually quieter (non-current steps in quote progress). */
  isQuiet?: boolean;
  /** Optional actions aligned with the step title (e.g. secondary link to full-page builder). */
  titleAside?: ReactNode;
  children: ReactNode;
};

/**
 * Visual step for quote progress; wraps existing panels without changing fetch logic.
 */
export function QuoteWorkspacePipelineStep({
  step,
  title,
  hint,
  isRecommended,
  isQuiet = false,
  titleAside,
  children,
}: Props) {
  const quiet = isQuiet && !isRecommended;
  return (
    <div
      className={`scroll-mt-6 transition-colors ${
        isRecommended ? "rounded-md border border-sky-900/40 bg-sky-950/20 p-4 sm:p-5" : ""
      } ${quiet ? "opacity-85" : ""}`}
    >
      <div className={`mb-3 flex gap-3 border-l-2 pl-3 ${isRecommended ? "border-sky-500" : "border-zinc-800"}`}>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums ${
            isRecommended ? "bg-sky-600 text-white" : "bg-zinc-800 text-zinc-200"
          } ${quiet ? "opacity-90" : ""}`}
          aria-hidden
        >
          {step}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={`font-semibold ${
                  isRecommended ? "text-base text-sky-200 sm:text-lg" : quiet ? "text-sm text-zinc-500" : "text-sm text-zinc-100"
                }`}
              >
                {title}
              </h3>
              {isRecommended ?
                <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-300">
                  Now
                </span>
              : null}
            </div>
            {hint ?
              <p className={`mt-1 leading-snug text-zinc-500 ${quiet ? "text-xs" : "text-sm"}`}>{hint}</p>
            : null}
          </div>
          {titleAside ?
            <div className="shrink-0 sm:ml-auto sm:pt-0.5">{titleAside}</div>
          : null}
        </div>
      </div>
      <div className={`pl-0 sm:pl-11 ${quiet ? "mt-0.5" : ""}`}>{children}</div>
    </div>
  );
}
