import Link from "next/link";
import { redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import {
  LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS,
  listLineItemPresetsForTenant,
  type LineItemPresetSummaryDto,
} from "@/server/slice1/reads/line-item-preset-reads";

/**
 * Office-surface index for `LineItemPreset` (Phase 2 / Slice 3 — "Saved line items").
 *
 * A saved line item is **commercial defaults only** — it does not participate
 * in execution. Selecting one in Quick Add prefills the existing line item
 * form; the linked Library packet (if any) is what actually drives runtime
 * tasks. Editing or deleting a preset never mutates downstream quote line
 * items because Slice 2's prefill snapshots commercial values into the line
 * item itself.
 */
export const dynamic = "force-dynamic";

const LIST_LIMIT = LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS.max;

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(dollars);
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function PacketCell({ preset }: { preset: LineItemPresetSummaryDto }) {
  if (preset.defaultExecutionMode === "SOLD_SCOPE") {
    return <span className="text-zinc-600">—</span>;
  }
  if (!preset.defaultScopePacket) {
    return (
      <span className="rounded border border-rose-800/60 bg-rose-950/30 px-2 py-0.5 text-[11px] text-rose-300">
        Packet missing
      </span>
    );
  }
  const ver = preset.defaultScopePacket.latestPublishedRevisionNumber;
  return (
    <div className="flex flex-col">
      <span className="text-zinc-200">{preset.defaultScopePacket.displayName}</span>
      <span className="text-[11px] text-zinc-500 font-mono">
        {preset.defaultScopePacket.packetKey}
      </span>
      {ver == null ? (
        <span className="mt-0.5 inline-block w-fit rounded border border-amber-800/60 bg-amber-950/30 px-1.5 py-0.5 text-[10px] text-amber-300">
          No published revision
        </span>
      ) : (
        <span className="mt-0.5 inline-block w-fit rounded border border-emerald-800/60 bg-emerald-950/30 px-1.5 py-0.5 text-[10px] text-emerald-300">
          v{ver}
        </span>
      )}
    </div>
  );
}

function ModeBadge({ mode }: { mode: LineItemPresetSummaryDto["defaultExecutionMode"] }) {
  if (mode === "MANIFEST") {
    return (
      <span className="inline-block rounded border border-violet-800/60 bg-violet-950/30 px-2 py-0.5 text-[11px] text-violet-300">
        Manifest
      </span>
    );
  }
  return (
    <span className="inline-block rounded border border-zinc-700 bg-zinc-900/40 px-2 py-0.5 text-[11px] text-zinc-400">
      Sold scope
    </span>
  );
}

export default async function OfficeLineItemPresetsIndexPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const items = await listLineItemPresetsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  const canAuthor = principalHasCapability(auth.principal, "office_mutate");

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Saved line items</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
            Commercial defaults reusable across quotes. Selecting one in Quick Add prefills the
            line item form — execution stays defined by the linked Library packet.
          </p>
        </div>
        {canAuthor ? (
          <Link
            href="/library/line-item-presets/new"
            className="shrink-0 rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition-colors"
          >
            New saved line item
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-500"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h2 className="text-zinc-200 font-medium">No saved line items yet</h2>
          <p className="text-zinc-500 text-sm mt-1 max-w-sm mx-auto">
            Save a line item to prefill its commercial defaults (title, price, quantity, payment
            flags) the next time you quote it.
          </p>
          {canAuthor ? (
            <Link
              href="/library/line-item-presets/new"
              className="mt-6 inline-block rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition-colors"
            >
              + New saved line item
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40 text-[11px] uppercase font-bold tracking-wider text-zinc-500">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Execution mode</th>
                <th className="px-6 py-4">Packet</th>
                <th className="px-6 py-4 text-right">Price</th>
                <th className="px-6 py-4 text-right">Qty</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4">Updated</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-zinc-800/60 last:border-b-0 text-sm hover:bg-zinc-900/40"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/library/line-item-presets/${encodeURIComponent(p.id)}`}
                      className="font-medium text-zinc-100 hover:text-sky-300"
                    >
                      {p.displayName}
                    </Link>
                    {p.presetKey ? (
                      <div className="mt-0.5 text-[11px] font-mono text-zinc-500">
                        {p.presetKey}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-6 py-4">
                    <ModeBadge mode={p.defaultExecutionMode} />
                  </td>
                  <td className="px-6 py-4">
                    <PacketCell preset={p} />
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums text-zinc-300">
                    {formatCents(p.defaultUnitPriceCents)}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums text-zinc-300">
                    {p.defaultQuantity == null ? "—" : p.defaultQuantity}
                  </td>
                  <td className="px-6 py-4">
                    {p.defaultPaymentBeforeWork ? (
                      <span className="inline-block rounded border border-amber-800/60 bg-amber-950/30 px-2 py-0.5 text-[11px] text-amber-300">
                        Pay before work
                      </span>
                    ) : (
                      <span className="text-zinc-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-500">
                    {formatTimestamp(p.updatedAtIso)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/library/line-item-presets/${encodeURIComponent(p.id)}`}
                      className="text-xs text-sky-400 hover:text-sky-300"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
