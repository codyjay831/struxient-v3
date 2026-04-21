"use client";

import type { FlowWorkItemApiDto } from "@/lib/flow-execution-dto";
import { useState, useRef } from "react";
import { MediaThumbnail, MediaViewerModal } from "./execution-media-ux";
import { isBaselineRequired } from "@/lib/runtime-task-required-helpers";

type Props = {
  item: FlowWorkItemApiDto;
  busy: boolean;
  isActionTarget: boolean;
  lastActionSuccess: boolean | null;
  lastActionErrorDetails?: { message: string; field?: string }[];
  canExecuteTasks: boolean;
  canReviewTasks?: boolean;
  onStart: () => void;
    onComplete: (proof?: { 
    note?: string | null; 
    attachments?: { key: string; fileName: string; fileSize: number; contentType: string }[];
    checklist?: { label: string; status: "yes" | "no" | "na" }[];
    measurements?: { label: string; value: string; unit?: string }[];
    identifiers?: { label: string; value: string }[];
    overallResult?: string | null;
  } | null) => void;
  onReview?: (action: "ACCEPT" | "REQUEST_CORRECTION", feedback?: string) => void;
};

const STATUS_CONFIG: Record<
  FlowWorkItemApiDto["execution"]["status"],
  { label: string; cls: string; dot: string }
> = {
  not_started: { label: "To Do", cls: "border-zinc-700 bg-zinc-900/80 text-zinc-300", dot: "bg-zinc-600" },
  in_progress: { label: "In Progress", cls: "border-sky-800 bg-sky-950/40 text-sky-200", dot: "bg-sky-400" },
  completed: { label: "Pending Review", cls: "border-amber-800 bg-amber-950/40 text-amber-200", dot: "bg-amber-400" },
  accepted: { label: "Accepted", cls: "border-emerald-800 bg-emerald-950/40 text-emerald-200", dot: "bg-emerald-400" },
  correction_required: { label: "Correction Required", cls: "border-red-800 bg-red-950/40 text-red-200", dot: "bg-red-400" },
};

export function ExecutionWorkItemCard({
  item,
  busy,
  isActionTarget,
  lastActionSuccess,
  lastActionErrorDetails,
  canExecuteTasks,
  canReviewTasks,
  onStart,
  onComplete,
  onReview,
}: Props) {
  const [showProofEntry, setShowProofEntry] = useState(false);
  const [showReviewEntry, setShowReviewEntry] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<{ key: string; name: string; size: number; type: string }[]>([]);
  const [selectedAttachment, setSelectedAttachment] = useState<{ key: string; name: string; type: string } | null>(null);
  
  const [checklist, setChecklist] = useState<{ label: string; status: "yes" | "no" | "na" }[]>([]);
  const [measurements, setMeasurements] = useState<{ label: string; value: string; unit?: string }[]>([]);
  const [identifiers, setIdentifiers] = useState<{ label: string; value: string }[]>([]);
  const [overallResult, setOverallResult] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSkeleton = item.kind === "SKELETON";
  const kindLabel = isSkeleton ? "Skeleton" : "Runtime";
  const kindCls = isSkeleton
    ? "text-violet-400 border-violet-900/40 bg-violet-950/30"
    : "text-sky-400 border-sky-900/40 bg-sky-950/30";
  const config = STATUS_CONFIG[item.execution.status];

  const startBlocked = item.actionability.start.reasons.length > 0;
  const completeBlocked = item.actionability.complete.reasons.length > 0;

  const canReview = canReviewTasks && !isSkeleton && item.execution.status === "completed";

  const rules = (item.kind === "RUNTIME" && (item.conditionalRulesJson as any[])) || [];
  const triggeredRules = rules.filter((rule) => {
    const trigger = rule.trigger;
    if (trigger.kind === "result") {
      return overallResult === trigger.value;
    }
    if (trigger.kind === "checklist") {
      const c = checklist.find((i) => i.label === trigger.label);
      return c && c.status === trigger.value;
    }
    return false;
  });

  function isRuleRequired(kind: "note" | "attachment" | "measurement" | "identifier", label?: string) {
    return triggeredRules.some((rule) => {
      if (rule.require.kind !== kind) return false;
      if (kind === "measurement" || kind === "identifier") {
        return rule.require.label === label;
      }
      return true;
    });
  }

  // Note / attachment can also be required as authored baseline singletons
  // on the activation-frozen requirements snapshot. The runtime validator
  // already enforces both; these helpers keep the visual hint in sync.
  const requirementsSnapshot = item.kind === "RUNTIME" ? item.completionRequirementsJson : null;
  const noteRequired = isBaselineRequired(requirementsSnapshot, "note") || isRuleRequired("note");
  const attachmentRequired =
    isBaselineRequired(requirementsSnapshot, "attachment") || isRuleRequired("attachment");

  function hasError(field: string) {
    return isActionTarget && lastActionSuccess === false && lastActionErrorDetails?.some(e => e.field === field);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const r = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.error?.message || "Upload failed");
      }

      const j = await r.json();
      setAttachments((prev) => [...prev, { 
        key: j.data.storageKey, 
        name: j.data.fileName, 
        size: j.data.fileSize, 
        type: j.data.contentType 
      }]);
    } catch (err) {
      console.error("Upload Error:", err);
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <li
      className={`rounded-xl border shadow-sm transition-all duration-200 ${
        isActionTarget && lastActionSuccess 
          ? "border-emerald-500/50 bg-emerald-950/10 ring-1 ring-emerald-500/20" 
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
      }`}
    >
      <div className="p-4 md:p-5">
        <div className="flex flex-col gap-4">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight ${config.cls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${config.dot} animate-pulse`}></span>
                {config.label}
              </span>
              <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${kindCls}`}>
                {kindLabel}
              </span>
            </div>
            {isActionTarget && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${lastActionSuccess ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {lastActionSuccess ? "✓ Updated" : "⚠ Failed"}
              </span>
            )}
          </div>

          {/* Title and Context */}
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white tracking-tight leading-tight">{item.displayTitle}</h3>
            {item.kind === "RUNTIME" && item.instructions && (
              <p className="text-xs text-zinc-400 leading-relaxed py-1">{item.instructions}</p>
            )}
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="font-medium">Node: <span className="text-zinc-400 font-mono">{item.nodeId}</span></span>
              {!isSkeleton && (
                 <>
                   <span className="text-zinc-700">•</span>
                   <span className="font-medium">Task: <span className="text-zinc-400 font-mono">{item.runtimeTaskId.slice(-6)}</span></span>
                 </>
              )}
            </div>
          </div>

          {/* Blocked State Alerts */}
          {(startBlocked || completeBlocked || item.execution.status === "correction_required") && (
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-3 space-y-2">
              {item.execution.status === "correction_required" && item.execution.correctionFeedback && (
                <div className="flex items-start gap-2.5">
                  <div className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-red-500/40 flex items-center justify-center">
                    <div className="h-1 w-1 rounded-full bg-red-500"></div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">Correction Required</p>
                    <p className="text-xs text-red-200/70 font-medium leading-relaxed italic">
                      &ldquo;{item.execution.correctionFeedback}&rdquo;
                    </p>
                  </div>
                </div>
              )}
              {startBlocked && item.execution.status === "not_started" && (
                <div className="flex items-start gap-2.5">
                  <div className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-amber-500/40 flex items-center justify-center">
                    <div className="h-1 w-1 rounded-full bg-amber-500"></div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-tighter">Start Blocked</p>
                    <p className="text-xs text-amber-200/70 font-medium leading-relaxed italic">
                      {item.actionability.start.reasons.join(", ")}
                    </p>
                  </div>
                </div>
              )}
              {completeBlocked && item.execution.status === "in_progress" && (
                <div className="flex items-start gap-2.5">
                  <div className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-amber-500/40 flex items-center justify-center">
                    <div className="h-1 w-1 rounded-full bg-amber-500"></div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-tighter">Complete Blocked</p>
                    <p className="text-xs text-amber-200/70 font-medium leading-relaxed italic">
                      {item.actionability.complete.reasons.join(", ")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Large Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              disabled={busy || !canExecuteTasks || !item.actionability.start.canStart}
              onClick={onStart}
              className={`flex items-center justify-center rounded-xl py-3.5 px-4 text-sm font-bold transition-all active:scale-[0.98] ${
                item.actionability.start.canStart 
                  ? "bg-sky-600 text-white shadow-lg shadow-sky-950/20 hover:bg-sky-500" 
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"
              }`}
            >
              {busy && isActionTarget ? "Starting..." : "Start Task"}
            </button>
            <button
              type="button"
              disabled={busy || !canExecuteTasks || !item.actionability.complete.canComplete}
              onClick={() => {
                if (!showProofEntry && !isSkeleton) {
                  // Pre-shape form from authored requirements
                  if (item.kind === "RUNTIME" && item.completionRequirementsJson) {
                    const reqs = item.completionRequirementsJson;
                    if (Array.isArray(reqs)) {
                      const initialChecklist = reqs
                        .filter((r: any) => r.kind === "checklist")
                        .map((r: any) => ({ label: r.label, status: "yes" as const }));
                      const initialMeasurements = reqs
                        .filter((r: any) => r.kind === "measurement")
                        .map((r: any) => ({ label: r.label, value: "", unit: r.unit }));
                      const initialIdentifiers = reqs
                        .filter((r: any) => r.kind === "identifier")
                        .map((r: any) => ({ label: r.label, value: "" }));
                      
                      if (initialChecklist.length > 0) setChecklist(initialChecklist);
                      if (initialMeasurements.length > 0) setMeasurements(initialMeasurements);
                      if (initialIdentifiers.length > 0) setIdentifiers(initialIdentifiers);
                      
                      const resultReq = reqs.find((r: any) => r.kind === "result");
                      if (resultReq) setOverallResult(""); // Start with empty so they must choose if required
                    }
                  }
                  setShowProofEntry(true);
                } else {
                  onComplete(isSkeleton ? null : { 
                    note: proofNote, 
                    attachments: attachments.map(a => ({
                      key: a.key,
                      fileName: a.name,
                      fileSize: a.size,
                      contentType: a.type
                    })),
                    checklist,
                    measurements,
                    identifiers,
                    overallResult: overallResult || null
                  });
                  setShowProofEntry(false);
                  setProofNote("");
                  setAttachments([]);
                  setChecklist([]);
                  setMeasurements([]);
                  setIdentifiers([]);
                  setOverallResult("");
                }
              }}
              className={`flex items-center justify-center rounded-xl py-3.5 px-4 text-sm font-bold transition-all active:scale-[0.98] ${
                item.actionability.complete.canComplete 
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/20 hover:bg-emerald-500" 
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"
              }`}
            >
              {busy && isActionTarget ? "Completing..." : showProofEntry ? "Confirm Completion" : "Complete Task"}
            </button>
          </div>

          {canReview && (
            <div className="pt-2">
               {!showReviewEntry ? (
                 <div className="flex gap-3">
                   <button
                     type="button"
                     disabled={busy}
                     onClick={() => onReview?.("ACCEPT")}
                     className="flex-1 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-600/30 transition-colors"
                   >
                     {busy && isActionTarget ? "Reviewing..." : "✓ Accept Work"}
                   </button>
                   <button
                     type="button"
                     disabled={busy}
                     onClick={() => setShowReviewEntry(true)}
                     className="flex-1 bg-red-600/20 border border-red-500/30 text-red-400 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-600/30 transition-colors"
                   >
                     {busy && isActionTarget ? "Reviewing..." : "✗ Request Correction"}
                   </button>
                 </div>
               ) : (
                 <div className="bg-zinc-950 border border-red-900/30 rounded-xl p-4 space-y-3 animate-in fade-in zoom-in-95">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-red-500">Correction Feedback</label>
                      <textarea
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500/50 placeholder:text-zinc-700"
                        placeholder="Explain what needs to be fixed..."
                        rows={2}
                        value={reviewFeedback}
                        onChange={(e) => setReviewFeedback(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div className="flex gap-2">
                       <button
                         type="button"
                         onClick={() => {
                           setShowReviewEntry(false);
                           setReviewFeedback("");
                         }}
                         className="flex-1 py-2 rounded-lg border border-zinc-800 text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                         disabled={busy}
                       >
                         Cancel
                       </button>
                       <button
                         type="button"
                         disabled={busy || !reviewFeedback.trim()}
                         onClick={() => {
                           onReview?.("REQUEST_CORRECTION", reviewFeedback);
                           setShowReviewEntry(false);
                           setReviewFeedback("");
                         }}
                         className="flex-1 py-2 rounded-lg bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 disabled:opacity-50"
                       >
                         Send for Correction
                       </button>
                    </div>
                 </div>
               )}
            </div>
          )}

          {showProofEntry && (
            <div className="mt-2 p-4 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                  Completion Note
                  {noteRequired && <span className="text-red-500 font-bold">*</span>}
                </label>
                <textarea
                  className={`w-full bg-zinc-900 border rounded-lg p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder:text-zinc-700 ${
                    hasError("note") ? "border-red-500/50 ring-1 ring-red-500/20" : "border-zinc-800"
                  }`}
                  placeholder="Describe what was done..."
                  rows={2}
                  value={proofNote}
                  onChange={(e) => setProofNote(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProofEntry(false);
                    setProofNote("");
                    setAttachments([]);
                    setChecklist([]);
                    setMeasurements([]);
                    setIdentifiers([]);
                    setOverallResult("");
                  }}
                  className="flex-1 py-2 rounded-lg border border-zinc-800 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:bg-zinc-900"
                  disabled={busy || uploading}
                >
                  Cancel
                </button>
                <div className="flex-1 flex flex-col gap-2">
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || uploading}
                    className={`w-full py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 ${
                      attachmentRequired
                        ? "bg-amber-900/40 border-amber-800/60 text-amber-400 hover:bg-amber-900/60"
                        : "bg-sky-900/40 border-sky-800/60 text-sky-400 hover:bg-sky-900/60"
                    } ${hasError("attachments") ? "ring-2 ring-red-500/50" : ""}`}
                  >
                    {uploading ? "Uploading..." : `📎 Add Photo${attachmentRequired ? " *" : ""}`}
                  </button>
                </div>
              </div>
              
              {attachments.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-zinc-900/50">
                   <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Staged Attachments</p>
                   <div className="flex flex-wrap gap-3">
                    {attachments.map((a, i) => (
                      <div key={i} className="relative animate-in zoom-in-95">
                        <MediaThumbnail 
                          attachment={{ key: a.key, fileName: a.name, contentType: a.type }} 
                          onClick={() => setSelectedAttachment({ key: a.key, name: a.name, type: a.type })}
                          size="lg"
                        />
                        <button
                          type="button"
                          onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs shadow-lg hover:bg-red-500 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {uploading && (
                      <div className="h-20 w-20 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 flex flex-col items-center justify-center gap-1.5 animate-pulse">
                        <div className="h-4 w-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">Uploading</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Structured Data Entry */}
              <div className="space-y-3 pt-3 border-t border-zinc-900/50">
                {isActionTarget && lastActionSuccess === false && lastActionErrorDetails && (
                  <div className="rounded bg-red-500/10 border border-red-500/20 p-2 space-y-1">
                    <p className="text-[10px] font-black uppercase text-red-400">Validation Errors</p>
                    {lastActionErrorDetails.map((err, idx) => (
                      <p key={idx} className="text-[10px] text-red-300/80 italic leading-tight">• {err.message}</p>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Structured Data</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setChecklist([...checklist, { label: "", status: "yes" }])}
                      className="text-[9px] font-bold text-sky-500 hover:text-sky-400 uppercase tracking-tighter"
                    >
                      + Checklist
                    </button>
                    <button
                      type="button"
                      onClick={() => setMeasurements([...measurements, { label: "", value: "", unit: "" }])}
                      className="text-[9px] font-bold text-sky-500 hover:text-sky-400 uppercase tracking-tighter"
                    >
                      + Measure
                    </button>
                    <button
                      type="button"
                      onClick={() => setIdentifiers([...identifiers, { label: "", value: "" }])}
                      className="text-[9px] font-bold text-sky-500 hover:text-sky-400 uppercase tracking-tighter"
                    >
                      + ID
                    </button>
                  </div>
                </div>

                {checklist.length > 0 && (
                  <div className="space-y-2">
                    {checklist.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-1.5 overflow-hidden">
                          {item.kind === "RUNTIME" && item.completionRequirementsJson?.find((r: any) => r.kind === 'checklist' && r.label === c.label)?.required && (
                            <span className="text-red-500 text-[10px] font-bold">*</span>
                          )}
                          <input
                            type="text"
                            placeholder="Checklist label..."
                            className={`flex-1 bg-zinc-900 border rounded px-2 py-1 text-[10px] text-white focus:outline-none ${
                              hasError(`checklist:${c.label}`) ? "border-red-500/50 ring-1 ring-red-500/20" : "border-zinc-800"
                            }`}
                            value={c.label}
                            onChange={(e) => {
                              const next = [...checklist];
                              next[i].label = e.target.value;
                              setChecklist(next);
                            }}
                          />
                        </div>
                        <select
                          className="bg-zinc-900 border border-zinc-800 rounded px-1 py-1 text-[10px] text-white focus:outline-none"
                          value={c.status}
                          onChange={(e) => {
                            const next = [...checklist];
                            next[i].status = e.target.value as any;
                            setChecklist(next);
                          }}
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                          <option value="na">N/A</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setChecklist(checklist.filter((_, idx) => idx !== i))}
                          className="text-zinc-600 hover:text-red-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {measurements.length > 0 && (
                  <div className="space-y-2">
                    {measurements.map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {((item.kind === "RUNTIME" && item.completionRequirementsJson?.find((r: any) => r.kind === 'measurement' && r.label === m.label)?.required) || 
                          isRuleRequired("measurement", m.label)) && (
                          <span className="text-red-500 text-[10px] font-bold shrink-0">*</span>
                        )}
                        <input
                          type="text"
                          placeholder="Label..."
                          className={`w-20 bg-zinc-900 border rounded px-2 py-1 text-[10px] text-white focus:outline-none ${
                            hasError(`measurement:${m.label}`) ? "border-red-500/50 ring-1 ring-red-500/20" : "border-zinc-800"
                          }`}
                          value={m.label}
                          onChange={(e) => {
                            const next = [...measurements];
                            next[i].label = e.target.value;
                            setMeasurements(next);
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Value..."
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[10px] text-white focus:outline-none"
                          value={m.value}
                          onChange={(e) => {
                            const next = [...measurements];
                            next[i].value = e.target.value;
                            setMeasurements(next);
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Unit..."
                          className="w-12 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[10px] text-white focus:outline-none"
                          value={m.unit}
                          onChange={(e) => {
                            const next = [...measurements];
                            next[i].unit = e.target.value;
                            setMeasurements(next);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setMeasurements(measurements.filter((_, idx) => idx !== i))}
                          className="text-zinc-600 hover:text-red-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {identifiers.length > 0 && (
                  <div className="space-y-2">
                    {identifiers.map((id, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {((item.kind === "RUNTIME" && item.completionRequirementsJson?.find((r: any) => r.kind === 'identifier' && r.label === id.label)?.required) || 
                          isRuleRequired("identifier", id.label)) && (
                          <span className="text-red-500 text-[10px] font-bold shrink-0">*</span>
                        )}
                        <input
                          type="text"
                          placeholder="Identifier label (e.g. Serial #)..."
                          className={`w-32 bg-zinc-900 border rounded px-2 py-1 text-[10px] text-white focus:outline-none ${
                            hasError(`identifier:${id.label}`) ? "border-red-500/50 ring-1 ring-red-500/20" : "border-zinc-800"
                          }`}
                          value={id.label}
                          onChange={(e) => {
                            const next = [...identifiers];
                            next[i].label = e.target.value;
                            setIdentifiers(next);
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Value..."
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[10px] text-white focus:outline-none"
                          value={id.value}
                          onChange={(e) => {
                            const next = [...identifiers];
                            next[i].value = e.target.value;
                            setIdentifiers(next);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setIdentifiers(identifiers.filter((_, idx) => idx !== i))}
                          className="text-zinc-600 hover:text-red-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1">
                    Overall Result:
                    {item.kind === "RUNTIME" && item.completionRequirementsJson?.some((r: any) => r.kind === 'result' && r.required) && (
                      <span className="text-red-500 font-bold">*</span>
                    )}
                  </label>
                  <select
                    className={`flex-1 bg-zinc-900 border rounded px-2 py-1 text-[10px] text-white focus:outline-none ${
                      hasError('overallResult') ? "border-red-500/50 ring-1 ring-red-500/20" : "border-zinc-800"
                    }`}
                    value={overallResult}
                    onChange={(e) => setOverallResult(e.target.value)}
                  >
                    <option value="">None</option>
                    <option value="PASS">Pass</option>
                    <option value="FAIL">Fail</option>
                    <option value="INCOMPLETE">Incomplete</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {item.execution.status === "completed" && item.execution.completionProof && (
             <div className="mt-2 p-3 bg-zinc-950/40 border border-emerald-900/20 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/70">Completion Proof</span>
                  <div className="h-px flex-1 bg-emerald-900/20"></div>
                </div>
                {item.execution.completionProof.note && (
                  <p className="text-xs text-zinc-300 italic leading-relaxed">
                    &ldquo;{item.execution.completionProof.note}&rdquo;
                  </p>
                )}

                {(item.execution.completionProof.checklist.length > 0 || 
                  item.execution.completionProof.measurements.length > 0 ||
                  item.execution.completionProof.identifiers.length > 0 ||
                  item.execution.completionProof.overallResult) && (
                  <div className="space-y-2 pt-1">
                    {item.execution.completionProof.overallResult && (
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Result:</span>
                        <span className={`text-[10px] font-black uppercase tracking-tight ${
                          item.execution.completionProof.overallResult === 'PASS' ? 'text-emerald-500' : 
                          item.execution.completionProof.overallResult === 'FAIL' ? 'text-red-500' : 'text-amber-500'
                        }`}>
                          {item.execution.completionProof.overallResult}
                        </span>
                      </div>
                    )}
                    
                    {item.execution.completionProof.checklist.length > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {item.execution.completionProof.checklist.map((c, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className={`text-[10px] ${c.status === 'yes' ? 'text-emerald-500' : c.status === 'no' ? 'text-red-500' : 'text-zinc-500'}`}>
                              {c.status === 'yes' ? '✓' : c.status === 'no' ? '✗' : '—'}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-medium">{c.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {item.execution.completionProof.measurements.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {item.execution.completionProof.measurements.map((m, i) => (
                          <div key={i} className="flex justify-between items-center bg-zinc-900/50 rounded px-2 py-1 border border-zinc-800/50">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">{m.label}</span>
                            <span className="text-[10px] text-zinc-200 font-mono">{m.value}{m.unit ? ` ${m.unit}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {item.execution.completionProof.identifiers.length > 0 && (
                      <div className="space-y-1">
                        {item.execution.completionProof.identifiers.map((id, i) => (
                          <div key={i} className="flex justify-between items-center bg-zinc-900/50 rounded px-2 py-1 border border-zinc-800/50">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">{id.label}</span>
                            <span className="text-[10px] text-zinc-200 font-mono">{id.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {item.execution.completionProof.attachments.length > 0 && (
                   <div className="flex flex-wrap gap-3">
                      {item.execution.completionProof.attachments.map((a, i) => (
                        <MediaThumbnail 
                          key={i}
                          attachment={{ 
                            key: a.storageKey, 
                            fileName: a.fileName, 
                            contentType: a.contentType 
                          }}
                          onClick={() => setSelectedAttachment({ 
                            key: a.storageKey, 
                            name: a.fileName, 
                            type: a.contentType 
                          })}
                          size="lg"
                        />
                      ))}
                   </div>
                )}
             </div>
          )}
        </div>

        {selectedAttachment && (
          <MediaViewerModal 
            attachment={{ 
              key: selectedAttachment.key, 
              fileName: selectedAttachment.name, 
              contentType: selectedAttachment.type 
            }} 
            onClose={() => setSelectedAttachment(null)} 
          />
        )}

        {/* Technical Expandable */}
        <details className="mt-5 pt-3 border-t border-zinc-800/60 group">
          <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors list-none flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 border-t-2 border-r-2 border-zinc-600 rotate-[135deg] group-open:-rotate-45 transition-transform"></span>
            Technical Details
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[10px] text-zinc-500">
              <tbody className="divide-y divide-zinc-800/40">
                {isSkeleton ? (
                  <tr>
                    <td className="py-1 pr-4 font-medium uppercase tracking-tighter text-zinc-600">Skeleton ID</td>
                    <td className="py-1 font-mono text-zinc-400">{item.skeletonTaskId}</td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td className="py-1 pr-4 font-medium uppercase tracking-tighter text-zinc-600">Runtime ID</td>
                      <td className="py-1 font-mono text-zinc-400">{item.runtimeTaskId}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-4 font-medium uppercase tracking-tighter text-zinc-600">Line Item</td>
                      <td className="py-1 font-mono text-zinc-400">{item.lineItemId}</td>
                    </tr>
                  </>
                )}
                <tr>
                  <td className="py-1 pr-4 font-medium uppercase tracking-tighter text-zinc-600">Node ID</td>
                  <td className="py-1 font-mono text-zinc-400">{item.nodeId}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </li>
  );
}
