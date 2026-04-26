import { redirect } from "next/navigation";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { listCanonicalExecutionStages } from "@/lib/canonical-execution-stages";

export const dynamic = "force-dynamic";

/**
 * Read-only overview of the Canonical Execution Stage Vocabulary (Triangle Mode).
 */
export default async function ExecutionStagesOverviewPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) redirect("/login");

  const stages = listCanonicalExecutionStages();

  return (
    <main className="mx-auto max-w-4xl p-8 text-zinc-200">
      <header className="mb-8 border-b border-zinc-800 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Execution stages</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Struxient v3 uses one canonical stage vocabulary to route work. Catalog packets use these
          stages to place tasks, and workflow templates should stay aligned with these keys to
          ensure valid compose results.
        </p>
      </header>

      <div className="space-y-6">
        {stages.map((stage) => (
          <section
            key={stage.key}
            className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 sm:flex-row sm:items-start"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-400">
              {stage.sortOrder}
            </div>
            <div className="flex-1">
              <h2 className="flex flex-wrap items-baseline gap-2 text-lg font-medium text-zinc-100">
                <span>{stage.label}</span>
                <code className="text-[10px] font-normal text-zinc-600">{stage.key}</code>
              </h2>
              <p className="mt-1 text-sm text-zinc-400">{stage.description}</p>
              
              <div className="mt-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Example tasks
                </h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {stage.examples.map((example) => (
                    <li
                      key={example}
                      className="rounded border border-zinc-800 bg-zinc-950/50 px-2 py-0.5 text-[11px] text-zinc-400"
                    >
                      {example}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-12 rounded-lg border border-dashed border-zinc-800 p-6 text-center">
        <p className="text-xs text-zinc-500 italic">
          Note: This is a read-only vocabulary defined by the system core. Workflow templates and
          packet task lines must use these canonical keys to ensure correct binding during the
          quote compose and activation lifecycle.
        </p>
      </footer>
    </main>
  );
}
