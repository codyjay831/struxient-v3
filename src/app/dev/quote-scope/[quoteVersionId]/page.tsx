import Link from "next/link";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { getPrisma } from "@/server/db/prisma";
import { getQuoteVersionScopeReadModel } from "@/server/slice1/reads/quote-version-scope";
import { InvariantViolationError } from "@/server/slice1/errors";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { toQuoteVersionScopeApiDto } from "@/lib/quote-version-scope-dto";
import { getQuoteVersionLifecycleReadModel } from "@/server/slice1/reads/quote-version-lifecycle";
import { toQuoteVersionLifecycleApiDto } from "@/lib/quote-version-lifecycle-dto";

type PageProps = { params: Promise<{ quoteVersionId: string }> };

export const dynamic = "force-dynamic";

export default async function DevQuoteScopePage({ params }: PageProps) {
  const { quoteVersionId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <p className="text-zinc-300">Sign in at <Link href="/dev/login" className="text-sky-400">/dev/login</Link> or enable dev auth bypass (see .env.example).</p>
        <Link href="/dev/quote-scope" className="inline-block text-sm text-sky-400">
          Instructions
        </Link>
      </main>
    );
  }

  try {
    const model = await getQuoteVersionScopeReadModel(getPrisma(), {
      tenantId: auth.principal.tenantId,
      quoteVersionId,
    });

    if (!model) {
      return (
        <main className="mx-auto max-w-2xl p-8">
          <p className="text-zinc-400">Quote version not found for this tenant.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-sky-400">
            Home
          </Link>
        </main>
      );
    }

    const dto = toQuoteVersionScopeApiDto(model);

    const lifecycleModel = await getQuoteVersionLifecycleReadModel(getPrisma(), {
      tenantId: auth.principal.tenantId,
      quoteVersionId,
    });
    const lifecycleDto = lifecycleModel ? toQuoteVersionLifecycleApiDto(lifecycleModel) : null;

    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-lg font-medium text-zinc-100">Quote version scope</h1>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href={`/dev/quotes/${model.quoteId}`}
              className="text-sky-400 hover:text-sky-300"
            >
              ← Quote workspace
            </Link>
            <Link href="/dev/quotes" className="text-zinc-500 hover:text-zinc-400">
              All quotes
            </Link>
            <Link href="/" className="text-zinc-500 hover:text-zinc-400">
              Hub
            </Link>
          </div>
        </div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">GET …/scope</p>
        <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 text-xs leading-relaxed text-zinc-300">
          {JSON.stringify(dto, null, 2)}
        </pre>
        <p className="mt-4 text-xs text-zinc-500">
          Ordered lines follow QV-5 (group sort, line sort, id). Tenant from session/bypass.
        </p>
        {lifecycleDto ? (
          <>
            <p className="mb-2 mt-8 text-xs font-medium uppercase tracking-wide text-zinc-500">GET …/lifecycle</p>
            <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 text-xs leading-relaxed text-zinc-300">
              {JSON.stringify(lifecycleDto, null, 2)}
            </pre>
          </>
        ) : null}
      </main>
    );
  } catch (e) {
    if (e instanceof PrismaClientInitializationError) {
      return (
        <main className="mx-auto max-w-2xl space-y-4 p-8">
          <p className="font-medium text-red-400">Database connection failed</p>
          <p className="text-sm text-zinc-400">{e.message}</p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-500">
            <li>
              Put <code className="text-zinc-400">DATABASE_URL</code> in <code className="text-zinc-400">.env</code> or{" "}
              <code className="text-zinc-400">.env.local</code> (same folder as <code className="text-zinc-400">package.json</code>).
            </li>
            <li>Confirm Postgres is running and reachable from this machine.</li>
            <li>Restart <code className="text-zinc-400">npm run dev</code> after changing env files.</li>
          </ul>
          <Link href="/" className="inline-block text-sm text-sky-400">
            Home
          </Link>
        </main>
      );
    }
    if (e instanceof Error && e.message.startsWith("[Struxient] DATABASE_URL")) {
      return (
        <main className="mx-auto max-w-2xl space-y-4 p-8">
          <p className="font-medium text-amber-400">Missing DATABASE_URL</p>
          <p className="text-sm text-zinc-400">{e.message}</p>
          <Link href="/" className="inline-block text-sm text-sky-400">
            Home
          </Link>
        </main>
      );
    }
    if (e instanceof InvariantViolationError) {
      return (
        <main className="mx-auto max-w-2xl p-8">
          <p className="font-medium text-red-400">Invariant violation: {e.code}</p>
          <p className="mt-2 text-sm text-zinc-400">{e.message}</p>
          {e.context ? (
            <pre className="mt-4 overflow-x-auto rounded border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
              {JSON.stringify(e.context, null, 2)}
            </pre>
          ) : null}
        </main>
      );
    }
    throw e;
  }
}
