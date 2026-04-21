import Link from "next/link";
import { notFound } from "next/navigation";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { TaskDefinitionEditor } from "@/components/task-definitions/task-definition-editor";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { getTaskDefinitionDetailForTenant } from "@/server/slice1/reads/task-definition-reads";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ taskDefinitionId: string }> };

export default async function DevTaskDefinitionDetailPage(context: RouteContext) {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-zinc-300">
          Sign in at{" "}
          <Link href="/dev/login" className="text-sky-400">
            /dev/login
          </Link>
          .
        </p>
      </main>
    );
  }

  const { taskDefinitionId } = await context.params;
  const detail = await getTaskDefinitionDetailForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    taskDefinitionId,
  });
  if (!detail) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 text-sky-400">
          <div>
            <InternalBreadcrumb
              category="Commercial"
              segments={[
                { label: "Task definitions", href: "/dev/task-definitions" },
                { label: detail.displayName },
              ]}
            />
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">
              {detail.displayName}
            </h1>
            <p className="mt-1 font-mono text-[11px] text-zinc-500">{detail.taskKey}</p>
          </div>
          <Link href="/dev/task-definitions" className="text-sm text-zinc-500 hover:text-zinc-400">
            ← Library
          </Link>
        </div>
      </header>

      <TaskDefinitionEditor
        mode="edit"
        initial={{
          id: detail.id,
          taskKey: detail.taskKey,
          displayName: detail.displayName,
          status: detail.status,
          instructions: detail.instructions,
          completionRequirements: detail.completionRequirements,
          conditionalRules: detail.conditionalRules,
        }}
      />
    </main>
  );
}
