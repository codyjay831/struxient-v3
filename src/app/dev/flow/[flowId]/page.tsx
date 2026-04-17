import Link from "next/link";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { getPrisma } from "@/server/db/prisma";
import { getFlowExecutionReadModel } from "@/server/slice1/reads/flow-execution";
import { toFlowExecutionApiDto } from "@/lib/flow-execution-dto";
import { InvariantViolationError } from "@/server/slice1/errors";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";

type PageProps = { params: Promise<{ flowId: string }> };

export const dynamic = "force-dynamic";

export default async function DevFlowExecutionPage({ params }: PageProps) {
  const { flowId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <p className="text-zinc-300">Sign in at <Link href="/dev/login" className="text-sky-400">/dev/login</Link> or enable dev auth bypass (see .env.example).</p>
        <Link href="/dev/flow" className="inline-block text-sm text-sky-400">
          Instructions
        </Link>
      </main>
    );
  }

  try {
    const model = await getFlowExecutionReadModel(getPrisma(), {
      tenantId: auth.principal.tenantId,
      flowId,
    });

    if (!model) {
      return (
        <main className="mx-auto max-w-2xl p-8">
          <p className="text-zinc-400">Flow not found for this tenant.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-sky-400">
            Home
          </Link>
        </main>
      );
    }

    const dto = toFlowExecutionApiDto(model);

    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-lg font-medium text-zinc-100">Flow execution</h1>
          <Link href="/" className="text-sm text-sky-400 hover:text-sky-300">
            Home
          </Link>
        </div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">GET …/api/flows/{flowId}</p>
        <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 text-xs leading-relaxed text-zinc-300">
          {JSON.stringify(dto, null, 2)}
        </pre>
        <p className="mt-4 text-xs text-zinc-500">
          Tenant from session/bypass. Job <code className="text-zinc-400">{dto.flow.jobId}</code>.
        </p>
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
              <code className="text-zinc-400">.env.local</code>.
            </li>
            <li>Confirm Postgres is running.</li>
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
