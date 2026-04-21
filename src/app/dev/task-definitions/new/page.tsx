import Link from "next/link";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { TaskDefinitionEditor } from "@/components/task-definitions/task-definition-editor";

export const dynamic = "force-dynamic";

export default function DevNewTaskDefinitionPage() {
  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 text-sky-400">
          <div>
            <InternalBreadcrumb
              category="Commercial"
              segments={[
                { label: "Task definitions", href: "/dev/task-definitions" },
                { label: "New" },
              ]}
            />
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">
              New task definition
            </h1>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">
              Create a curated authored standard. After creation it starts in DRAFT — you can edit
              freely, then publish when ready.
            </p>
          </div>
          <Link href="/dev/task-definitions" className="text-sm text-zinc-500 hover:text-zinc-400">
            ← Library
          </Link>
        </div>
      </header>

      <TaskDefinitionEditor
        mode="create"
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
