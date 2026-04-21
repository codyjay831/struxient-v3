import Link from "next/link";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { InternalNotFoundState } from "@/components/internal/internal-state-feedback";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { getPrisma } from "@/server/db/prisma";
import { getFlowExecutionReadModel } from "@/server/slice1/reads/flow-execution";
import { getFlowDiscoveryItemForTenant } from "@/server/slice1/reads/flow-discovery-reads";
import { toFlowExecutionApiDto } from "@/lib/flow-execution-dto";
import { InvariantViolationError } from "@/server/slice1/errors";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { FlowExecutionPageHeader } from "@/components/internal/flow-execution-page-header";
import { ExecutionWorkFeed } from "@/components/execution/execution-work-feed";
import { FlowShareControls } from "@/components/execution/flow-share-controls";

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
            <code className="text-zinc-200">STRUXIENT_DEV_USER_ID</code> is missing. Fix{" "}
            <code className="text-zinc-200">.env.local</code> or sign in at{" "}
            <Link href="/dev/login">/dev/login</Link>.
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
          Local alternative: set <code className="text-zinc-400">STRUXIENT_DEV_AUTH_BYPASS=true</code> with
          tenant/user ids from seed (non-production only).
        </p>
      </main>
    );
  }

  try {
    const prisma = getPrisma();
    const [model, context] = await Promise.all([
      getFlowExecutionReadModel(prisma, { tenantId: auth.principal.tenantId, flowId }),
      getFlowDiscoveryItemForTenant(prisma, { tenantId: auth.principal.tenantId, flowId }),
    ]);

    if (!model) {
      return (
        <main className="mx-auto max-w-4xl px-4 py-8 text-zinc-200 sm:px-6 lg:px-8">
          <header className="mb-6 border-b border-zinc-800 pb-5">
            <InternalBreadcrumb
              category="Execution"
              segments={[{ label: "Flows", href: "/dev/flows" }, { label: "Work feed not found" }]}
            />
          </header>
          <InternalNotFoundState
            title="Work feed not found"
            message="This execution record is not visible to your tenant. It may belong to another tenant or no longer exist."
            backLink={{ href: "/dev/flows", label: "← Activated flows" }}
          />
        </main>
      );
    }

    const dto = toFlowExecutionApiDto(model);
    const canExecuteTasks = principalHasCapability(auth.principal, "field_execute");
    const canReviewTasks = principalHasCapability(auth.principal, "office_mutate");

    return (
      <main className="mx-auto max-w-3xl p-8 text-zinc-200">
        <FlowExecutionPageHeader
          surfaceLabel="Execution work feed"
          purpose="Start and complete the work items for this activated flow. Skeleton tasks come from the workflow snapshot; runtime tasks come from the activated package. Actions use the same APIs as production and respect your role."
          activeRoute="work-feed"
          context={context}
          flowId={flowId}
        />

        <div className="mb-6">
          <FlowShareControls 
            flowId={flowId} 
            share={dto.flow} 
            customer={dto.customer}
            project={dto.project}
            tenant={dto.tenant}
            deliveries={dto.deliveries} 
          />
        </div>

        <p className="mb-4 text-[11px] text-zinc-500">
          Auth source: <code className="text-zinc-400">{auth.principal.authSource}</code> · session-driven
          start/complete.
        </p>

        <ExecutionWorkFeed 
          flowId={flowId} 
          initialData={dto} 
          canExecuteTasks={canExecuteTasks} 
          canReviewTasks={canReviewTasks}
        />
      </main>
    );
  } catch (e) {
    if (e instanceof PrismaClientInitializationError) {
      return (
        <main className="mx-auto max-w-2xl space-y-4 p-8">
          <p className="font-medium text-red-400">Database connection failed</p>
          <p className="text-sm text-zinc-400">{e.message}</p>
          <Link href="/" className="inline-block text-sm text-sky-400">
            ← Hub
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
            ← Hub
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
