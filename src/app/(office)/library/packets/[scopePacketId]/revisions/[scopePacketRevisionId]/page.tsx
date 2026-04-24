import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddEmbeddedPacketTaskLineForm } from "@/components/catalog-packets/add-embedded-packet-task-line-form";
import { AddLibraryPacketTaskLineForm } from "@/components/catalog-packets/add-library-packet-task-line-form";
import { DeletePacketTaskLineButton } from "@/components/catalog-packets/delete-packet-task-line-button";
import { EditPacketTaskLineForm } from "@/components/catalog-packets/edit-packet-task-line-form";
import { LibraryPacketComposeHintWorkflowProvider } from "@/components/catalog-packets/library-packet-compose-hint-workflow-provider";
import { ReorderPacketTaskLineButtons } from "@/components/catalog-packets/reorder-packet-task-line-buttons";
import { PublishRevisionForm } from "@/components/catalog-packets/publish-revision-form";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { formatLibraryPacketComposeHintWorkflowLabel } from "@/lib/library-packet-compose-hint-workflow";
import { getPrisma } from "@/server/db/prisma";
import { listPublishedWorkflowVersionsForTenant } from "@/server/slice1";
import { getScopePacketRevisionDetailForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { listTaskDefinitionsForTenant } from "@/server/slice1/reads/task-definition-reads";

/**
 * Office-surface packet revision detail: inspector plus a **narrow** Epic 16 slice —
 * add/delete **EMBEDDED** and **LIBRARY** (published TaskDefinition ref) lines on **DRAFT**
 * revisions when the principal has `office_mutate`, and interim publish when readiness is satisfied.
 *
 * Reuses `getScopePacketRevisionDetailForTenant` and the shared readiness
 * predicate (same canon truth as `/dev/...`). Optional compose-hint workflow
 * selection drives `targetNodeKey` pickers (Epic 15 + 16); full catalog designer
 * and graph authoring remain out of scope.
 */
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ scopePacketId: string; scopePacketRevisionId: string }>;
};

const REVISION_STATUS_BADGE: Record<string, string> = {
  DRAFT: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  PUBLISHED: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300",
  SUPERSEDED: "border-zinc-700/80 bg-zinc-900/50 text-zinc-400",
};

const LINE_KIND_BADGE: Record<string, string> = {
  EMBEDDED: "border-sky-800/60 bg-sky-950/30 text-sky-300",
  LIBRARY: "border-violet-800/60 bg-violet-950/30 text-violet-300",
};

const TASK_DEFINITION_STATUS_BADGE: Record<string, string> = {
  DRAFT: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  PUBLISHED: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300",
  ARCHIVED: "border-zinc-700 bg-zinc-900/40 text-zinc-500",
};

export default async function OfficeLibraryPacketRevisionPage({ params }: PageProps) {
  const { scopePacketId, scopePacketRevisionId } = await params;
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const detail = await getScopePacketRevisionDetailForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    scopePacketId,
    scopePacketRevisionId,
  });

  if (!detail) {
    notFound();
  }

  const canMutate = principalHasCapability(auth.principal, "office_mutate");
  const draftAuthoring = canMutate && detail.revision.status === "DRAFT";

  const publishedTaskDefinitions = draftAuthoring
    ? await listTaskDefinitionsForTenant(getPrisma(), {
        tenantId: auth.principal.tenantId,
        limit: 200,
        statuses: ["PUBLISHED"],
      })
    : [];

  const publishedWorkflowHints = draftAuthoring
    ? await listPublishedWorkflowVersionsForTenant(getPrisma(), {
        tenantId: auth.principal.tenantId,
        limit: 100,
      })
    : [];

  const composeHintWorkflowOptions = publishedWorkflowHints.map((v) => ({
    id: v.id,
    label: formatLibraryPacketComposeHintWorkflowLabel(v),
  }));

  const totalLines = detail.packetTaskLines.length;
  const tieredLines = detail.packetTaskLines.filter(
    (l) => l.tierCode != null && l.tierCode !== "",
  ).length;
  const libraryLines = detail.packetTaskLines.filter((l) => l.lineKind === "LIBRARY").length;

  return (
    <main className="mx-auto max-w-5xl p-8 text-zinc-200">
      <nav className="mb-4 text-xs text-zinc-500">
        <Link href="/library/packets" className="hover:text-zinc-300">
          Library packets
        </Link>
        <span className="mx-2 text-zinc-700">/</span>
        <Link
          href={`/library/packets/${detail.scopePacketId}`}
          className="hover:text-zinc-300"
        >
          {detail.packetDisplayName}
        </Link>
        <span className="mx-2 text-zinc-700">/</span>
        <span className="text-zinc-400">r{detail.revision.revisionNumber}</span>
      </nav>

      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-baseline gap-2 text-2xl font-semibold tracking-tight text-zinc-50">
              <span>
                {detail.packetDisplayName} · r{detail.revision.revisionNumber}
              </span>
              <span
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  REVISION_STATUS_BADGE[detail.revision.status] ?? REVISION_STATUS_BADGE.DRAFT
                }`}
              >
                {detail.revision.status}
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  draftAuthoring
                    ? "border-sky-800/60 bg-sky-950/30 text-sky-300"
                    : "border-zinc-700 bg-zinc-950/40 text-zinc-400"
                }`}
              >
                {draftAuthoring ? "Draft authoring" : "Read-only"}
              </span>
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              <code className="text-zinc-400">{detail.packetKey}</code> · publishedAt{" "}
              {detail.revision.publishedAtIso ?? "(draft — not yet published)"} · {totalLines} task
              line{totalLines === 1 ? "" : "s"} ({libraryLines} library /{" "}
              {totalLines - libraryLines} embedded; {tieredLines} tiered)
            </p>
          </div>
          <Link
            href={`/library/packets/${detail.scopePacketId}`}
            className="text-sm text-zinc-500 hover:text-zinc-400"
          >
            ← Back to packet
          </Link>
        </div>
      </header>

      <section className="mb-6 space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Publish readiness
        </h2>
        {detail.publishReadiness.isReady ? (
          <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/20 p-4">
            <p className="text-sm font-semibold text-emerald-300">
              Ready to publish — all canon publish gates satisfied.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-400/80">
              {detail.revision.status === "DRAFT"
                ? draftAuthoring
                  ? "This DRAFT meets all publish gates. You may publish from this page."
                  : "This DRAFT meets all publish gates. Sign in as office admin to publish."
                : `Already PUBLISHED at ${detail.revision.publishedAtIso ?? "(unknown)"}.`}
            </p>
            {draftAuthoring && detail.publishReadiness.isReady ? (
              <PublishRevisionForm
                scopePacketId={detail.scopePacketId}
                scopePacketRevisionId={detail.revision.id}
                revisionNumber={detail.revision.revisionNumber}
              />
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-4">
            <p className="text-sm font-semibold text-amber-300">
              Not ready — {detail.publishReadiness.blockers.length} blocker
              {detail.publishReadiness.blockers.length === 1 ? "" : "s"} found.
            </p>
            <ul className="mt-2 space-y-1.5">
              {detail.publishReadiness.blockers.map((b, i) => (
                <li
                  key={`${b.code}-${b.lineId ?? "rev"}-${i}`}
                  className="rounded border border-amber-900/40 bg-amber-950/30 p-2 text-[12px] text-amber-100"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <code className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                      {b.code}
                    </code>
                    {b.lineKey ? (
                      <span className="text-[11px] text-amber-300/90">
                        line <code className="text-amber-100">{b.lineKey}</code>
                      </span>
                    ) : null}
                    {b.taskDefinitionStatus ? (
                      <span className="text-[11px] text-amber-300/90">
                        TaskDefinition status:{" "}
                        <code className="text-amber-100">{b.taskDefinitionStatus}</code>
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-200/90">{b.message}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-amber-400/70">
              {draftAuthoring
                ? "For greenfield packets, add at least one task line (embedded or library-backed with a published task definition) that satisfies the gates above. Promoted revisions may still need fixes in the source quote-local packet before re-promoting."
                : "Inspection only. Resolve these blockers in the source quote-local packet before re-promoting, or wait for the catalog-edit workflow."}
            </p>
          </div>
        )}
      </section>

      <LibraryPacketComposeHintWorkflowProvider
        enabled={draftAuthoring}
        versionOptions={composeHintWorkflowOptions}
      >
        {draftAuthoring ? (
          <section className="mb-6 space-y-4">
            <AddEmbeddedPacketTaskLineForm
              scopePacketId={detail.scopePacketId}
              scopePacketRevisionId={detail.revision.id}
            />
            <AddLibraryPacketTaskLineForm
              scopePacketId={detail.scopePacketId}
              scopePacketRevisionId={detail.revision.id}
              publishedTaskDefinitions={publishedTaskDefinitions.map((d) => ({
                id: d.id,
                taskKey: d.taskKey,
                displayName: d.displayName,
              }))}
            />
          </section>
        ) : null}

        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Packet task lines
          </h2>
          {detail.packetTaskLines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-sm text-zinc-500">
              This revision has no task lines.
            </p>
          ) : (
            <ul className="space-y-2">
              {detail.packetTaskLines.map((line, lineIndex) => (
                <li
                  key={line.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-semibold text-zinc-100">{line.lineKey}</span>
                      <span className="text-[11px] text-zinc-500">sortOrder {line.sortOrder}</span>
                      <span
                        className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          LINE_KIND_BADGE[line.lineKind] ?? "border-zinc-700 text-zinc-400"
                        }`}
                      >
                        {line.lineKind}
                      </span>
                      {line.tierCode ? (
                        <span className="rounded border border-zinc-700 bg-zinc-950/40 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">
                          tier: {line.tierCode}
                        </span>
                      ) : (
                        <span className="rounded border border-zinc-800 bg-zinc-950/40 px-1.5 py-0.5 text-[10px] text-zinc-500 italic">
                          no tier (applies to all)
                        </span>
                      )}
                    </div>
                    {draftAuthoring && (line.lineKind === "EMBEDDED" || line.lineKind === "LIBRARY") ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {detail.packetTaskLines.length > 1 ? (
                          <ReorderPacketTaskLineButtons
                            scopePacketId={detail.scopePacketId}
                            scopePacketRevisionId={detail.revision.id}
                            packetTaskLineId={line.id}
                            canMoveUp={lineIndex > 0}
                            canMoveDown={lineIndex < detail.packetTaskLines.length - 1}
                          />
                        ) : null}
                        <DeletePacketTaskLineButton
                          scopePacketId={detail.scopePacketId}
                          scopePacketRevisionId={detail.revision.id}
                          packetTaskLineId={line.id}
                          lineKey={line.lineKey}
                        />
                      </div>
                    ) : null}
                  </div>

                  {line.lineKind === "LIBRARY" && (
                    <div className="mt-2 text-[11px] text-zinc-400">
                      {line.taskDefinition ? (
                        <span className="inline-flex flex-wrap items-baseline gap-2">
                          <Link
                            href={`/library/task-definitions/${line.taskDefinition.id}`}
                            className="text-zinc-300 hover:text-sky-400"
                          >
                            {line.taskDefinition.displayName}
                          </Link>
                          <code className="text-zinc-500">{line.taskDefinition.taskKey}</code>
                          <span
                            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                              TASK_DEFINITION_STATUS_BADGE[line.taskDefinition.status] ??
                              "border-zinc-700 text-zinc-400"
                            }`}
                          >
                            {line.taskDefinition.status}
                          </span>
                        </span>
                      ) : (
                        <span className="text-amber-400/80">
                          LIBRARY line with no taskDefinition — the source TaskDefinition may have
                          been removed. This will block publish.
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-2 text-[11px] text-zinc-500">
                    targetNodeKey: <code className="text-zinc-300">{line.targetNodeKey}</code>
                  </div>

                  <div className="mt-2 text-[11px] text-zinc-500">
                    embeddedPayload:{" "}
                    {line.hasEmbeddedPayload ? (
                      <span className="text-zinc-300">present</span>
                    ) : (
                      <span className="text-zinc-500 italic">empty</span>
                    )}
                  </div>

                  {draftAuthoring && (line.lineKind === "EMBEDDED" || line.lineKind === "LIBRARY") ? (
                    <EditPacketTaskLineForm
                      scopePacketId={detail.scopePacketId}
                      scopePacketRevisionId={detail.revision.id}
                      packetTaskLineId={line.id}
                      lineKind={line.lineKind}
                      initialTargetNodeKey={line.targetNodeKey}
                      initialTierCode={line.tierCode}
                      embeddedPayloadJson={line.embeddedPayloadJson}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </LibraryPacketComposeHintWorkflowProvider>
    </main>
  );
}
