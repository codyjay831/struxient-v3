import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type {
  CompletionRequirement,
  CompletionRequirementKind,
} from "@/lib/task-definition-authored-requirements";
import type {
  ConditionalRule,
  ConditionalRuleRequire,
  ConditionalRuleTrigger,
} from "@/lib/task-definition-conditional-rules";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { getTaskDefinitionDetailForTenant } from "@/server/slice1/reads/task-definition-reads";
import { TaskDefinitionEditor } from "@/components/task-definitions/task-definition-editor";

/**
 * Office-surface TaskDefinition detail.
 *
 * Reuses `getTaskDefinitionDetailForTenant` and the parsed durable shapes
 * (`CompletionRequirement`, `ConditionalRule`) returned by the read model —
 * same canon truth surfaced on `/dev/task-definitions`.
 *
 * Authoring posture:
 *   • Principals with `office_mutate` get the full `TaskDefinitionEditor` —
 *     the same client component used by the dev surface. The editor itself
 *     enforces the DRAFT-only content-edit guard client-side and the API
 *     route enforces it again server-side, so PUBLISHED/ARCHIVED definitions
 *     show their truth read-only with explicit status-transition controls.
 *   • Principals without `office_mutate` get a focused read-only inspector.
 *
 * Canon: TaskDefinition content is **frozen into**
 * `executionPackageSnapshot.v0` at quote SEND. Edits to a definition
 * therefore never disturb already-frozen quote versions or RuntimeTask rows.
 */
export const dynamic = "force-dynamic";

const OFFICE_ROUTE_PREFIX = "/library/task-definitions";

type PageProps = { params: Promise<{ taskDefinitionId: string }> };

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  PUBLISHED: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300",
  ARCHIVED: "border-zinc-700 bg-zinc-900/40 text-zinc-500",
};

const KIND_LABEL: Record<CompletionRequirementKind, string> = {
  checklist: "Checklist",
  measurement: "Measurement",
  identifier: "Identifier",
  result: "Result (PASS / FAIL gate)",
  note: "Note",
  attachment: "Attachment",
};

function describeTrigger(trigger: ConditionalRuleTrigger): string {
  if (trigger.kind === "result") {
    return `Result is ${trigger.value}`;
  }
  return `Checklist "${trigger.label}" answered ${trigger.value.toUpperCase()}`;
}

function describeRequire(require: ConditionalRuleRequire): string {
  switch (require.kind) {
    case "note":
      return "a completion note";
    case "attachment":
      return "an attachment";
    case "measurement":
      return `a measurement for "${require.label}"`;
    case "identifier":
      return `an identifier for "${require.label}"`;
  }
}

function RequirementRow({ req }: { req: CompletionRequirement }) {
  const label = (() => {
    switch (req.kind) {
      case "checklist":
      case "measurement":
      case "identifier":
        return req.label && req.label.trim() ? req.label : <span className="text-zinc-500 italic">(no label)</span>;
      case "result":
      case "note":
      case "attachment":
        return <span className="text-zinc-500 italic">singleton — no label</span>;
    }
  })();

  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="rounded border border-zinc-700 bg-zinc-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
            {KIND_LABEL[req.kind]}
          </span>
          <span className="text-sm text-zinc-100">{label}</span>
          {req.kind === "measurement" && req.unit ? (
            <span className="text-[11px] text-zinc-500">
              unit: <code className="text-zinc-300">{req.unit}</code>
            </span>
          ) : null}
        </div>
        <span
          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            req.required
              ? "border-sky-800/60 bg-sky-950/30 text-sky-300"
              : "border-zinc-700 bg-zinc-950/40 text-zinc-400"
          }`}
        >
          {req.required ? "Required" : "Optional"}
        </span>
      </div>
    </li>
  );
}

function ConditionalRuleRow({ rule }: { rule: ConditionalRule }) {
  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <code className="text-[10px] text-zinc-500">{rule.id}</code>
      </div>
      <p className="mt-1 text-sm text-zinc-200">
        When <span className="text-zinc-100 font-medium">{describeTrigger(rule.trigger)}</span>,{" "}
        require <span className="text-zinc-100 font-medium">{describeRequire(rule.require)}</span>
        .
      </p>
      {"message" in rule.require && rule.require.message ? (
        <p className="mt-1 text-[11px] italic text-zinc-500">
          Operator message: {rule.require.message}
        </p>
      ) : null}
    </li>
  );
}

export default async function OfficeLibraryTaskDefinitionDetailPage({ params }: PageProps) {
  const { taskDefinitionId } = await params;
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const detail = await getTaskDefinitionDetailForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    taskDefinitionId,
  });
  if (!detail) {
    notFound();
  }

  const canMutate = principalHasCapability(auth.principal, "office_mutate");
  const totalRefs = detail.packetTaskLineRefCount + detail.quoteLocalPacketItemRefCount;

  return (
    <main className="mx-auto max-w-4xl p-8 text-zinc-200">
      <nav className="mb-4 text-xs text-zinc-500">
        <Link href={OFFICE_ROUTE_PREFIX} className="hover:text-zinc-300">
          Task definitions
        </Link>
        <span className="mx-2 text-zinc-700">/</span>
        <span className="text-zinc-400">{detail.displayName}</span>
      </nav>

      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-baseline gap-2 text-2xl font-semibold tracking-tight text-zinc-50">
              <span>{detail.displayName}</span>
              <code className="text-sm font-normal text-zinc-500">{detail.taskKey}</code>
              <span
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  STATUS_BADGE[detail.status] ?? STATUS_BADGE.DRAFT
                }`}
              >
                {detail.status}
              </span>
              {canMutate && detail.status === "DRAFT" ? (
                <span className="rounded border border-sky-800/60 bg-sky-950/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                  Editable
                </span>
              ) : (
                <span className="rounded border border-zinc-700 bg-zinc-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  {canMutate ? "Status-only edits" : "Read-only"}
                </span>
              )}
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              {detail.requirementsCount} requirement{detail.requirementsCount === 1 ? "" : "s"}
              {" · "}
              {detail.conditionalRulesCount} conditional rule
              {detail.conditionalRulesCount === 1 ? "" : "s"}
              {" · "}
              Referenced by {totalRefs} ({detail.packetTaskLineRefCount} catalog packet line
              {detail.packetTaskLineRefCount === 1 ? "" : "s"},{" "}
              {detail.quoteLocalPacketItemRefCount} quote-local packet item
              {detail.quoteLocalPacketItemRefCount === 1 ? "" : "s"}).{" "}
              {totalRefs > 0 ? (
                <span className="text-zinc-400">
                  Existing references stay stable — content is frozen into quotes at send time.
                </span>
              ) : null}
            </p>
          </div>
          <Link
            href={OFFICE_ROUTE_PREFIX}
            className="text-sm text-zinc-500 hover:text-zinc-400"
          >
            ← All task definitions
          </Link>
        </div>
      </header>

      {canMutate ? (
        <TaskDefinitionEditor
          mode="edit"
          routePrefix={OFFICE_ROUTE_PREFIX}
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
      ) : (
        <ReadOnlyInspector detail={detail} />
      )}
    </main>
  );
}

function ReadOnlyInspector({
  detail,
}: {
  detail: {
    instructions: string | null;
    completionRequirements: CompletionRequirement[];
    conditionalRules: ConditionalRule[];
  };
}) {
  return (
    <>
      {detail.instructions && detail.instructions.trim() ? (
        <section className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Instructions
          </h2>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
              {detail.instructions}
            </p>
          </div>
        </section>
      ) : null}

      <section className="mb-6 space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Completion requirements
        </h2>
        {detail.completionRequirements.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-sm text-zinc-500">
            No requirements authored yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {detail.completionRequirements.map((req, i) => (
              <RequirementRow key={`${req.kind}-${i}`} req={req} />
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Conditional rules
        </h2>
        {detail.conditionalRules.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-sm text-zinc-500">
            No conditional rules authored yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {detail.conditionalRules.map((rule) => (
              <ConditionalRuleRow key={rule.id} rule={rule} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
