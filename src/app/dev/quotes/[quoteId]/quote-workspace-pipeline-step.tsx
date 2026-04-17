import type { ReactNode } from "react";

type Props = {
  step: number;
  title: string;
  hint?: string;
  children: ReactNode;
};

/**
 * Visual step label for the office lifecycle; wraps existing panels without changing their fetch logic.
 */
export function QuoteWorkspacePipelineStep({ step, title, hint, children }: Props) {
  return (
    <div className="scroll-mt-6">
      <div className="mb-2 flex gap-3 border-l-2 border-amber-700/50 pl-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-100"
          aria-hidden
        >
          {step}
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
          {hint ? <p className="mt-0.5 text-xs leading-snug text-zinc-500">{hint}</p> : null}
        </div>
      </div>
      <div className="pl-1 sm:pl-10">{children}</div>
    </div>
  );
}
