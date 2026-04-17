import Link from "next/link";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { getPrisma } from "@/server/db/prisma";
import { getFlowExecutionReadModel } from "@/server/slice1/reads/flow-execution";
import { toFlowExecutionApiDto } from "@/lib/flow-execution-dto";
import { InvariantViolationError } from "@/server/slice1/errors";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { WorkFeedClient } from "./work-feed-client";

type PageProps = { params: Promise<{ flowId: string }> };

export const dynamic = "force-dynamic";

export default async function DevWorkFeedPage({ params }: PageProps) {
  const { flowId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    if (auth.failure.kind === "bypass_misconfigured") {
      return (
        <main className="mx-auto max-w-2xl p-8">
          <p className="text-amber-400">
            <code className="text-zinc-200">STRUXIENT_DEV_AUTH_BYPASS</code> is set but{" "}
            <code className="text-zinc-200">STRUXIENT_DEV_TENANT_ID</code> or{" "}
            <code className="text-zinc-200">STRUXIENT_DEV_USER_ID</code> is missing. Fix <code className="text-zinc-200">.env.local</code>{" "}
            or sign in at <Link href="/dev/login">/dev/login</Link>.
          </p>
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <p className="text-zinc-300">Sign in to load this page (same session cookies as the API).</p>
        <Link href="/dev/login" className="inline-block text-sm text-sky-400">
          /dev/login
        </Link>
        <p className="text-xs text-zinc-500">
          Local alternative: set <code className="text-zinc-400">STRUXIENT_DEV_AUTH_BYPASS=true</code> with tenant/user ids from seed
          (non-production only).
        </p>
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
    const canExecuteTasks = principalHasCapability(auth.principal, "field_execute");

    return (
      <main className="mx-auto max-w-2xl p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-lg font-medium text-zinc-100">Work feed (dev)</h1>
          <div className="flex gap-3">
            <Link href={`/dev/flow/${flowId}`} className="text-xs text-zinc-500 hover:text-zinc-300">
              JSON view
            </Link>
            <Link href="/" className="text-sm text-sky-400 hover:text-sky-300">
              Home
            </Link>
          </div>
        </div>
        <p className="mb-6 text-xs leading-relaxed text-zinc-500">
          Uses <code className="text-zinc-400">workItems</code> + <code className="text-zinc-400">actionability</code> from the
          server read model; Start/Complete call the same POST routes as production. Auth:{" "}
          <code className="text-zinc-400">{auth.principal.authSource}</code> (tenant from membership).
        </p>
        <WorkFeedClient flowId={flowId} initialData={dto} canExecuteTasks={canExecuteTasks} />
      </main>
    );
  } catch (e) {
    if (e instanceof PrismaClientInitializationError) {
      return (
        <main className="mx-auto max-w-2xl space-y-4 p-8">
          <p className="font-medium text-red-400">Database connection failed</p>
          <p className="text-sm text-zinc-400">{e.message}</p>
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
        </main>
      );
    }
    throw e;
  }
}
