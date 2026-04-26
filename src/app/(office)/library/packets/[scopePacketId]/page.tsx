import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CreateNextRevisionForm } from "@/components/catalog-packets/create-next-revision-form";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { getScopePacketDetailForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";

/**
 * Office-surface packet detail. Inspector for a single ScopePacket and its
 * revision list, plus the canon-blessed revision-2 evolution affordance:
 * create the next DRAFT revision as a deep clone of the current PUBLISHED
 * one. Authoring of task lines on the cloned DRAFT happens on the revision
 * detail page (already mounted under this surface).
 *
 * Reuses `getScopePacketDetailForTenant` and the shared `ScopePacketDetailDto`
 * — same canon read consumed by `/dev/catalog-packets/[id]`. Reuses the same
 * `CreateNextRevisionForm` component the dev surface uses; the only
 * surface-specific knob is the post-success redirect path.
 *
 * What stays read-only here: PUBLISHED and SUPERSEDED revisions remain
 * canon-immutable (PUBLISHED-discipline §159/§161). The fork affordance is
 * gated on `latestPublishedRevisionId != null && !hasDraftRevision &&
 * office_mutate` — exactly mirroring the dev surface — so SUPERSEDED-only
 * packets and packets that already have a DRAFT do not show the action.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md ("Canon amendment — revision-2 evolution
 *     policy (post-publish)")
 *   - docs/implementation/decision-packs/revision-2-evolution-decision-pack.md §3, §4
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

  const canMutate = principalHasCapability(auth.principal, "office_mutate");
  // Mirrors the server-side preconditions (decision pack §3 + §4) and the
  // dev-surface gate. Server is still the source of truth on POST.
  const canCreateNextDraft =
    canMutate && detail.latestPublishedRevisionId != null && !detail.hasDraftRevision;

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
              {detail.hasDraftRevision ? (
                <span className="rounded border border-amber-800/60 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  Draft in progress
                </span>
              ) : (
                <span className="rounded border border-zinc-700 bg-zinc-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Published revisions are read-only
                </span>
              )}
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

      {canCreateNextDraft ? (
        <CreateNextRevisionForm
          scopePacketId={detail.id}
          latestPublishedRevisionNumber={detail.latestPublishedRevisionNumber!}
          surfacePath="/library/packets"
          draftEditorAvailable
        />
      ) : null}

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
            {detail.revisions.map((rev) => {
              // Source-revision clarity: only the latest PUBLISHED revision is
              // the clone source for create-next-DRAFT (decision pack §3). The
              // call-to-action remains the single packet-level form above —
              // these per-row notes just explain *why* a row is or isn't the
              // source so users don't expect a per-row "fork" button.
              const isCloneSource =
                rev.status === "PUBLISHED" && rev.id === detail.latestPublishedRevisionId;
              return (
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
                      {rev.status === "DRAFT" ? (
                        <span className="rounded border border-amber-800/60 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-300/90">
                          Editable
                        </span>
                      ) : null}
                      {isCloneSource ? (
                        <span className="rounded border border-emerald-800/60 bg-emerald-950/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300/90">
                          Clone source for next draft
                        </span>
                      ) : null}
                    </div>
                    <Link
                      href={`/library/packets/${detail.id}/revisions/${rev.id}`}
                      className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                    >
                      {rev.status === "DRAFT" ? "Open & edit" : "Open revision"}
                    </Link>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                    <span>
                      publishedAt: {rev.publishedAtIso ?? "(draft — not yet published)"}
                    </span>
                    <span>
                      {rev.packetTaskLineCount} task line
                      {rev.packetTaskLineCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
