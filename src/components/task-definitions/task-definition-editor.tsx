"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  COMPLETION_REQUIREMENT_KINDS,
  type CompletionRequirement,
  type CompletionRequirementKind,
} from "@/lib/task-definition-authored-requirements";
import {
  CHECKLIST_TRIGGER_VALUES,
  CONDITIONAL_RULE_REQUIRE_KINDS,
  CONDITIONAL_RULE_TRIGGER_KINDS,
  RESULT_TRIGGER_VALUES,
  type ConditionalRule,
  type ConditionalRuleRequireKind,
  type ConditionalRuleTriggerKind,
} from "@/lib/task-definition-conditional-rules";

type EditorMode = "create" | "edit";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type TaskDefinitionEditorInitial = {
  id?: string;
  taskKey: string;
  displayName: string;
  status: Status;
  instructions: string | null;
  completionRequirements: CompletionRequirement[];
  conditionalRules: ConditionalRule[];
};

type Props = {
  mode: EditorMode;
  initial: TaskDefinitionEditorInitial;
};

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    context?: { issues?: { index: number; message: string }[] };
  };
};

const KIND_HELP: Record<CompletionRequirementKind, string> = {
  checklist: "Yes / No / N/A item the field tech must answer.",
  measurement: "Numeric or short value with optional unit (e.g. psi, in).",
  identifier: "Equipment serial, model, or asset identifier.",
  result: "Singleton overall PASS / FAIL gate for the task.",
  note: "Singleton — completion note text required.",
  attachment: "Singleton — at least one photo or evidence file required.",
};

const SINGLETON_KINDS: ReadonlySet<CompletionRequirementKind> = new Set([
  "result",
  "note",
  "attachment",
]);

function blankRequirement(kind: CompletionRequirementKind): CompletionRequirement {
  switch (kind) {
    case "checklist":
      return { kind: "checklist", label: "", required: true };
    case "measurement":
      return { kind: "measurement", label: "", required: true };
    case "identifier":
      return { kind: "identifier", label: "", required: true };
    case "result":
      return { kind: "result", required: true };
    case "note":
      return { kind: "note", required: true };
    case "attachment":
      return { kind: "attachment", required: true };
  }
}

export function TaskDefinitionEditor({ mode, initial }: Props) {
  const router = useRouter();
  const [taskKey, setTaskKey] = useState(initial.taskKey);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [instructions, setInstructions] = useState(initial.instructions ?? "");
  const [requirements, setRequirements] = useState<CompletionRequirement[]>(
    initial.completionRequirements,
  );
  const [rules, setRules] = useState<ConditionalRule[]>(initial.conditionalRules);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ index: number; message: string }[]>([]);
  const [ruleIssues, setRuleIssues] = useState<{ index: number; message: string }[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  const status: Status = initial.status;
  const isDraft = status === "DRAFT";
  const isCreate = mode === "create";
  const canEditContent = isCreate || isDraft;

  const usedSingletons = useMemo(
    () => new Set(requirements.filter((r) => SINGLETON_KINDS.has(r.kind)).map((r) => r.kind)),
    [requirements],
  );

  function addRequirement(kind: CompletionRequirementKind) {
    if (SINGLETON_KINDS.has(kind) && usedSingletons.has(kind)) return;
    setRequirements((prev) => [...prev, blankRequirement(kind)]);
  }

  function removeRequirement(index: number) {
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRequirement(index: number, patch: Partial<CompletionRequirement>) {
    setRequirements((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        // Patch is applied within the kind; never change `kind`.
        return { ...r, ...patch } as CompletionRequirement;
      }),
    );
  }

  function moveRequirement(index: number, dir: -1 | 1) {
    setRequirements((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // ── Conditional rules helpers ─────────────────────────────────────────────
  const checklistLabels = useMemo(
    () => requirements.filter((r) => r.kind === "checklist").map((r) => r.label),
    [requirements],
  );
  const measurementLabels = useMemo(
    () => requirements.filter((r) => r.kind === "measurement").map((r) => r.label),
    [requirements],
  );
  const identifierLabels = useMemo(
    () => requirements.filter((r) => r.kind === "identifier").map((r) => r.label),
    [requirements],
  );

  function blankRule(): ConditionalRule {
    return {
      id: `rule-${Date.now().toString(36)}`,
      trigger: { kind: "result", value: "FAIL" },
      require: { kind: "note" },
    };
  }

  function addRule() {
    setRules((prev) => [...prev, blankRule()]);
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  function setRuleTriggerKind(index: number, kind: ConditionalRuleTriggerKind) {
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        if (kind === "result") {
          return { ...r, trigger: { kind: "result", value: RESULT_TRIGGER_VALUES[1] } };
        }
        const firstChecklist = checklistLabels[0] ?? "";
        return {
          ...r,
          trigger: { kind: "checklist", label: firstChecklist, value: CHECKLIST_TRIGGER_VALUES[1] },
        };
      }),
    );
  }

  function setRuleTriggerValue(index: number, value: string) {
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        if (r.trigger.kind === "result") {
          return { ...r, trigger: { ...r.trigger, value: value as (typeof RESULT_TRIGGER_VALUES)[number] } };
        }
        return {
          ...r,
          trigger: { ...r.trigger, value: value as (typeof CHECKLIST_TRIGGER_VALUES)[number] },
        };
      }),
    );
  }

  function setRuleTriggerLabel(index: number, label: string) {
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        if (r.trigger.kind !== "checklist") return r;
        return { ...r, trigger: { ...r.trigger, label } };
      }),
    );
  }

  function setRuleRequireKind(index: number, kind: ConditionalRuleRequireKind) {
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const message = (r.require as { message?: string }).message;
        if (kind === "note" || kind === "attachment") {
          return { ...r, require: message ? { kind, message } : { kind } };
        }
        const firstLabel =
          (kind === "measurement" ? measurementLabels[0] : identifierLabels[0]) ?? "";
        return {
          ...r,
          require: message
            ? { kind, label: firstLabel, message }
            : { kind, label: firstLabel },
        };
      }),
    );
  }

  function setRuleRequireLabel(index: number, label: string) {
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        if (r.require.kind !== "measurement" && r.require.kind !== "identifier") return r;
        return { ...r, require: { ...r.require, label } };
      }),
    );
  }

  function setRuleRequireMessage(index: number, raw: string) {
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const message = raw.trim() ? raw : undefined;
        if (r.require.kind === "note" || r.require.kind === "attachment") {
          return {
            ...r,
            require: message ? { kind: r.require.kind, message } : { kind: r.require.kind },
          };
        }
        return {
          ...r,
          require: message
            ? { kind: r.require.kind, label: r.require.label, message }
            : { kind: r.require.kind, label: r.require.label },
        };
      }),
    );
  }

  async function submitContent() {
    setBusy(true);
    setError(null);
    setIssues([]);
    setRuleIssues([]);
    setSuccess(null);
    try {
      const body = isCreate
        ? {
            taskKey,
            displayName,
            instructions: instructions.trim() ? instructions : null,
            completionRequirements: requirements,
            conditionalRules: rules,
          }
        : {
            displayName,
            instructions: instructions.trim() ? instructions : null,
            completionRequirements: requirements,
            conditionalRules: rules,
          };
      const url = isCreate ? "/api/task-definitions" : `/api/task-definitions/${initial.id}`;
      const res = await fetch(url, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as ApiErrorBody & {
        data?: { id?: string };
      };
      if (!res.ok) {
        setError(j.error?.message ?? `Request failed (${res.status})`);
        const issuesList = j.error?.context?.issues;
        if (Array.isArray(issuesList)) {
          if (j.error?.code === "TASK_DEFINITION_CONDITIONAL_RULES_INVALID") {
            setRuleIssues(issuesList);
          } else {
            setIssues(issuesList);
          }
        }
        return;
      }
      setSuccess(isCreate ? "Task definition created." : "Saved.");
      if (isCreate && j.data?.id) {
        router.push(`/dev/task-definitions/${j.data.id}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(nextStatus: Status) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/task-definitions/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      const j = (await res.json().catch(() => ({}))) as ApiErrorBody;
      if (!res.ok) {
        setError(j.error?.message ?? `Status change failed (${res.status})`);
        return;
      }
      setSuccess(`Status set to ${nextStatus}.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Identity panel */}
      <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Identity
        </h2>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Task key
          </span>
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-sm disabled:opacity-50"
            value={taskKey}
            disabled={!isCreate}
            onChange={(e) => setTaskKey(e.target.value)}
            placeholder="e.g. install.condenser"
          />
          <span className="mt-1 block text-[10px] text-zinc-500">
            Stable identity within the tenant. Lowercase alphanumeric plus . _ - (2-80 chars).
            Immutable after create.
          </span>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Display name
          </span>
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm disabled:opacity-50"
            value={displayName}
            disabled={!canEditContent}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Install condenser unit"
          />
        </label>
      </section>

      {/* Instructions */}
      <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Instructions (snapshotted to runtime tasks at activation)
        </h2>
        <textarea
          className="min-h-[100px] w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-relaxed disabled:opacity-50"
          value={instructions}
          disabled={!canEditContent}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Optional. Plain text instructions shown to the field tech."
        />
      </section>

      {/* Completion requirements */}
      <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Completion requirements
          </h2>
          {canEditContent ? (
            <div className="flex flex-wrap gap-1">
              {COMPLETION_REQUIREMENT_KINDS.map((k) => {
                const disabled = SINGLETON_KINDS.has(k) && usedSingletons.has(k);
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={disabled}
                    onClick={() => addRequirement(k)}
                    className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-300 hover:border-sky-700 hover:text-sky-300 disabled:opacity-30 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300"
                    title={KIND_HELP[k]}
                  >
                    + {k}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {requirements.length === 0 ? (
          <p className="rounded border border-dashed border-zinc-800 bg-zinc-950/40 p-3 text-[11px] text-zinc-500">
            No requirements yet. The runtime validator will only enforce conditional rules (if any).
          </p>
        ) : (
          <ul className="space-y-2">
            {requirements.map((req, i) => {
              const issuesForIndex = issues.filter((iss) => iss.index === i);
              return (
                <li
                  key={`${req.kind}-${i}`}
                  className={`rounded border p-3 ${
                    issuesForIndex.length > 0
                      ? "border-rose-800/60 bg-rose-950/20"
                      : "border-zinc-800 bg-zinc-950/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-300">
                        {req.kind}
                      </span>
                      <span className="text-[11px] text-zinc-500">{KIND_HELP[req.kind]}</span>
                    </div>
                    {canEditContent ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveRequirement(i, -1)}
                          className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200"
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRequirement(i, 1)}
                          className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200"
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRequirement(i)}
                          className="rounded border border-rose-900/60 bg-rose-950/30 px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-900/40"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    {!SINGLETON_KINDS.has(req.kind) && (
                      <label className="flex-1 min-w-[180px]">
                        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                          Label
                        </span>
                        <input
                          className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm disabled:opacity-50"
                          value={(req as { label?: string }).label ?? ""}
                          disabled={!canEditContent}
                          onChange={(e) =>
                            updateRequirement(i, { label: e.target.value } as Partial<CompletionRequirement>)
                          }
                        />
                      </label>
                    )}
                    {req.kind === "measurement" && (
                      <label className="w-32">
                        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                          Unit (opt.)
                        </span>
                        <input
                          className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm disabled:opacity-50"
                          value={req.unit ?? ""}
                          disabled={!canEditContent}
                          onChange={(e) =>
                            updateRequirement(i, { unit: e.target.value } as Partial<CompletionRequirement>)
                          }
                          placeholder="psi"
                        />
                      </label>
                    )}
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={req.required}
                        disabled={!canEditContent}
                        onChange={(e) =>
                          updateRequirement(i, { required: e.target.checked } as Partial<CompletionRequirement>)
                        }
                      />
                      <span className="text-[11px] text-zinc-300">Required</span>
                    </label>
                  </div>

                  {issuesForIndex.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-[11px] text-rose-300">
                      {issuesForIndex.map((iss, ii) => (
                        <li key={ii}>· {iss.message}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Conditional rules: DRAFT-only authoring against the existing engine. */}
      <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Conditional rules
            </h2>
            <p className="mt-1 text-[10px] text-zinc-500">
              Layer extra required proof on top of baseline requirements when an outcome occurs.
              Triggers and required kinds are bounded to what the runtime engine already supports.
            </p>
          </div>
          {canEditContent ? (
            <button
              type="button"
              onClick={addRule}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-300 hover:border-sky-700 hover:text-sky-300"
            >
              + Rule
            </button>
          ) : null}
        </div>

        {rules.length === 0 ? (
          <p className="rounded border border-dashed border-zinc-800 bg-zinc-950/40 p-3 text-[11px] text-zinc-500">
            No conditional rules. The runtime validator will only enforce baseline requirements.
          </p>
        ) : (
          <ul className="space-y-2">
            {rules.map((rule, i) => {
              const issuesForIndex = ruleIssues.filter((iss) => iss.index === i);
              const noChecklists = checklistLabels.length === 0;
              const noMeasurements = measurementLabels.length === 0;
              const noIdentifiers = identifierLabels.length === 0;
              return (
                <li
                  key={rule.id || `rule-${i}`}
                  className={`rounded border p-3 ${
                    issuesForIndex.length > 0
                      ? "border-rose-800/60 bg-rose-950/20"
                      : "border-zinc-800 bg-zinc-950/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-300">
                      {rule.id}
                    </span>
                    {canEditContent ? (
                      <button
                        type="button"
                        onClick={() => removeRule(i)}
                        className="rounded border border-rose-900/60 bg-rose-950/30 px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-900/40"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {/* TRIGGER */}
                    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        When
                      </div>
                      <div className="mt-1 flex flex-wrap items-end gap-2">
                        <label>
                          <span className="block text-[10px] text-zinc-500">Trigger</span>
                          <select
                            value={rule.trigger.kind}
                            disabled={!canEditContent}
                            onChange={(e) =>
                              setRuleTriggerKind(i, e.target.value as ConditionalRuleTriggerKind)
                            }
                            className="mt-0.5 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs disabled:opacity-50"
                          >
                            {CONDITIONAL_RULE_TRIGGER_KINDS.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        </label>
                        {rule.trigger.kind === "checklist" && (
                          <label>
                            <span className="block text-[10px] text-zinc-500">Checklist item</span>
                            <select
                              value={rule.trigger.label}
                              disabled={!canEditContent || noChecklists}
                              onChange={(e) => setRuleTriggerLabel(i, e.target.value)}
                              className="mt-0.5 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs disabled:opacity-50"
                            >
                              {!checklistLabels.includes(rule.trigger.label) && (
                                <option value={rule.trigger.label}>
                                  {rule.trigger.label || "(pick a checklist item)"}
                                </option>
                              )}
                              {checklistLabels.map((l) => (
                                <option key={l} value={l}>
                                  {l}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label>
                          <span className="block text-[10px] text-zinc-500">is</span>
                          <select
                            value={rule.trigger.value}
                            disabled={!canEditContent}
                            onChange={(e) => setRuleTriggerValue(i, e.target.value)}
                            className="mt-0.5 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs disabled:opacity-50"
                          >
                            {(rule.trigger.kind === "result"
                              ? RESULT_TRIGGER_VALUES
                              : CHECKLIST_TRIGGER_VALUES
                            ).map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {rule.trigger.kind === "checklist" && noChecklists && (
                        <p className="mt-1 text-[10px] text-amber-300">
                          Add a checklist requirement above before authoring this trigger.
                        </p>
                      )}
                    </div>

                    {/* REQUIRE */}
                    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Then require
                      </div>
                      <div className="mt-1 flex flex-wrap items-end gap-2">
                        <label>
                          <span className="block text-[10px] text-zinc-500">Kind</span>
                          <select
                            value={rule.require.kind}
                            disabled={!canEditContent}
                            onChange={(e) =>
                              setRuleRequireKind(i, e.target.value as ConditionalRuleRequireKind)
                            }
                            className="mt-0.5 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs disabled:opacity-50"
                          >
                            {CONDITIONAL_RULE_REQUIRE_KINDS.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        </label>
                        {(rule.require.kind === "measurement" ||
                          rule.require.kind === "identifier") && (
                          <label>
                            <span className="block text-[10px] text-zinc-500">Item</span>
                            <select
                              value={rule.require.label}
                              disabled={
                                !canEditContent ||
                                (rule.require.kind === "measurement"
                                  ? noMeasurements
                                  : noIdentifiers)
                              }
                              onChange={(e) => setRuleRequireLabel(i, e.target.value)}
                              className="mt-0.5 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs disabled:opacity-50"
                            >
                              {(() => {
                                const list =
                                  rule.require.kind === "measurement"
                                    ? measurementLabels
                                    : identifierLabels;
                                const orphan = !list.includes(rule.require.label);
                                return (
                                  <>
                                    {orphan && (
                                      <option value={rule.require.label}>
                                        {rule.require.label || "(pick an item)"}
                                      </option>
                                    )}
                                    {list.map((l) => (
                                      <option key={l} value={l}>
                                        {l}
                                      </option>
                                    ))}
                                  </>
                                );
                              })()}
                            </select>
                          </label>
                        )}
                      </div>
                      {(rule.require.kind === "measurement" && noMeasurements) ||
                      (rule.require.kind === "identifier" && noIdentifiers) ? (
                        <p className="mt-1 text-[10px] text-amber-300">
                          Add a {rule.require.kind} requirement above before targeting it here.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <label className="mt-2 block">
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                      Custom message (optional, ≤280 chars)
                    </span>
                    <input
                      className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm disabled:opacity-50"
                      value={(rule.require as { message?: string }).message ?? ""}
                      disabled={!canEditContent}
                      onChange={(e) => setRuleRequireMessage(i, e.target.value)}
                      placeholder="Shown to the field tech when the rule blocks completion."
                    />
                  </label>

                  {issuesForIndex.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-[11px] text-rose-300">
                      {issuesForIndex.map((iss, ii) => (
                        <li key={ii}>· {iss.message}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {ruleIssues.some((iss) => iss.index === -1) && (
          <ul className="mt-1 space-y-0.5 text-[11px] text-rose-300">
            {ruleIssues
              .filter((iss) => iss.index === -1)
              .map((iss, i) => (
                <li key={i}>· {iss.message}</li>
              ))}
          </ul>
        )}
      </section>

      {/* Status panel (edit only) */}
      {!isCreate && (
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Status
            </h2>
            <span
              className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                status === "PUBLISHED"
                  ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-300"
                  : status === "DRAFT"
                  ? "border-amber-800/60 bg-amber-950/30 text-amber-300"
                  : "border-zinc-700 bg-zinc-900/40 text-zinc-500"
              }`}
            >
              {status}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "DRAFT" && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setStatus("PUBLISHED")}
                  className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  Publish
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setStatus("ARCHIVED")}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                >
                  Archive
                </button>
              </>
            )}
            {status === "PUBLISHED" && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setStatus("DRAFT")}
                  className="rounded border border-amber-800/60 bg-amber-950/20 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-900/30 disabled:opacity-50"
                >
                  Move to draft
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setStatus("ARCHIVED")}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                >
                  Archive
                </button>
              </>
            )}
            {status === "ARCHIVED" && (
              <span className="text-[11px] text-zinc-500">
                Archived definitions are terminal. Re-key to re-create.
              </span>
            )}
          </div>
          <p className="text-[10px] leading-relaxed text-zinc-500">
            PUBLISHED definitions are content-locked; move back to DRAFT to edit. Activated
            RuntimeTask snapshots are unaffected by status changes.
          </p>
        </section>
      )}

      {/* Actions */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dev/task-definitions" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Back to list
        </Link>
        {canEditContent ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitContent()}
            className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {busy ? "Saving…" : isCreate ? "Create task definition" : "Save"}
          </button>
        ) : (
          <span className="text-[11px] text-zinc-500">
            Editing locked while {status}. Move to DRAFT to make changes.
          </span>
        )}
      </section>

      {error && (
        <div className="rounded border border-rose-900/60 bg-rose-950/30 p-3 text-[12px] text-rose-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded border border-emerald-900/60 bg-emerald-950/30 p-3 text-[12px] text-emerald-200">
          {success}
        </div>
      )}
    </div>
  );
}
