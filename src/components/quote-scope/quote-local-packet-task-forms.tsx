"use client";

import { useId, useMemo, useState } from "react";
import {
  TaskDefinitionPicker,
  type SelectedTaskDefinitionSummary,
} from "@/components/quote-scope/task-definition-picker";
import { TargetNodePicker } from "@/components/quote-scope/target-node-picker";
import { lineKeyFromTaskName } from "@/lib/line-key-from-task-name";
import {
  emptyDraft,
  finalizeEmbeddedDraftForSubmit,
  itemToDraft,
  type NewItemDraft,
} from "@/lib/quote-local-packet-item-authoring";
import type { QuoteLocalPacketItemDto } from "@/server/slice1/reads/quote-local-packet-reads";

export function EmbeddedTaskAuthoringForm({
  variant,
  initialDraft,
  defaultSortOrder,
  existingLineKeys,
  busy,
  pinnedWorkflowVersionId,
  onCancel,
  onSubmit,
  submitLabel,
  showAdvancedOptions = true,
}: {
  variant: "create" | "edit";
  initialDraft?: NewItemDraft;
  defaultSortOrder: number;
  existingLineKeys: string[];
  busy: boolean;
  pinnedWorkflowVersionId: string | null;
  onCancel: () => void;
  onSubmit: (draft: NewItemDraft) => void | Promise<void>;
  submitLabel: string;
  /** When false, only name / stage / notes (workspace simple add). */
  showAdvancedOptions?: boolean;
}) {
  const uid = useId();
  const [draft, setDraft] = useState<NewItemDraft>(() =>
    variant === "edit" && initialDraft
      ? { ...initialDraft, lineKind: "EMBEDDED" }
      : { ...emptyDraft(defaultSortOrder), lineKind: "EMBEDDED" },
  );

  function set<K extends keyof NewItemDraft>(key: K, value: NewItemDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const canSubmit = useMemo(
    () => draft.embeddedTitle.trim() !== "" && draft.targetNodeKey.trim() !== "",
    [draft.embeddedTitle, draft.targetNodeKey],
  );

  function submit() {
    const finalized = finalizeEmbeddedDraftForSubmit(draft, existingLineKeys);
    void onSubmit(finalized);
  }

  return (
    <div className="rounded border border-emerald-900/40 bg-emerald-950/10 p-3 space-y-3 text-[11px]">
      {variant === "create" ? (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80">New task</p>
      ) : null}
      <div className="space-y-1">
        <label className="block text-zinc-400" htmlFor={`${uid}-task-name`}>
          Task name
        </label>
        <input
          id={`${uid}-task-name`}
          type="text"
          value={draft.embeddedTitle}
          onChange={(e) => set("embeddedTitle", e.target.value)}
          disabled={busy}
          placeholder="e.g. Roof tear-off"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
        />
      </div>
      <div className="space-y-1">
        <span className="block text-zinc-400">Stage</span>
        <TargetNodePicker
          workflowVersionIdForNodeKeys={pinnedWorkflowVersionId}
          value={draft.targetNodeKey}
          disabled={busy}
          onChange={(next) => set("targetNodeKey", next)}
          copyVariant="quoteScopeStage"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-zinc-400" htmlFor={`${uid}-instr`}>
          Notes
        </label>
        <textarea
          id={`${uid}-instr`}
          rows={3}
          value={draft.embeddedInstructions}
          onChange={(e) => set("embeddedInstructions", e.target.value)}
          disabled={busy}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
        />
      </div>

      {showAdvancedOptions ? (
        <details className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1">
          <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300 select-none text-[10px] font-medium uppercase tracking-wide">
            Advanced options
          </summary>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-zinc-800/80">
            <label className="space-y-1 sm:col-span-2">
              <span className="block text-zinc-500">Internal key (optional override)</span>
              <input
                type="text"
                value={draft.lineKey}
                onChange={(e) => set("lineKey", e.target.value)}
                disabled={busy}
                placeholder="Leave blank to auto-generate from task name"
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-zinc-500">Manual order</span>
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(e) => set("sortOrder", Number.parseInt(e.target.value || "0", 10))}
                disabled={busy}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-zinc-500">Tier (optional)</span>
              <input
                type="text"
                value={draft.tierCode}
                onChange={(e) => set("tierCode", e.target.value)}
                disabled={busy}
                placeholder="Blank = all tiers"
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="block text-zinc-500">Task kind (optional)</span>
              <input
                type="text"
                value={draft.embeddedTaskKind}
                onChange={(e) => set("embeddedTaskKind", e.target.value)}
                disabled={busy}
                placeholder="INSPECT / INSTALL / …"
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
              />
            </label>
          </div>
        </details>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button
          type="button"
          disabled={busy || !canSubmit}
          onClick={() => submit()}
          className="rounded bg-emerald-800/90 px-2 py-0.5 text-[11px] font-medium text-emerald-50 hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function LibraryTaskCreateForm({
  busy,
  pinnedWorkflowVersionId,
  defaultSortOrder,
  existingLineKeys,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  pinnedWorkflowVersionId: string | null;
  defaultSortOrder: number;
  existingLineKeys: string[];
  onCancel: () => void;
  onSubmit: (draft: NewItemDraft) => void | Promise<void>;
}) {
  const uid = useId();
  const [draft, setDraft] = useState<NewItemDraft>(() => ({
    ...emptyDraft(defaultSortOrder),
    lineKind: "LIBRARY",
  }));
  const [libSummary, setLibSummary] = useState<SelectedTaskDefinitionSummary | null>(null);

  function set<K extends keyof NewItemDraft>(key: K, value: NewItemDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const canSubmit =
    draft.targetNodeKey.trim() !== "" && draft.taskDefinitionId.trim() !== "";

  function submit() {
    const keySet = new Set(existingLineKeys.filter(Boolean));
    let lk = draft.lineKey.trim();
    if (lk.length === 0) {
      lk = lineKeyFromTaskName(
        libSummary?.displayName?.trim() && libSummary.displayName.trim().length > 0
          ? libSummary.displayName
          : "task",
        keySet,
      );
    }
    const next: NewItemDraft = {
      ...draft,
      lineKind: "LIBRARY",
      lineKey: lk,
      embeddedTitle: "",
      embeddedTaskKind: "",
      embeddedInstructions: "",
    };
    void onSubmit(next);
  }

  return (
    <div className="rounded border border-sky-900/40 bg-sky-950/10 p-3 space-y-3 text-[11px]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/80">
        Add from task library
      </p>
      <div className="space-y-1">
        <span className="block text-zinc-400">Saved task definition</span>
        <TaskDefinitionPicker
          initialSelectedId={null}
          initialSelectedSummary={null}
          value={draft.taskDefinitionId.trim() === "" ? null : draft.taskDefinitionId}
          disabled={busy}
          onChange={({ id, summary }) => {
            set("taskDefinitionId", id ?? "");
            setLibSummary(summary);
          }}
        />
      </div>
      <div className="space-y-1">
        <span className="block text-zinc-400">Stage</span>
        <TargetNodePicker
          workflowVersionIdForNodeKeys={pinnedWorkflowVersionId}
          value={draft.targetNodeKey}
          disabled={busy}
          onChange={(next) => set("targetNodeKey", next)}
          copyVariant="quoteScopeStage"
        />
      </div>

      <details className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1">
        <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300 select-none text-[10px] font-medium uppercase tracking-wide">
          Advanced options
        </summary>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-zinc-800/80">
          <label className="space-y-1 sm:col-span-2">
            <span className="block text-zinc-500">Internal key (optional override)</span>
            <input
              id={`${uid}-lib-key`}
              type="text"
              value={draft.lineKey}
              onChange={(e) => set("lineKey", e.target.value)}
              disabled={busy}
              placeholder="Leave blank to auto-generate from definition name"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-zinc-500">Manual order</span>
            <input
              type="number"
              value={draft.sortOrder}
              onChange={(e) => set("sortOrder", Number.parseInt(e.target.value || "0", 10))}
              disabled={busy}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-zinc-500">Tier (optional)</span>
            <input
              type="text"
              value={draft.tierCode}
              onChange={(e) => set("tierCode", e.target.value)}
              disabled={busy}
              placeholder="Blank = all tiers"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
            />
          </label>
        </div>
      </details>

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button
          type="button"
          disabled={busy || !canSubmit}
          onClick={() => submit()}
          className="rounded bg-sky-800/90 px-2 py-0.5 text-[11px] font-medium text-sky-50 hover:bg-sky-700 disabled:opacity-50"
        >
          Add task from library
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function LibraryItemEditor({
  item,
  busy,
  collisionKeys,
  pinnedWorkflowVersionId,
  onCancel,
  onSave,
}: {
  item: QuoteLocalPacketItemDto;
  busy: boolean;
  collisionKeys: string[];
  pinnedWorkflowVersionId: string | null;
  onCancel: () => void;
  onSave: (draft: NewItemDraft) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<NewItemDraft>(() => itemToDraft(item));
  const [definitionLabel, setDefinitionLabel] = useState(
    () => item.taskDefinition?.displayName ?? "",
  );

  function set<K extends keyof NewItemDraft>(key: K, value: NewItemDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const canSave =
    draft.lineKind === "LIBRARY" &&
    draft.targetNodeKey.trim() !== "" &&
    draft.taskDefinitionId.trim() !== "";

  function save() {
    const manual = draft.lineKey.trim();
    const definitionChanged = draft.taskDefinitionId !== item.taskDefinitionId;
    const resolvedKey =
      manual.length > 0
        ? manual
        : definitionChanged
          ? lineKeyFromTaskName(definitionLabel.trim() || "task", new Set(collisionKeys))
          : item.lineKey;
    void onSave({
      ...draft,
      lineKind: "LIBRARY",
      lineKey: resolvedKey,
      embeddedTitle: "",
      embeddedTaskKind: "",
      embeddedInstructions: "",
    });
  }

  return (
    <div className="rounded border border-sky-900/40 bg-sky-950/10 p-3 space-y-3 text-[11px]">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-sky-400/90">Saved task definition</p>
        <p className="text-sm text-zinc-100 mt-0.5">
          {definitionLabel.trim() !== "" ? definitionLabel : "Unknown definition"}
        </p>
      </div>
      <div className="space-y-1">
        <span className="block text-zinc-400">Stage</span>
        <TargetNodePicker
          workflowVersionIdForNodeKeys={pinnedWorkflowVersionId}
          value={draft.targetNodeKey}
          disabled={busy}
          onChange={(next) => set("targetNodeKey", next)}
          copyVariant="quoteScopeStage"
        />
      </div>

      <details className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1">
        <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300 select-none text-[10px] font-medium uppercase tracking-wide">
          Advanced options
        </summary>
        <div className="mt-2 space-y-2 pt-1 border-t border-zinc-800/80">
          <div className="space-y-1">
            <span className="block text-zinc-500">Change linked definition</span>
            <TaskDefinitionPicker
              initialSelectedId={item.taskDefinitionId}
              initialSelectedSummary={item.taskDefinition}
              value={draft.taskDefinitionId.trim() === "" ? null : draft.taskDefinitionId}
              disabled={busy}
              onChange={({ id, summary }) => {
                set("taskDefinitionId", id ?? "");
                if (summary?.displayName) setDefinitionLabel(summary.displayName);
              }}
            />
          </div>
          <label className="space-y-1 block">
            <span className="block text-zinc-500">Internal key (optional override)</span>
            <input
              type="text"
              value={draft.lineKey}
              onChange={(e) => set("lineKey", e.target.value)}
              disabled={busy}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
            />
          </label>
          <label className="space-y-1 block">
            <span className="block text-zinc-500">Manual order</span>
            <input
              type="number"
              value={draft.sortOrder}
              onChange={(e) => set("sortOrder", Number.parseInt(e.target.value || "0", 10))}
              disabled={busy}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
            />
          </label>
          <label className="space-y-1 block">
            <span className="block text-zinc-500">Tier (optional)</span>
            <input
              type="text"
              value={draft.tierCode}
              onChange={(e) => set("tierCode", e.target.value)}
              disabled={busy}
              placeholder="Blank = all tiers"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
            />
          </label>
        </div>
      </details>

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button
          type="button"
          disabled={busy || !canSave}
          onClick={() => save()}
          className="rounded bg-sky-800/90 px-2 py-0.5 text-[11px] font-medium text-sky-50 hover:bg-sky-700 disabled:opacity-50"
        >
          Save task
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
