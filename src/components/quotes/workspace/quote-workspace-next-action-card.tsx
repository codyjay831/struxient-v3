import Link from "next/link";
import type { QuoteWorkspaceNextActionView } from "@/lib/workspace/quote-workspace-next-action";

type Props = {
  model: QuoteWorkspaceNextActionView;
  /**
   * `band`: slim command strip (office quote workspace).
   * `card`: legacy bordered card (unused today; kept for API stability).
   */
  variant?: "band" | "card";
  /**
   * When the line editor is embedded, scope primaries are shown as a compact
   * outline/text treatment so they do not compete with the in-page editor.
   */
  demoteScopePrimary?: boolean;
};

const primaryBtn =
  "inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-sky-950/40 hover:bg-sky-500 transition-colors";

const primaryOutline =
  "inline-flex items-center justify-center rounded-md border border-zinc-600 bg-zinc-900/90 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800 transition-colors";

const secondaryBtn =
  "inline-flex items-center justify-center rounded-md border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition-colors";

/**
 * Current-step hero: orient → missing items → primary action (calm, not alarm-styled).
 */
export function QuoteWorkspaceNextActionCard({
  model,
  variant = "band",
  demoteScopePrimary = false,
}: Props) {
  const useDemotedPrimary =
    demoteScopePrimary && model.primary.href.startsWith("/quotes/") && model.primary.href.endsWith("/scope");

  const Primary =
    model.primary.external ?
      <a
        href={model.primary.href}
        target="_blank"
        rel="noopener noreferrer"
        className={useDemotedPrimary ? primaryOutline : primaryBtn}
      >
        {model.primary.label}
      </a>
    : (
      <Link href={model.primary.href} className={useDemotedPrimary ? primaryOutline : primaryBtn}>
        {model.primary.label}
      </Link>
    );

  const Secondary =
    model.secondary ?
      model.secondary.external ?
        <a
          href={model.secondary.href}
          target="_blank"
          rel="noopener noreferrer"
          className={secondaryBtn}
        >
          {model.secondary.label}
        </a>
      : <Link href={model.secondary.href} className={secondaryBtn}>
          {model.secondary.label}
        </Link>
    : null;

  if (variant === "card") {
    return (
      <section
        aria-labelledby="workspace-next-action-heading"
        className="mb-6 rounded-md border border-zinc-700/80 bg-zinc-900/40 p-5 shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Current step</p>
        <h2 id="workspace-next-action-heading" className="mt-1 text-lg font-semibold tracking-tight text-zinc-100">
          {model.headline}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{model.body}</p>
        {model.blockerLine ? (
          <p className="mt-3 rounded-md border border-zinc-700/80 bg-zinc-950/60 px-3 py-2 text-sm leading-snug text-zinc-200">
            <span className="font-medium text-zinc-400">Before you continue: </span>
            {model.blockerLine}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {Primary}
          {Secondary}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="workspace-next-action-heading"
      className="mb-6 border-b border-zinc-800/90 pb-5"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Current step</p>
      <h2 id="workspace-next-action-heading" className="mt-1 text-base font-semibold tracking-tight text-zinc-100 sm:text-lg">
        {model.headline}
      </h2>
      <p className="mt-1.5 max-w-3xl text-sm leading-snug text-zinc-400">{model.body}</p>
      {model.blockerLine ? (
        <p className="mt-3 rounded-md border border-zinc-700/80 bg-zinc-950/60 px-3 py-2 text-sm leading-snug text-zinc-200">
          <span className="font-medium text-zinc-400">Before you continue: </span>
          {model.blockerLine}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {Primary}
        {Secondary}
      </div>
    </section>
  );
}
