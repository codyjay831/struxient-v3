import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { listScopePacketsForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { getLineItemPresetDetailForTenant } from "@/server/slice1/reads/line-item-preset-reads";
import { LineItemPresetForm } from "@/components/line-item-presets/line-item-preset-form";
import { DeleteLineItemPresetButton } from "./delete-line-item-preset-button";

/**
 * Detail / edit page for a single `LineItemPreset` (Phase 2 / Slice 3).
 *
 * Shows the shared form pre-filled with the existing values, plus a separate
 * destructive "Delete preset" island. Read-only viewers (no `office_mutate`)
 * are redirected back to the index — there is no read-only detail view in
 * this slice.
 */
export const dynamic = "force-dynamic";

const PACKET_LIST_LIMIT = 200;

type RouteParams = { params: Promise<{ lineItemPresetId: string }> };

export default async function OfficeLineItemPresetDetailPage({ params }: RouteParams) {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) redirect("/login");
  if (!principalHasCapability(auth.principal, "office_mutate")) {
    redirect("/library/line-item-presets");
  }

  const { lineItemPresetId } = await params;

  const prisma = getPrisma();
  const [preset, availablePackets] = await Promise.all([
    getLineItemPresetDetailForTenant(prisma, {
      tenantId: auth.principal.tenantId,
      presetId: lineItemPresetId,
    }),
    listScopePacketsForTenant(prisma, {
      tenantId: auth.principal.tenantId,
      limit: PACKET_LIST_LIMIT,
    }),
  ]);

  if (!preset) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <nav className="mb-4 text-xs text-zinc-500">
        <Link href="/library/line-item-presets" className="hover:text-zinc-300">
          Saved line items
        </Link>
        <span className="mx-2 text-zinc-700">/</span>
        <span className="text-zinc-400">{preset.displayName}</span>
      </nav>

      <h1 className="text-2xl font-semibold text-zinc-50">{preset.displayName}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        <span>Saved line item</span>
        <span className="text-zinc-700">·</span>
        <span className="font-mono">{preset.id}</span>
        {preset.presetKey ? (
          <>
            <span className="text-zinc-700">·</span>
            <span className="font-mono">{preset.presetKey}</span>
          </>
        ) : null}
      </div>

      <div className="mt-8">
        <LineItemPresetForm
          mode="edit"
          preset={preset}
          availablePackets={availablePackets}
        />
      </div>

      <div className="mt-10 border-t border-zinc-800 pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Danger zone
        </h2>
        <p className="mt-2 text-xs text-zinc-500 max-w-prose">
          Deleting this preset only removes the saved defaults. Quote line items previously created
          from this preset keep their commercial values (Slice 2 prefill snapshots into the line
          item itself).
        </p>
        <div className="mt-4">
          <DeleteLineItemPresetButton
            lineItemPresetId={preset.id}
            displayName={preset.displayName}
          />
        </div>
      </div>
    </main>
  );
}
