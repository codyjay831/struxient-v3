"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { QuoteVersionScopeApiDto } from "@/lib/quote-version-scope-dto";
import type { ScopeProposalGroupWithItems } from "@/lib/quote-scope/quote-scope-grouping";

type ProposalGroup = QuoteVersionScopeApiDto["proposalGroups"][number];
type LineItem = QuoteVersionScopeApiDto["orderedLineItems"][number];
type GroupWithItems = ScopeProposalGroupWithItems<ProposalGroup, LineItem>;

type EditableReason = "ok" | "missing_capability" | "not_editable_head";

type Props = {
  quoteId: string;
  quoteVersionId: string;
  versionNumber: number;
  proposalGroups: ProposalGroup[];
  groupedLineItems: GroupWithItems[];
  canMutate: boolean;
  editableReason: EditableReason;
};

type ExecutionMode = "SOLD_SCOPE" | "MANIFEST";
const EXECUTION_MODES: ExecutionMode[] = ["SOLD_SCOPE", "MANIFEST"];

type FormFields = {
  title: string;
  quantity: string; // raw input, validated on submit
  executionMode: ExecutionMode;
  unitPriceCents: string; // empty string = unset (null on the wire)
  proposalGroupId: string;
};

type Banner =
  | { kind: "success"; title: string; message?: string }
  | { kind: "error"; title: string; message?: string }
  | null;

const blankFields = (group: ProposalGroup | undefined): FormFields => ({
  title: "",
  quantity: "1",
  executionMode: "SOLD_SCOPE",
  unitPriceCents: "",
  proposalGroupId: group?.id ?? "",
});

/**
 * Office-side line-item authoring UI.
 *
 *   - Renders one section per proposal group via the shared grouping helper.
 *   - Add: opens an inline form pre-targeted at the section's group with
 *     `sortOrder = max(existing in group) + 1` (1 if empty).
 *   - Edit: inline form per row.
 *   - Delete: confirm + DELETE; row vanishes after `router.refresh()`.
 *
 * All mutations call the existing canonical line-item API routes
 * (`POST /api/quote-versions/:quoteVersionId/line-items` and
 * `PATCH/DELETE .../line-items/:lineItemId`). After a successful mutation,
 * the page is refreshed via `router.refresh()` so we re-read the canonical
 * server state instead of carrying a divergent local model.
 *
 * No packet attachment, no proposal-group management, no drag-and-drop sort
 * — Phase A scope.
 */
export function ScopeEditor({
  quoteId,
  quoteVersionId,
  versionNumber,
  proposalGroups,
  groupedLineItems,
  canMutate,
  editableReason,
}: Props) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [addingForGroupId, setAddingForGroupId] = useState<string | null>(null);
  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);

  const noGroups = proposalGroups.length === 0;

  if (!canMutate) {
    return (
      <ReadOnlyView
        groupedLineItems={groupedLineItems}
        versionNumber={versionNumber}
        editableReason={editableReason}
        quoteId={quoteId}
      />
    );
  }

  if (noGroups) {
    return (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-sm text-zinc-300">
        <h2 className="text-base font-semibold text-zinc-100">No proposal groups yet</h2>
        <p className="mt-2 text-zinc-400">
          Line items must belong to a proposal group, and this version has none. Proposal-group
          management isn’t part of this slice — open the workspace to seed groups (or use the
          group API) before authoring line items here.
        </p>
        <div className="mt-3">
          <Link
            href={`/quotes/${quoteId}`}
            className="inline-block rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            Open workspace →
          </Link>
        </div>
      </section>
    );
  }

  async function handleCreate(fields: FormFields, group: GroupWithItems) {
    setBusyKey(`create:${group.id}`);
    setBanner(null);
    try {
      const validation = validateFields(fields);
      if (!validation.ok) {
        setBanner({ kind: "error", title: "Cannot create line item", message: validation.message });
        return;
      }

      // sortOrder strategy: max(existing) + 1, or 1 if empty. Server has the
      // final say on uniqueness via the existing mutation contract; this is
      // just a client-side pick that keeps new items at the bottom of the
      // visible group ordering.
      const nextSort =
        group.items.reduce((acc, it) => (it.sortOrder > acc ? it.sortOrder : acc), 0) + 1;

      const body = {
        proposalGroupId: group.id,
        sortOrder: nextSort,
        title: validation.title,
        quantity: validation.quantity,
        executionMode: fields.executionMode,
        unitPriceCents: validation.unitPriceCents,
      };

      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/line-items`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setBanner({
          kind: "error",
          title: "Create failed",
          message: json.error?.message ?? `${res.status} ${json.error?.code ?? "ERROR"}`,
        });
        return;
      }
      setAddingForGroupId(null);
      setBanner({ kind: "success", title: "Line item added", message: validation.title });
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUpdate(item: LineItem, fields: FormFields) {
    setBusyKey(`update:${item.id}`);
    setBanner(null);
    try {
      const validation = validateFields(fields);
      if (!validation.ok) {
        setBanner({ kind: "error", title: "Cannot update line item", message: validation.message });
        return;
      }
      // PATCH only fields the operator can edit in this slice.
      const patch = {
        title: validation.title,
        quantity: validation.quantity,
        executionMode: fields.executionMode,
        unitPriceCents: validation.unitPriceCents,
      };
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/line-items/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(patch),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setBanner({
          kind: "error",
          title: "Update failed",
          message: json.error?.message ?? `${res.status} ${json.error?.code ?? "ERROR"}`,
        });
        return;
      }
      setEditingLineItemId(null);
      setBanner({ kind: "success", title: "Line item updated", message: validation.title });
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDelete(item: LineItem) {
    if (
      !window.confirm(
        `Delete line item "${item.title}"? This removes it from the head draft and cannot be undone here.`,
      )
    ) {
      return;
    }
    setBusyKey(`delete:${item.id}`);
    setBanner(null);
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/line-items/${encodeURIComponent(item.id)}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setBanner({
          kind: "error",
          title: "Delete failed",
          message: json.error?.message ?? `${res.status} ${json.error?.code ?? "ERROR"}`,
        });
        return;
      }
      setBanner({ kind: "success", title: "Line item deleted", message: item.title });
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-8">
      {banner ? <BannerView banner={banner} onDismiss={() => setBanner(null)} /> : null}

      {groupedLineItems.map((group) => {
        const isAddingHere = addingForGroupId === group.id;
        return (
          <section
            key={group.id}
            className="rounded-lg border border-zinc-800 bg-zinc-900/20 overflow-hidden"
          >
            <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-4 py-2.5">
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                  {group.name}
                </h2>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {group.items.length} {group.items.length === 1 ? "item" : "items"} · v{versionNumber} draft
                </p>
              </div>
              {!isAddingHere ? (
                <button
                  type="button"
                  onClick={() => {
                    setAddingForGroupId(group.id);
                    setEditingLineItemId(null);
                  }}
                  className="rounded bg-sky-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-sky-600 transition-colors"
                >
                  + Add line item
                </button>
              ) : null}
            </header>

            {isAddingHere ? (
              <div className="border-b border-zinc-800 bg-zinc-950/40 p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                  New line item · {group.name}
                </h3>
                <LineItemForm
                  initial={blankFields(group)}
                  proposalGroupOptions={[group]}
                  busy={busyKey === `create:${group.id}`}
                  submitLabel="Create line item"
                  onCancel={() => setAddingForGroupId(null)}
                  onSubmit={(fields) => void handleCreate(fields, group)}
                />
              </div>
            ) : null}

            {group.items.length === 0 && !isAddingHere ? (
              <p className="px-4 py-6 text-xs text-zinc-500 text-center">
                No line items in this group yet.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {group.items.map((item) => {
                  const isEditing = editingLineItemId === item.id;
                  return (
                    <li key={item.id} className="px-4 py-3">
                      {isEditing ? (
                        <LineItemForm
                          initial={{
                            title: item.title,
                            quantity: String(item.quantity),
                            executionMode:
                              item.executionMode === "MANIFEST" ? "MANIFEST" : "SOLD_SCOPE",
                            unitPriceCents: "",
                            proposalGroupId: item.proposalGroupId,
                          }}
                          proposalGroupOptions={[group]}
                          busy={busyKey === `update:${item.id}`}
                          submitLabel="Save changes"
                          onCancel={() => setEditingLineItemId(null)}
                          onSubmit={(fields) => void handleUpdate(item, fields)}
                        />
                      ) : (
                        <LineItemRow
                          item={item}
                          busy={busyKey === `delete:${item.id}`}
                          onEdit={() => {
                            setEditingLineItemId(item.id);
                            setAddingForGroupId(null);
                          }}
                          onDelete={() => void handleDelete(item)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- Subcomponents ---------------- */

function LineItemRow({
  item,
  busy,
  onEdit,
  onDelete,
}: {
  item: LineItem;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-100 truncate">{item.title}</p>
        <p className="mt-1 text-[11px] text-zinc-500 font-mono">
          qty {item.quantity} · {item.executionMode}
          {item.tierCode ? ` · tier ${item.tierCode}` : ""}
          {item.scopePacketRevisionId
            ? " · library packet"
            : item.quoteLocalPacketId
              ? " · local packet"
              : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50 transition-colors"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="rounded border border-red-900/60 bg-red-950/30 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-900/40 hover:text-red-200 disabled:opacity-50 transition-colors"
        >
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

function LineItemForm({
  initial,
  proposalGroupOptions,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormFields;
  proposalGroupOptions: ProposalGroup[];
  busy: boolean;
  submitLabel: string;
  onSubmit: (fields: FormFields) => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<FormFields>(initial);
  const groupName = useMemo(
    () => proposalGroupOptions.find((g) => g.id === fields.proposalGroupId)?.name ?? "(none)",
    [fields.proposalGroupId, proposalGroupOptions],
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(fields);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="text-zinc-400">Title</span>
          <input
            type="text"
            value={fields.title}
            onChange={(e) => setFields({ ...fields, title: e.target.value })}
            required
            disabled={busy}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
            placeholder="e.g. Install rooftop unit"
          />
        </label>
        <label className="block text-xs">
          <span className="text-zinc-400">Quantity (integer)</span>
          <input
            type="number"
            inputMode="numeric"
            step={1}
            min={0}
            value={fields.quantity}
            onChange={(e) => setFields({ ...fields, quantity: e.target.value })}
            required
            disabled={busy}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
          />
        </label>
        <label className="block text-xs">
          <span className="text-zinc-400">Execution mode</span>
          <select
            value={fields.executionMode}
            onChange={(e) =>
              setFields({ ...fields, executionMode: e.target.value as ExecutionMode })
            }
            disabled={busy}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
          >
            {EXECUTION_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-zinc-400">Unit price (cents, optional)</span>
          <input
            type="number"
            inputMode="numeric"
            step={1}
            value={fields.unitPriceCents}
            onChange={(e) => setFields({ ...fields, unitPriceCents: e.target.value })}
            disabled={busy}
            placeholder="e.g. 12500"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
          />
        </label>
      </div>
      <p className="text-[10px] text-zinc-500">
        Proposal group: <span className="text-zinc-400">{groupName}</span> · packet attachment is
        not part of this slice — line items are created without a packet and can be linked later.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50 transition-colors"
        >
          {busy ? "Working…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function BannerView({ banner, onDismiss }: { banner: NonNullable<Banner>; onDismiss: () => void }) {
  const isError = banner.kind === "error";
  return (
    <section
      role={isError ? "alert" : "status"}
      className={`rounded-lg border p-3 text-xs flex items-start justify-between gap-3 ${
        isError
          ? "border-red-900/60 bg-red-950/30 text-red-200"
          : "border-emerald-900/60 bg-emerald-950/20 text-emerald-200"
      }`}
    >
      <div>
        <p className="font-semibold">{banner.title}</p>
        {banner.message ? <p className="mt-0.5 opacity-90">{banner.message}</p> : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-[11px] opacity-70 hover:opacity-100"
      >
        ✕
      </button>
    </section>
  );
}

function ReadOnlyView({
  groupedLineItems,
  versionNumber,
  editableReason,
  quoteId,
}: {
  groupedLineItems: GroupWithItems[];
  versionNumber: number;
  editableReason: EditableReason;
  quoteId: string;
}) {
  const reasonMessage =
    editableReason === "missing_capability"
      ? "Your session lacks the office_mutate capability, so the editor is read-only here. Sign in as an office user with elevated permissions to edit scope."
      : "This is not the editable head draft. Open the workspace and use “Create new draft version” to start an editable revision.";
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-xs text-zinc-300">
        <p className="font-semibold text-zinc-100">Read-only view (v{versionNumber})</p>
        <p className="mt-1 text-zinc-400">{reasonMessage}</p>
        <div className="mt-3">
          <Link
            href={`/quotes/${quoteId}`}
            className="inline-block rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            Open workspace →
          </Link>
        </div>
      </section>

      {groupedLineItems.map((group) => (
        <section
          key={group.id}
          className="rounded-lg border border-zinc-800 bg-zinc-900/20 overflow-hidden"
        >
          <header className="border-b border-zinc-800 bg-zinc-900/40 px-4 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
              {group.name}
            </h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {group.items.length} {group.items.length === 1 ? "item" : "items"}
            </p>
          </header>
          {group.items.length === 0 ? (
            <p className="px-4 py-6 text-xs text-zinc-500 text-center">
              No line items in this group.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {group.items.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <p className="text-sm text-zinc-100">{item.title}</p>
                  <p className="mt-1 text-[11px] text-zinc-500 font-mono">
                    qty {item.quantity} · {item.executionMode}
                    {item.tierCode ? ` · tier ${item.tierCode}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/* ---------------- Validation ---------------- */

type ValidatedFields =
  | { ok: true; title: string; quantity: number; unitPriceCents: number | null }
  | { ok: false; message: string };

function validateFields(fields: FormFields): ValidatedFields {
  const title = fields.title.trim();
  if (!title) {
    return { ok: false, message: "Title is required." };
  }
  const quantity = Number.parseInt(fields.quantity, 10);
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 0) {
    return { ok: false, message: "Quantity must be a non-negative integer." };
  }

  let unitPriceCents: number | null = null;
  if (fields.unitPriceCents.trim()) {
    const parsed = Number.parseInt(fields.unitPriceCents, 10);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return { ok: false, message: "Unit price (cents) must be an integer if provided." };
    }
    unitPriceCents = parsed;
  }
  return { ok: true, title, quantity, unitPriceCents };
}
