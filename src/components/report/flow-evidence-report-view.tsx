"use client";

import { MediaThumbnail, MediaViewerModal } from "@/components/execution/execution-media-ux";
import type { FlowEvidenceReportDto } from "@/lib/flow-evidence-report-dto";
import { useState } from "react";

type Props = {
  report: FlowEvidenceReportDto;
  token?: string; // If viewing via public share token
};

export function FlowEvidenceReportView({ report, token }: Props) {
  const [selectedAttachment, setSelectedAttachment] = useState<{ key: string; name: string; type: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClarificationForm, setShowClarificationForm] = useState(false);
  const [clarificationReason, setClarificationReason] = useState("");
  const [isAcknowledged, setIsAcknowledged] = useState(!!report.flow.receiptAcknowledgedAt);
  const [clarificationRequestedAt, setClarificationRequestedAt] = useState(report.flow.clarificationRequestedAt);

  async function handleAcknowledge() {
    if (!token) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/portal/flows/${token}/acknowledge`, { method: "POST" });
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

  async function handleRequestClarification() {
    if (!token || !clarificationReason.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/portal/flows/${token}/clarification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: clarificationReason }),
      });
      if (res.ok) {
        setClarificationRequestedAt(new Date().toISOString());
        setShowClarificationForm(false);
      } else {
        alert("Failed to submit request. Please try again.");
      }
    } catch (e) {
      alert("Communication error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 p-8 md:p-12 print:p-0">
      {/* Report Header */}
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start border-b-2 border-zinc-900 pb-6 gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-zinc-900">Verified Evidence Report</h1>
            <div className="flex items-center gap-3">
              <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{report.reportId} • Generated {new Date(report.generatedAt).toLocaleDateString()}</p>
              {report.flow.expiresAt && (
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                  new Date(report.flow.expiresAt) < new Date() ? 'bg-red-50 text-red-700 border-red-200' : 'bg-zinc-50 text-zinc-400 border-zinc-200'
                }`}>
                  Access Expires {new Date(report.flow.expiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="text-right space-y-1">
             <p className="text-lg font-black text-zinc-900">{report.customer.name}</p>
             <p className="text-sm font-medium text-zinc-500 italic">Project: {report.job.name}</p>
             <p className="text-sm font-medium text-zinc-500">Flow: {report.flow.quoteNumber}</p>
          </div>
        </div>
        
        {/* Customer Review Actions (Portal Only) */}
        {token && (
          <div className="bg-zinc-950 text-white p-6 rounded-2xl shadow-2xl border border-zinc-800 space-y-4 print:hidden animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex justify-between items-start">
               <div className="space-y-1">
                 <h3 className="text-sm font-black uppercase tracking-widest text-sky-400">Portal Review Actions</h3>
                 <p className="text-xs text-zinc-500 font-medium">Please acknowledge receipt or request clarification if needed.</p>
               </div>
               {(isAcknowledged || clarificationRequestedAt) && (
                 <div className="flex gap-2">
                   {isAcknowledged && (
                     <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                       Receipt Acknowledged
                     </span>
                   )}
                   {clarificationRequestedAt && (
                     <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                       <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                       Clarification Requested
                     </span>
                   )}
                 </div>
               )}
            </div>

            <div className="flex flex-wrap gap-3">
              {!isAcknowledged && (
                <button
                  onClick={handleAcknowledge}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? "Processing..." : "Acknowledge Receipt"}
                </button>
              )}
              
              {!showClarificationForm ? (
                <button
                  onClick={() => setShowClarificationForm(true)}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                >
                  Request Clarification
                </button>
              ) : (
                <div className="w-full space-y-3 pt-2">
                  <textarea
                    value={clarificationReason}
                    onChange={(e) => setClarificationReason(e.target.value)}
                    placeholder="Describe what needs clarification..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/50 min-h-[100px]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleRequestClarification}
                      disabled={isSubmitting || !clarificationReason.trim()}
                      className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Request"}
                    </button>
                    <button
                      onClick={() => setShowClarificationForm(false)}
                      disabled={isSubmitting}
                      className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-zinc-200 p-4 rounded-lg bg-zinc-50/50">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Scope</p>
            <p className="text-xl font-bold">{report.stats.totalTasks} Tasks</p>
          </div>
          <div className="border border-zinc-200 p-4 rounded-lg bg-zinc-50/50">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Execution</p>
            <p className="text-xl font-bold text-sky-600">{report.stats.completedTasks} Completed</p>
          </div>
          <div className="border border-zinc-200 p-4 rounded-lg bg-zinc-50/50">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Verified Truth</p>
            <p className="text-xl font-bold text-emerald-600">{report.stats.acceptedTasks} Accepted</p>
          </div>
          <div className="border border-zinc-200 p-4 rounded-lg bg-emerald-50/50 border-emerald-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60">Compliance</p>
            <p className="text-xl font-black text-emerald-700">{report.stats.verifiedPercentage}%</p>
          </div>
        </div>

        {/* Evidence List */}
        <div className="space-y-12 pt-8">
           <h2 className="text-xl font-black uppercase tracking-tight border-l-4 border-zinc-900 pl-4">Work Evidence Log</h2>
           
           {report.tasks.map((task, i) => (
             <div key={i} className={`space-y-4 pb-8 border-b border-zinc-100 last:border-0 ${!task.completedAt ? 'opacity-50 print:hidden' : ''}`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-zinc-400 font-mono">{(i + 1).toString().padStart(2, '0')}</span>
                    <h3 className="text-lg font-bold text-zinc-900">{task.displayTitle}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                      task.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      task.status === 'completed' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-zinc-50 text-zinc-500 border-zinc-200'
                    }`}>
                      {task.status === 'accepted' ? '✓ Verified' : task.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {task.proof ? (
                  <div className="pl-8 space-y-6">
                    {/* Note */}
                    {task.proof.note && (
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Completion Note</p>
                        <p className="text-sm text-zinc-700 leading-relaxed italic">&ldquo;{task.proof.note}&rdquo;</p>
                      </div>
                    )}

                    {/* Checklists */}
                    {task.proof.checklist.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Verification Checklist</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
                          {task.proof.checklist.map((c, ci) => (
                            <div key={ci} className="flex items-center justify-between text-xs border-b border-zinc-50 pb-1">
                              <span className="text-zinc-600">{c.label}</span>
                              <span className={`font-bold ${c.status === 'yes' ? 'text-emerald-600' : c.status === 'no' ? 'text-red-600' : 'text-zinc-400'}`}>
                                {c.status.toUpperCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Data Points (Measurements & Identifiers) */}
                    {(task.proof.measurements.length > 0 || task.proof.identifiers.length > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {task.proof.measurements.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Measurements</p>
                            <div className="space-y-1">
                              {task.proof.measurements.map((m, mi) => (
                                <div key={mi} className="flex justify-between text-xs bg-zinc-50 p-2 rounded">
                                  <span className="text-zinc-500 font-medium">{m.label}</span>
                                  <span className="font-bold text-zinc-900 font-mono">{m.value}{m.unit ? ` ${m.unit}` : ''}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {task.proof.identifiers.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Identifiers</p>
                            <div className="space-y-1">
                              {task.proof.identifiers.map((id, idi) => (
                                <div key={idi} className="flex justify-between text-xs bg-zinc-50 p-2 rounded">
                                  <span className="text-zinc-500 font-medium">{id.label}</span>
                                  <span className="font-bold text-zinc-900 font-mono">{id.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Overall Result */}
                    {task.proof.overallResult && (
                      <div className="flex items-center gap-3">
                         <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Task Outcome:</p>
                         <span className={`text-xs font-black px-2 py-0.5 rounded ${
                           task.proof.overallResult === 'PASS' ? 'text-emerald-700 bg-emerald-50' : 
                           task.proof.overallResult === 'FAIL' ? 'text-red-700 bg-red-50' : 
                           'text-amber-700 bg-amber-50'
                         }`}>
                           {task.proof.overallResult}
                         </span>
                      </div>
                    )}

                    {/* Attachments */}
                    {task.proof.attachments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Media Evidence ({task.proof.attachments.length})</p>
                        <div className="flex flex-wrap gap-4">
                          {task.proof.attachments.map((a, ai) => (
                            <div key={ai} className="print:w-32 print:h-32">
                               <MediaThumbnail 
                                 attachment={{ key: a.storageKey, fileName: a.fileName, contentType: a.contentType }} 
                                 size="lg"
                                 token={token}
                                 onClick={() => setSelectedAttachment({ key: a.storageKey, name: a.fileName, type: a.contentType })}
                               />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Review Metadata */}
                    {task.reviewedAt && (
                      <div className="text-[9px] font-medium text-zinc-400 pt-2 italic">
                        Verified on {new Date(task.reviewedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pl-8">
                     <p className="text-xs text-zinc-400 italic">No completion evidence recorded.</p>
                  </div>
                )}
             </div>
           ))}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 pt-12 text-center space-y-2 pb-12">
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300">End of Evidence Report</p>
           <p className="text-[9px] font-medium text-zinc-400">Generated via Struxient v3 • {new Date().toISOString()}</p>
        </div>
      </div>

      {/* Print Controls (Screen Only) */}
      <div className="fixed bottom-6 right-6 print:hidden flex gap-3">
         <button 
           onClick={() => window.print()}
           className="bg-zinc-900 text-white px-6 py-3 rounded-full font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-zinc-800 active:scale-95 transition-all"
         >
           Print to PDF
         </button>
      </div>

      {selectedAttachment && (
        <MediaViewerModal 
          attachment={{ 
            key: selectedAttachment.key, 
            fileName: selectedAttachment.name, 
            contentType: selectedAttachment.type 
          }} 
          token={token}
          onClose={() => setSelectedAttachment(null)} 
        />
      )}
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
        }
        @page {
          margin: 1cm;
        }
      `}} />
    </div>
  );
}
