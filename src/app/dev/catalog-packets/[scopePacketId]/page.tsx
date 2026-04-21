import Link from "next/link";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { InternalNotFoundState } from "@/components/internal/internal-state-feedback";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { getScopePacketDetailForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ scopePacketId: string }> };

const REVISION_STATUS_BADGE: Record<string, string> = {
  DRAFT: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  PUBLISHED: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300",
};

export default async function DevCatalogPacketDetailPage({ params }: PageProps) {
  const { scopePacketId } = await params;
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

  const detail = await getScopePacketDetailForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    scopePacketId,
  });

  if (!detail) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 text-zinc-200 sm:px-6 lg:px-8">
        <header className="mb-6 border-b border-zinc-800 pb-5">
          <InternalBreadcrumb
            category="Commercial"
            segments={[
              { label: "Catalog packets", href: "/dev/catalog-packets" },
              { label: "Packet not found" },
            ]}
          />
        </header>
        <InternalNotFoundState
          title="Catalog packet not found"
          message="This packet is not visible to your tenant. It may belong to another tenant or no longer exist."
          backLink={{ href: "/dev/catalog-packets", label: "← All catalog packets" }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-8 text-zinc-200">
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <InternalBreadcrumb
              category="Commercial"
              segments={[
                { label: "Catalog packets", href: "/dev/catalog-packets" },
                { label: detail.displayName },
              ]}
            />
            <h1 className="mt-2 flex flex-wrap items-baseline gap-2 text-xl font-semibold tracking-tight text-zinc-50">
              <span>{detail.displayName}</span>
              <code className="text-sm font-normal text-zinc-500">{detail.packetKey}</code>
              <span className="rounded border border-zinc-700 bg-zinc-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Read-only
              </span>
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              {detail.publishedRevisionCount} published / {detail.revisionCount} total revision
              {detail.revisionCount === 1 ? "" : "s"}.{" "}
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
            href="/dev/catalog-packets"
            className="text-sm text-zinc-500 hover:text-zinc-400"
          >
            ← All catalog packets
          </Link>
        </div>
      </header>

      <section className="space-y-3">
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
                    href={`/dev/catalog-packets/${detail.id}/revisions/${rev.id}`}
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

      <details className="mt-8 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-4">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-400">
          Technical details
        </summary>
        <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-zinc-500">
          <p>
            JSON:{" "}
            <Link href={`/api/scope-packets/${detail.id}`} className="text-zinc-300 hover:text-sky-300">
              <code>GET /api/scope-packets/{detail.id}</code>
            </Link>
          </p>
          <p>
            This page does not support edit, create, or promotion. Catalog authoring is not
            available yet — see decisions in <code>docs/canon/05-packet-canon.md</code> and{" "}
            <code>docs/epics/15-scope-packets-epic.md</code>.
          </p>
        </div>
      </details>
    </main>
  );
}
