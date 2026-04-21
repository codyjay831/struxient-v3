import Link from "next/link";
import { ForkRevisionForm } from "@/components/catalog-packets/fork-revision-form";
import { PublishRevisionForm } from "@/components/catalog-packets/publish-revision-form";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { InternalNotFoundState } from "@/components/internal/internal-state-feedback";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { getScopePacketRevisionDetailForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ scopePacketId: string; scopePacketRevisionId: string }>;
};

const REVISION_STATUS_BADGE: Record<string, string> = {
  DRAFT: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  PUBLISHED: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300",
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

export default async function DevCatalogPacketRevisionPage({ params }: PageProps) {
  const { scopePacketId, scopePacketRevisionId } = await params;
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <p className="text-zinc-300">
          Sign in at{" "}
          <Link href="/dev/login" className="text-sky-400">
            /dev/login
          </Link>{" "}
          or enable dev auth bypass.
        </p>
        <Link href="/" className="inline-block text-sm text-sky-400">
          ← Hub
        </Link>
      </main>
    );
  }

  const detail = await getScopePacketRevisionDetailForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    scopePacketId,
    scopePacketRevisionId,
  });

  if (!detail) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 text-zinc-200 sm:px-6 lg:px-8">
        <header className="mb-6 border-b border-zinc-800 pb-5">
          <InternalBreadcrumb
            category="Commercial"
            segments={[
              { label: "Catalog packets", href: "/dev/catalog-packets" },
              {
                label: "Packet",
                href: `/dev/catalog-packets/${scopePacketId}`,
              },
              { label: "Revision not found" },
            ]}
          />
        </header>
        <InternalNotFoundState
          title="Catalog revision not found"
          message="This revision is not visible to your tenant or does not belong to the supplied packet."
          backLink={{
            href: `/dev/catalog-packets/${scopePacketId}`,
            label: "← Back to packet",
          }}
        />
      </main>
    );
  }

  const totalLines = detail.packetTaskLines.length;
  const tieredLines = detail.packetTaskLines.filter(
    (l) => l.tierCode != null && l.tierCode !== "",
  ).length;
  const libraryLines = detail.packetTaskLines.filter((l) => l.lineKind === "LIBRARY").length;

  return (
    <main className="mx-auto max-w-5xl p-8 text-zinc-200">
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <InternalBreadcrumb
              category="Commercial"
              segments={[
                { label: "Catalog packets", href: "/dev/catalog-packets" },
                {
                  label: detail.packetDisplayName,
                  href: `/dev/catalog-packets/${detail.scopePacketId}`,
                },
                { label: `Revision r${detail.revision.revisionNumber}` },
              ]}
            />
            <h1 className="mt-2 flex flex-wrap items-baseline gap-2 text-xl font-semibold tracking-tight text-zinc-50">
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
              <span className="rounded border border-zinc-700 bg-zinc-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Read-only
              </span>
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              <code className="text-zinc-400">{detail.packetKey}</code> · publishedAt{" "}
              {detail.revision.publishedAtIso ?? "(draft — not yet published)"} · {totalLines} task line
              {totalLines === 1 ? "" : "s"} ({libraryLines} library / {totalLines - libraryLines}{" "}
              embedded; {tieredLines} tiered)
            </p>
          </div>
          <Link
            href={`/dev/catalog-packets/${detail.scopePacketId}`}
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
            {detail.revision.status === "DRAFT" ? (
              <PublishRevisionForm
                scopePacketId={detail.scopePacketId}
                scopePacketRevisionId={detail.revision.id}
                revisionNumber={detail.revision.revisionNumber}
              />
            ) : (
              <p className="mt-1 text-[11px] leading-relaxed text-emerald-400/80">
                Already PUBLISHED at {detail.revision.publishedAtIso ?? "(unknown)"}. The
                publish action is unavailable for non-DRAFT revisions; un-publish remains
                deferred to a later epic.
              </p>
            )}
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
              Inspection only. No edit or publish action is available in this slice — surface these
              blockers in the source <code>QuoteLocalPacket</code> before promotion, or wait for the
              forthcoming catalog-edit epic.
            </p>
          </div>
        )}
      </section>

      {detail.revision.status === "PUBLISHED" ? (
        <ForkRevisionForm
          scopePacketId={detail.scopePacketId}
          scopePacketRevisionId={detail.revision.id}
          revisionNumber={detail.revision.revisionNumber}
          defaultDisplayName={detail.packetDisplayName}
        />
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
            {detail.packetTaskLines.map((line) => (
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
                </div>

                {line.lineKind === "LIBRARY" && (
                  <div className="mt-2 text-[11px] text-zinc-400">
                    {line.taskDefinition ? (
                      <span className="inline-flex flex-wrap items-baseline gap-2">
                        <span className="text-zinc-300">
                          {line.taskDefinition.displayName}
                        </span>
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
                        LIBRARY line with no taskDefinition (id ={" "}
                        <code>{line.taskDefinitionId ?? "null"}</code>)
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

                {line.hasEmbeddedPayload && (
                  <details className="mt-2 rounded border border-zinc-800 bg-zinc-950/40 p-2">
                    <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300">
                      embeddedPayloadJson
                    </summary>
                    <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-zinc-300">
                      {JSON.stringify(line.embeddedPayloadJson, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="mt-8 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-4">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-400">
          Technical details
        </summary>
        <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-zinc-500">
          <p>
            JSON:{" "}
            <Link
              href={`/api/scope-packets/${detail.scopePacketId}/revisions/${detail.revision.id}`}
              className="text-zinc-300 hover:text-sky-300"
            >
              <code>
                GET /api/scope-packets/{detail.scopePacketId}/revisions/{detail.revision.id}
              </code>
            </Link>
          </p>
          <p>
            Read-only. PacketTaskLine authoring is not available; library packets are populated
            via seed data only at this stage.
          </p>
        </div>
      </details>
    </main>
  );
}
