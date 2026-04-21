"use client";

import { useState } from "react";
import type { ProjectEvidenceRollupDto } from "@/lib/project-evidence-rollup-dto";
import Link from "next/link";

type Props = {
  rollup: ProjectEvidenceRollupDto;
  token: string;
};

export function ProjectEvidenceRollupView({ rollup, token }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(!!rollup.publicShareReceiptAcknowledgedAt);
  const [showClarifyForm, setShowClarifyForm] = useState(false);
  const [clarifyReason, setClarifyReason] = useState("");
  const [isClarified, setIsClarified] = useState(!!rollup.publicShareClarificationRequestedAt && !rollup.publicShareClarificationResolvedAt);

  async function handleAcknowledge() {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/portal/projects/${token}/acknowledge`, { method: "POST" });
      if (res.ok) {
        setIsAcknowledged(true);
      } else {
        alert("Failed to acknowledge receipt. Please try again.");
      }
    } catch (e) {
      alert("Communication error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleClarify() {
    if (!clarifyReason.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/portal/projects/${token}/clarify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: clarifyReason }),
      });
      if (res.ok) {
        setIsClarified(true);
        setShowClarifyForm(false);
        setIsAcknowledged(false); // Reset acknowledgment
      } else {
        alert("Failed to submit clarification request.");
      }
    } catch (e) {
      alert("Communication error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 p-8 md:p-12 print:p-0">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="border-b-2 border-zinc-900 pb-8 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="space-y-1">
              <h1 className="text-4xl font-black uppercase tracking-tighter text-zinc-900">Project Evidence Roll-up</h1>
              <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
                Generated {new Date(rollup.generatedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-xl font-black text-zinc-900">{rollup.customerName}</p>
              <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest italic">{rollup.projectName}</p>
            </div>
          </div>
        </div>

        {/* Customer Receipt Actions */}
        <div className="bg-zinc-950 text-white p-6 rounded-3xl shadow-2xl border border-zinc-800 space-y-4 print:hidden">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <h3 className="text-sm font-black uppercase tracking-widest text-sky-400">Project Dashboard Actions</h3>
              <p className="text-xs text-zinc-500 font-medium">
                {rollup.interactionStatus === "ACKNOWLEDGED" 
                  ? "Project acknowledged." 
                  : rollup.interactionStatus === "CLARIFICATION_REQUESTED" 
                    ? "Clarification pending."
                    : rollup.interactionStatus === "CLARIFICATION_RESOLVED"
                      ? "Clarification resolved. Please review."
                      : "Please acknowledge receipt of the project-level evidence roll-up."}
              </p>
            </div>
            {rollup.interactionStatus === "ACKNOWLEDGED" && (
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Project Acknowledged
              </span>
            )}
            {rollup.interactionStatus === "CLARIFICATION_REQUESTED" && (
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Clarification Pending
              </span>
            )}
            {rollup.interactionStatus === "CLARIFICATION_RESOLVED" && (
              <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                Clarification Resolved
              </span>
            )}
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
            {rollup.interactionStatus !== "ACKNOWLEDGED" && rollup.interactionStatus !== "CLARIFICATION_REQUESTED" && (
              <button
                onClick={handleAcknowledge}
                disabled={isSubmitting}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? "Processing..." : "Acknowledge Project Receipt"}
              </button>
            )}

            {rollup.interactionStatus !== "CLARIFICATION_REQUESTED" && (
              <button
                onClick={() => setShowClarifyForm(!showClarifyForm)}
                className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
              >
                {showClarifyForm ? "Cancel Request" : "Request Clarification"}
              </button>
            )}
          </div>

          {showClarifyForm && (
            <div className="pt-4 border-t border-zinc-800 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 pl-1">Reason for clarification</label>
                  <textarea 
                    value={clarifyReason}
                    onChange={e => setClarifyReason(e.target.value)}
                    placeholder="Describe what needs clarification in this project roll-up..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 min-h-[100px]"
                  />
               </div>
               <button
                 onClick={handleClarify}
                 disabled={isSubmitting || !clarifyReason.trim()}
                 className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
               >
                 Submit Project Clarification
               </button>
            </div>
          )}

          {rollup.publicShareClarificationResolvedAt && !isClarified && (
             <div className="p-4 bg-sky-900/10 border border-sky-900/20 rounded-2xl space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-sky-400">Resolution Note</p>
                <p className="text-[11px] text-zinc-300 italic">"{rollup.publicShareClarificationResolutionNote || "No note provided."}"</p>
             </div>
          )}
        </div>

        {/* Project Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="border-2 border-zinc-100 p-5 rounded-2xl bg-zinc-50/30">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">Scope</p>
            <p className="text-2xl font-black text-zinc-900">{rollup.overallStats.totalFlows} <span className="text-sm font-bold text-zinc-400">Flows</span></p>
          </div>
          <div className="border-2 border-zinc-100 p-5 rounded-2xl bg-zinc-50/30">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">Execution</p>
            <p className="text-2xl font-black text-sky-600">{rollup.overallStats.totalTasks} <span className="text-sm font-bold text-sky-400">Tasks</span></p>
          </div>
          <div className="border-2 border-zinc-100 p-5 rounded-2xl bg-zinc-50/30">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">Verified</p>
            <p className="text-2xl font-black text-emerald-600">{rollup.overallStats.acceptedTasks}</p>
          </div>
          <div className="border-2 border-emerald-100 p-5 rounded-2xl bg-emerald-50/30">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600/60 mb-1">Verification %</p>
            <p className="text-2xl font-black text-emerald-700">{rollup.overallStats.verifiedPercentage}%</p>
          </div>
        </div>

        {/* Flow Summaries */}
        <div className="space-y-8">
          <h2 className="text-2xl font-black uppercase tracking-tight border-l-8 border-zinc-900 pl-6">Work Evidence Summaries</h2>
          
          <div className="grid gap-6">
            {rollup.flows.map((flow) => (
              <div key={flow.id} className="group border-2 border-zinc-100 rounded-3xl p-6 hover:border-zinc-900 transition-all space-y-6 relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-zinc-900">{flow.title}</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200">
                        {flow.status}
                      </span>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                        {flow.stats.acceptedTasks} / {flow.stats.totalTasks} tasks verified
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Verification</p>
                      <p className="text-lg font-black text-emerald-600">{flow.stats.verifiedPercentage}%</p>
                    </div>
                    {flow.publicShareToken ? (
                      <Link 
                        href={`/portal/flows/${flow.publicShareToken}`}
                        className="px-6 py-3 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-zinc-800 transition-all active:scale-95 text-center"
                      >
                        View Full Report →
                      </Link>
                    ) : (
                      <span className="px-6 py-3 bg-zinc-50 text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-zinc-100">
                        Report Unavailable
                      </span>
                    )}
                  </div>
                </div>

                {/* Mini progress bar */}
                <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-1000" 
                    style={{ width: `${flow.stats.verifiedPercentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 pt-12 text-center space-y-3 pb-12">
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-300">Project Integrity Roll-up</p>
          <div className="flex justify-center gap-6 text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
            <span>Struxient v3</span>
            <span>•</span>
            <span>Project ID: {rollup.projectId.slice(-8).toUpperCase()}</span>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
        }
        @page {
          margin: 1.5cm;
        }
      `}} />
    </div>
  );
}
