"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  buildSoldScopeLineItemCreateRequestBody,
  validateWorkspaceLineCreateFields,
  type WorkspaceLineCreateFieldsInput,
  type WorkspaceLineCreateFieldErrors,
} from "@/lib/workspace/quote-workspace-line-create-validation";

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

export type QuoteWorkspaceLineCreateGroup = {
  id: string;
  name: string;
  items: { sortOrder: number }[];
};

type Props = {
  quoteId: string;
  quoteVersionId: string;
  groupsWithItems: QuoteWorkspaceLineCreateGroup[];
  canAddLineItems: boolean;
};

function nextSortOrderForGroup(items: { sortOrder: number }[]): number {
  if (items.length === 0) return 1;
  return items.reduce((acc, it) => Math.max(acc, it.sortOrder), 0) + 1;
}

/**
 * Add a simple estimate-only line on the quote workspace (SOLD_SCOPE via existing POST route).
 */
export function QuoteWorkspaceLineCreateForm({
  quoteId,
  quoteVersionId,
  groupsWithItems,
  canAddLineItems,
}: Props) {
  const router = useRouter();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [proposalGroupId, setProposalGroupId] = useState(() => groupsWithItems[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState("");
  const [lineTotalDollars, setLineTotalDollars] = useState("");
  const [fieldErrors, setFieldErrors] = useState<WorkspaceLineCreateFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canAddLineItems) {
    return null;
  }

  if (groupsWithItems.length === 0) {
    return (
      <div className="rounded-md border border-amber-900/45 bg-amber-950/20 px-3 py-2.5 text-xs text-amber-100/95">
        <p className="font-medium text-amber-50/95">Cannot add lines yet</p>
        <p className="mt-1 text-[11px] leading-relaxed text-amber-200/90">
          This draft needs a proposal group before lines can be added on this page. Open{" "}
          <Link href={`/quotes/${quoteId}/scope`} className="font-semibold text-amber-100 underline underline-offset-2">
            Line &amp; tasks
          </Link>{" "}
          to finish setup.
        </p>
      </div>
    );
  }

  function resetForm() {
    setTitle("");
    setQuantity("1");
    setDescription("");
    setLineTotalDollars("");
    setFieldErrors({});
    setSubmitError(null);
    setProposalGroupId(groupsWithItems[0]?.id ?? "");
  }

  function handleCancel() {
    setOpen(false);
    resetForm();
  }

  async function handleSubmit() {
    setSubmitError(null);
    const input: WorkspaceLineCreateFieldsInput = {
      title,
      quantity,
      description,
      lineTotalDollars,
    };
    const v = validateWorkspaceLineCreateFields(input);
    if (!v.ok) {
      setFieldErrors(v.errors);
      return;
    }
    setFieldErrors({});

    const group = groupsWithItems.find((g) => g.id === proposalGroupId) ?? groupsWithItems[0];
    if (!group) {
      setSubmitError("No proposal group selected.");
      return;
    }

    const sortOrder = nextSortOrderForGroup(group.items);
    const body = buildSoldScopeLineItemCreateRequestBody({
      proposalGroupId: group.id,
      sortOrder,
      value: v.value,
    });

    setBusy(true);
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/line-items`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        setSubmitError(await readApiError(res));
        return;
      }
      await router.refresh();
      setOpen(false);
      resetForm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {!open ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(true);
            setProposalGroupId(groupsWithItems[0]?.id ?? "");
          }}
          className="rounded-md bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50 transition-colors"
        >
          + Add line item
        </button>
      ) : (
        <div className="rounded-md border border-zinc-700/80 bg-zinc-900/50 p-3 space-y-3 text-xs">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-zinc-100">Add line item</p>
              <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-zinc-500">
                Estimate-only line — what the customer sees on the proposal. Add crew tasks later from{" "}
                <span className="whitespace-nowrap">Line &amp; tasks</span> when this line needs work after approval.
              </p>
            </div>
          </div>

          {groupsWithItems.length > 1 ? (
            <label className="block space-y-0.5 max-w-md">
              <span className="text-zinc-400">Proposal group</span>
              <select
                id={`${uid}-group`}
                value={proposalGroupId}
                onChange={(e) => setProposalGroupId(e.target.value)}
                disabled={busy}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              >
                {groupsWithItems.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

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
              {fieldErrors.title ? (
                <span className="text-[11px] text-red-300/95">{fieldErrors.title}</span>
              ) : null}
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
              {fieldErrors.quantity ? (
                <span className="text-[11px] text-red-300/95">{fieldErrors.quantity}</span>
              ) : null}
            </label>
            <label className="block space-y-0.5">
              <span className="text-zinc-400">Line total (USD)</span>
              <input
                id={`${uid}-amt`}
                type="number"
                min={0}
                step={0.01}
                value={lineTotalDollars}
                onChange={(e) => setLineTotalDollars(e.target.value)}
                disabled={busy}
                placeholder="Optional"
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              />
              {fieldErrors.lineTotal ? (
                <span className="text-[11px] text-red-300/95">{fieldErrors.lineTotal}</span>
              ) : null}
            </label>
            <label className="block space-y-0.5 sm:col-span-2">
              <span className="text-zinc-400">Description</span>
              <textarea
                id={`${uid}-desc`}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
                placeholder="Optional"
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              />
              {fieldErrors.description ? (
                <span className="text-[11px] text-red-300/95">{fieldErrors.description}</span>
              ) : null}
            </label>
          </div>

          {submitError ? (
            <p
              className="rounded border border-red-900/50 bg-red-950/25 px-2 py-1.5 text-[11px] text-red-200"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5 pt-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-[10px] leading-snug text-zinc-500 max-w-md order-2 sm:order-1">
              Use Line &amp; tasks for saved work, crew tasks, and technical options.
            </p>
            <Link
              href={`/quotes/${quoteId}/scope`}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 underline underline-offset-2 order-1 sm:order-2 sm:shrink-0"
            >
              Advanced line setup →
            </Link>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSubmit()}
                className="rounded bg-sky-700/90 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {busy ? "Adding…" : "Add line"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleCancel}
                className="rounded border border-zinc-600 px-2.5 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
