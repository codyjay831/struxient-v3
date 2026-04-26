import Link from "next/link";
import { redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { TaskDefinitionEditor } from "@/components/task-definitions/task-definition-editor";

/**
 * Office-surface "+ New task definition" page.
 *
 * Reuses the existing `TaskDefinitionEditor` (single source of truth for
 * authoring logic, validation, and submit wiring). The editor posts to
 * `/api/task-definitions` which already enforces the `office_mutate`
 * capability + tenant scope on the server. We pass `routePrefix` so the
 * post-create redirect lands on the office detail page rather than the dev
 * surface.
 *
 * Canon: TaskDefinition content is reusable authoring truth — it is *frozen
 * into* `executionPackageSnapshot.v0` at quote SEND, not read live during
 * activation. Creating new DRAFT definitions cannot disturb any existing
 * frozen quote version, RuntimeTask, or PUBLISHED packet revision.
 */
export const dynamic = "force-dynamic";

const OFFICE_ROUTE_PREFIX = "/library/task-definitions";

export default async function OfficeNewTaskDefinitionPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }
  if (!principalHasCapability(auth.principal, "office_mutate")) {
    redirect(OFFICE_ROUTE_PREFIX);
  }

  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <nav className="mb-4 text-xs text-zinc-500">
        <Link href={OFFICE_ROUTE_PREFIX} className="hover:text-zinc-300">
          Task definitions
        </Link>
        <span className="mx-2 text-zinc-700">/</span>
        <span className="text-zinc-400">New</span>
      </nav>

      <header className="mb-6 border-b border-zinc-800 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          New task definition
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          A reusable unit of field work. Author the completion requirements that the
          field tech will see, and any conditional rules that demand extra evidence
          based on outcomes. Definitions start in <strong>Draft</strong> — you can
          edit freely, then publish when the standard is ready to be referenced by
          packet lines.
        </p>
      </header>

      <TaskDefinitionEditor
        mode="create"
        routePrefix={OFFICE_ROUTE_PREFIX}
        initial={{
          taskKey: "",
          displayName: "",
          status: "DRAFT",
          instructions: null,
          completionRequirements: [],
          conditionalRules: [],
        }}
      />
    </main>
  );
}
