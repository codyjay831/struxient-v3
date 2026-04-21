import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { getScopePacketDetailForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";

/**
 * Office-surface packet detail. Read-only inspector for a single ScopePacket
 * and its revision list.
 *
 * Reuses `getScopePacketDetailForTenant` and the shared `ScopePacketDetailDto`
 * — same canon read consumed by `/dev/catalog-packets/[id]`. Mutation forms
 * (CreateNextRevisionForm / ForkRevisionForm / PublishRevisionForm) live on
 * the dev surface and are intentionally NOT mounted here. Office is inspect
 * only in this slice.
 */
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ scopePacketId: string }> };

const REVISION_STATUS_BADGE: Record<string, string> = {
  DRAFT: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  PUBLISHED: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300",
  SUPERSEDED: "border-zinc-700/80 bg-zinc-900/50 text-zinc-400",
};

export default async function OfficeLibraryPacketDetailPage({ params }: PageProps) {
  const { scopePacketId } = await params;
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const detail = await getScopePacketDetailForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    scopePacketId,
  });

  if (!detail) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl p-8 text-zinc-200">
      <nav className="mb-4 text-xs text-zinc-500">
        <Link href="/library/packets" className="hover:text-zinc-300">
          Library packets
        </Link>
        <span className="mx-2 text-zinc-700">/</span>
        <span className="text-zinc-400">{detail.displayName}</span>
      </nav>

      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-baseline gap-2 text-2xl font-semibold tracking-tight text-zinc-50">
              <span>{detail.displayName}</span>
              <code className="text-sm font-normal text-zinc-500">{detail.packetKey}</code>
              <span className="rounded border border-zinc-700 bg-zinc-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Read-only
              </span>
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              {detail.publishedRevisionCount} published / {detail.revisionCount} total revision
              {detail.revisionCount === 1 ? "" : "s"}
              {detail.supersededRevisionCount > 0
                ? ` · ${detail.supersededRevisionCount} superseded`
                : ""}
              .{" "}
              {detail.latestPublishedRevisionNumber != null ? (
                <span>
                  Latest published is r{detail.latestPublishedRevisionNumber}
                  {detail.latestPublishedAtIso ? ` at ${detail.latestPublishedAtIso}` : ""}.
                </span>
              ) : (
                <span className="text-amber-400/80">No published revision exists.</span>
              )}
            </p>
          </div>
          <Link
            href="/library/packets"
            className="text-sm text-zinc-500 hover:text-zinc-400"
          >
            ← All library packets
          </Link>
        </div>
      </header>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Revisions
        </h2>
        {detail.revisions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-sm text-zinc-500">
            This packet has no revisions yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {detail.revisions.map((rev) => (
              <li
                key={rev.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold text-zinc-100">
                      Revision r{rev.revisionNumber}
                    </span>
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        REVISION_STATUS_BADGE[rev.status] ?? REVISION_STATUS_BADGE.DRAFT
                      }`}
                    >
                      {rev.status}
                    </span>
                  </div>
                  <Link
                    href={`/library/packets/${detail.id}/revisions/${rev.id}`}
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    Open revision
                  </Link>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                  <span>publishedAt: {rev.publishedAtIso ?? "(draft — not yet published)"}</span>
                  <span>
                    {rev.packetTaskLineCount} task line{rev.packetTaskLineCount === 1 ? "" : "s"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
