import Link from "next/link";
import { getPrisma } from "@/server/db/prisma";
import { searchOfficeTenantAnchors } from "@/server/slice1/reads/office-tenant-search-reads";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function OfficeSearchPage({ searchParams }: PageProps) {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const { q } = await searchParams;
  const model = await searchOfficeTenantAnchors(getPrisma(), {
    tenantId: auth.principal.tenantId,
    query: q ?? "",
  });

  const totalHits = model.sections.reduce((n, s) => n + s.hits.length, 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Search</h1>
      <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
        Quick substring search over this tenant&apos;s customers, quotes, projects, jobs, flows, and library
        catalog entries. This is not full-text or semantic search — refine your query if results are noisy.
      </p>

      <form method="get" action="/search" className="mt-8 flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          name="q"
          defaultValue={model.needle}
          placeholder="At least 2 characters (e.g. quote #, customer name, packet key)"
          minLength={2}
          maxLength={80}
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-600/40"
        />
        <button
          type="submit"
          className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-600 transition-colors"
        >
          Search
        </button>
      </form>

      {model.refusal === "too_short" ? (
        <p className="mt-6 text-sm text-amber-200/90">
          Enter at least 2 characters to search. For quote numbers or ids, include enough digits to be specific.
        </p>
      ) : null}
      {model.refusal === "too_long" ? (
        <p className="mt-6 text-sm text-amber-200/90">Query is too long (max 80 characters). Shorten and try again.</p>
      ) : null}
      {model.refusal == null && model.needle === "" ? (
        <p className="mt-6 text-sm text-zinc-500">Enter a search term above to find records in your workspace.</p>
      ) : null}

      {model.refusal == null && model.needle !== "" && totalHits === 0 ? (
        <p className="mt-8 text-sm text-zinc-400">
          No matches — try a quote number, customer name, project name, job id prefix, or a library packet / task
          key.
        </p>
      ) : null}

      {model.refusal == null && model.needle !== "" && totalHits > 0 ? (
        <div className="mt-10 space-y-10">
          {model.sections.map((section) =>
            section.hits.length === 0 ? null : (
              <section key={section.kind}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{section.label}</h2>
                <ul className="mt-3 divide-y divide-zinc-800/80 rounded-lg border border-zinc-800 bg-zinc-900/30">
                  {section.hits.map((hit) => (
                    <li key={`${hit.kind}:${hit.id}`}>
                      <Link
                        href={hit.href}
                        className="flex flex-col gap-0.5 px-4 py-3 hover:bg-zinc-800/40 transition-colors"
                      >
                        <span className="text-sm font-medium text-zinc-100">{hit.title}</span>
                        {hit.subtitle ? (
                          <span className="text-xs text-zinc-500 font-mono truncate">{hit.subtitle}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
