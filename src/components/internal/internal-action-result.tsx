import React from "react";

type ActionResultProps = {
  kind: "success" | "error";
  title: string;
  message?: string;
  nextStep?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  technicalDetails?: string;
};

/**
 * Standardized inline feedback for workspace actions.
 */
export function InternalActionResult({ 
  kind, 
  title, 
  message, 
  nextStep, 
  technicalDetails 
}: ActionResultProps) {
  const isSuccess = kind === "success";
  
  return (
    <div className={`mt-3 rounded-lg border p-4 ${
      isSuccess 
        ? "border-emerald-800/40 bg-emerald-950/20 text-emerald-400" 
        : "border-amber-800/40 bg-amber-950/20 text-amber-400"
    }`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
          isSuccess ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
        }`} />
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider">{title}</p>
          {message && (
            <p className="mt-1 text-xs leading-relaxed opacity-90">
              {message}
            </p>
          )}
          
          {nextStep && (
            <div className="mt-3">
              <span className="text-[10px] font-bold uppercase tracking-tight opacity-50 block mb-1">
                Next recommended action
              </span>
              {nextStep.href ? (
                <a 
                  href={nextStep.href}
                  className={`text-xs font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity ${
                    isSuccess ? "text-emerald-300" : "text-amber-300"
                  }`}
                >
                  {nextStep.label} →
                </a>
              ) : (
                <button
                  type="button"
                  onClick={nextStep.onClick}
                  className={`text-xs font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity text-left ${
                    isSuccess ? "text-emerald-300" : "text-amber-300"
                  }`}
                >
                  {nextStep.label} →
                </button>
              )}
            </div>
          )}

          {technicalDetails && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[10px] font-medium opacity-50 hover:opacity-80">
                Technical details
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-2 font-mono text-[10px] leading-relaxed text-zinc-400 border border-white/5">
                {technicalDetails}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
