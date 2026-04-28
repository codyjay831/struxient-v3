import type { ReactNode } from "react";

type Props = {
  step: number;
  title: string;
  hint?: string;
  isRecommended?: boolean;
  /** When false, step chrome is visually quieter (non-current steps in quote progress). */
  isQuiet?: boolean;
  children: ReactNode;
};

/**
 * Visual step for quote progress; wraps existing panels without changing fetch logic.
 */
export function QuoteWorkspacePipelineStep({ step, title, hint, isRecommended, isQuiet = false, children }: Props) {
  const quiet = isQuiet && !isRecommended;
  return (
    <div
      className={`scroll-mt-6 rounded-xl transition-all ${
        isRecommended ? "bg-sky-500/[0.03] p-4 -mx-4 ring-1 ring-sky-500/20 shadow-sm shadow-sky-900/10" : ""
      } ${quiet ? "opacity-80" : ""}`}
    >
      <div className={`mb-2 flex gap-3 border-l-2 pl-3 ${isRecommended ? "border-sky-500" : "border-zinc-800"}`}>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            isRecommended ? "bg-sky-600 text-white shadow-sm shadow-sky-900" : "bg-zinc-800 text-zinc-100"
          } ${quiet ? "scale-95 opacity-90" : ""}`}
          aria-hidden
        >
          {step}
        </span>
        <div className="min-w-0 pt-0.5">
          <div className="flex items-center gap-2">
            <h3
              className={`font-semibold ${
                isRecommended ? "text-base text-sky-300" : quiet ? "text-xs text-zinc-400" : "text-sm text-zinc-100"
              }`}
            >
              {title}
            </h3>
            {isRecommended && (
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-400 border border-sky-500/20">
                Current
              </span>
            )}
          </div>
          {hint ? (
            <p className={`mt-0.5 leading-snug text-zinc-500 ${quiet ? "text-[11px]" : "text-xs"}`}>{hint}</p>
          ) : null}
        </div>
      </div>
      <div className={`pl-1 sm:pl-10 ${quiet ? "mt-1" : ""}`}>{children}</div>
    </div>
  );
}
