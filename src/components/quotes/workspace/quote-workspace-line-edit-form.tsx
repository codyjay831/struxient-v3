"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import {
  validateWorkspaceLineEditFields,
  type WorkspaceLineEditFieldsInput,
  type WorkspaceLineEditPricingSnapshot,
} from "@/lib/workspace/quote-workspace-line-edit-validation";
import {
  workspaceComputedLineTotalKind,
  workspaceUnitPriceDollarsSnapshotFromLine,
} from "@/lib/workspace/quote-workspace-line-unit-price";

type ApiErrorBody = { error?: { code?: string; message?: string } };

async function readApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body.error?.message) return body.error.message;
    if (body.error?.code) return body.error.code;
  } catch {
    // ignore
  }
  return `HTTP ${res.status}`;
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

type Props = {
  quoteId: string;
  quoteVersionId: string;
  lineItemId: string;
  initialTitle: string;
  initialQuantity: number;
  initialDescription: string | null;
  initialLineTotalCents: number | null;
  onCancel: () => void;
};

/**
 * Inline commercial-only line edit for the quote workspace (no pins / mode / payment).
 */
export function QuoteWorkspaceLineEditForm({
  quoteId,
  quoteVersionId,
  lineItemId,
  initialTitle,
  initialQuantity,
  initialDescription,
  initialLineTotalCents,
  onCancel,
}: Props) {
  const router = useRouter();
  const uid = useId();
  const pricingSnapshot = useMemo<WorkspaceLineEditPricingSnapshot>(
    () => ({
      baselineLineTotalCents: initialLineTotalCents,
      baselineQuantity: initialQuantity,
      initialUnitPriceDollarsSnapshot: workspaceUnitPriceDollarsSnapshotFromLine(
        initialLineTotalCents,
        initialQuantity,
      ),
    }),
    [initialLineTotalCents, initialQuantity],
  );

  const [title, setTitle] = useState(initialTitle);
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [description, setDescription] = useState(initialDescription ?? "");
  const [unitPriceDollars, setUnitPriceDollars] = useState(() =>
    workspaceUnitPriceDollarsSnapshotFromLine(initialLineTotalCents, initialQuantity),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineTotalDisplay = useMemo(
    () => workspaceComputedLineTotalKind(unitPriceDollars, quantity),
    [unitPriceDollars, quantity],
  );

  const lineSetupHref = `/quotes/${quoteId}#line-item-${lineItemId}`;

  async function handleSave() {
    const input: WorkspaceLineEditFieldsInput = {
      title,
      quantity,
      description,
      unitPriceDollars,
    };
    const v = validateWorkspaceLineEditFields(input, pricingSnapshot);
    if (!v.ok) {
      setError(v.message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/line-items/${encodeURIComponent(lineItemId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: v.title,
            description: v.description,
            quantity: v.quantity,
            lineTotalCents: v.lineTotalCents,
          }),
        },
      );
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      await router.refresh();
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-zinc-700/80 bg-zinc-900/40 p-3 space-y-3 text-xs">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Edit line</p>
      <p className="text-[11px] leading-relaxed text-zinc-500">
        Update the quote details for this line. Crew tasks and saved work stay managed from Line &amp; tasks.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block space-y-0.5 sm:col-span-2">
          <span className="text-zinc-400">Title</span>
          <input
            id={`${uid}-title`}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          />
        </label>
        <label className="block space-y-0.5">
          <span className="text-zinc-400">Quantity</span>
          <input
            id={`${uid}-qty`}
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={busy}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          />
        </label>
        <label className="block space-y-0.5">
          <span className="text-zinc-400">Unit price</span>
          <input
            id={`${uid}-unit`}
            type="number"
            min={0}
            step={0.01}
            value={unitPriceDollars}
            onChange={(e) => setUnitPriceDollars(e.target.value)}
            disabled={busy}
            placeholder="Optional"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          />
        </label>
        <div className="block space-y-0.5 sm:col-span-2">
          <span className="text-zinc-400">Line total</span>
          <p
            id={`${uid}-line-total`}
            className="mt-1 rounded border border-zinc-800/80 bg-zinc-950/80 px-2 py-1.5 text-sm text-zinc-200"
          >
            {lineTotalDisplay.kind === "no_amount" ? (
              <span className="text-zinc-500">No amount set</span>
            ) : lineTotalDisplay.kind === "amount" ? (
              <span className="font-mono text-zinc-100">{formatUsd(lineTotalDisplay.cents!)}</span>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </p>
        </div>
        <label className="block space-y-0.5 sm:col-span-2">
          <span className="text-zinc-400">Description</span>
          <textarea
            id={`${uid}-desc`}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          />
        </label>
      </div>
      {error ? (
        <p className="rounded border border-red-900/50 bg-red-950/25 px-2 py-1 text-[11px] text-red-200">{error}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <Link
          href={lineSetupHref}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 underline underline-offset-2"
        >
          Advanced setup →
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSave()}
            className="rounded bg-sky-700/90 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded border border-zinc-600 px-2.5 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
