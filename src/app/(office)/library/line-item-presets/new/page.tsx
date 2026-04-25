import Link from "next/link";
import { redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { listScopePacketsForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { LineItemPresetForm } from "@/components/line-item-presets/line-item-preset-form";

/**
 * Create a new `LineItemPreset` (Phase 2 / Slice 3 — "Saved line items").
 *
 * Office admins only (`office_mutate`). The packet dropdown is loaded server-
 * side from the same `listScopePacketsForTenant` read the rest of the office
 * surface uses; it includes packets even when they have no published revision
 * yet (the form surfaces an inline advisory, the preset can still be saved).
 */
export const dynamic = "force-dynamic";

const PACKET_LIST_LIMIT = 200;

export default async function OfficeNewLineItemPresetPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) redirect("/login");
  if (!principalHasCapability(auth.principal, "office_mutate")) {
    redirect("/library/line-item-presets");
  }

  const availablePackets = await listScopePacketsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: PACKET_LIST_LIMIT,
  });

  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <nav className="mb-4 text-xs text-zinc-500">
        <Link href="/library/line-item-presets" className="hover:text-zinc-300">
          Saved line items
        </Link>
        <span className="mx-2 text-zinc-700">/</span>
        <span className="text-zinc-400">New</span>
      </nav>

      <h1 className="text-2xl font-semibold text-zinc-50">New saved line item</h1>
      <p className="mt-2 text-sm text-zinc-500 max-w-2xl">
        Defines commercial defaults (title, price, quantity, payment flags) that prefill into the
        line item form when picked from Quick Add. Execution stays defined by the linked Library
        packet.
      </p>

      <div className="mt-8">
        <LineItemPresetForm mode="create" availablePackets={availablePackets} />
      </div>
    </main>
  );
}
