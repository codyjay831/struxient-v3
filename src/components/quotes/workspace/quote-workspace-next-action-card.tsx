import Link from "next/link";
import type { QuoteWorkspaceNextActionView } from "@/lib/workspace/quote-workspace-next-action";

type Props = {
  model: QuoteWorkspaceNextActionView;
};

/**
 * First-screen command center: status, next action, blocker, primary CTA.
 */
export function QuoteWorkspaceNextActionCard({ model }: Props) {
  if (model.cardLayout === "hidden") {
    return null;
  }

  const Primary = model.primary.external ? (
    <a
      href={model.primary.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-sky-950/40 hover:bg-sky-500 transition-colors"
    >
      {model.primary.label}
    </a>
  ) : (
    <Link
      href={model.primary.href}
      className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-sky-950/40 hover:bg-sky-500 transition-colors"
    >
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
          className="inline-flex items-center justify-center rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          {model.secondary.label}
        </a>
      : <Link
          href={model.secondary.href}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          {model.secondary.label}
        </Link>
    : null;

  return (
    <section
      aria-labelledby="workspace-next-action-heading"
      className="mb-6 rounded-xl border border-sky-800/40 bg-gradient-to-br from-sky-950/50 to-zinc-950/80 p-5 shadow-md shadow-black/20"
    >
      <h2 id="workspace-next-action-heading" className="text-lg font-semibold tracking-tight text-sky-100">
        {model.headline}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{model.body}</p>
      {model.blockerLine ? (
        <p className="mt-3 rounded-md border border-amber-900/35 bg-amber-950/25 px-3 py-2 text-xs leading-snug text-amber-100/95">
          <span className="font-semibold text-amber-200/95">Needs attention: </span>
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
