"use client";

import { useState, useEffect } from "react";
import type { ProjectEvidenceRollupDto } from "@/lib/project-evidence-rollup-dto";
import { useRouter } from "next/navigation";

type Props = {
  flowGroupId: string;
  rollup: ProjectEvidenceRollupDto;
};

export function ProjectShareControls({ flowGroupId, rollup }: Props) {
  const [isManaging, setIsManaging] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"EMAIL" | "SMS" | "MANUAL_LINK">("EMAIL");
  const [recipientDetail, setRecipientDetail] = useState("");
  const [showExpirationForm, setShowExpirationForm] = useState(false);
  const [expiresAt, setExpiresAt] = useState(rollup.publicShareExpiresAt ? rollup.publicShareExpiresAt.split('T')[0] : "");
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (showDeliveryForm) {
      if (deliveryMethod === "EMAIL" && rollup.customerEmail) {
        setRecipientDetail(rollup.customerEmail);
      } else if (deliveryMethod === "SMS" && rollup.customerPhone) {
        setRecipientDetail(rollup.customerPhone);
      } else {
        setRecipientDetail("");
      }
    }
  }, [showDeliveryForm, deliveryMethod, rollup.customerEmail, rollup.customerPhone]);

  async function handleDeliver() {
    if (!recipientDetail.trim()) return;
    setIsManaging(true);
    try {
      const res = await fetch(`/api/projects/${flowGroupId}/share/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: deliveryMethod, recipientDetail }),
      });
      if (res.ok) {
        setShowDeliveryForm(false);
        setRecipientDetail("");
        router.refresh();
      } else {
        const error = await res.json();
        alert(`Failed to deliver link: ${error.error?.message || "Unknown error"}`);
      }
    } catch (e) {
      alert("Failed to communicate with the server.");
    } finally {
      setIsManaging(false);
    }
  }

  async function handleAction(action: "PUBLISH" | "REVOKE" | "REGENERATE") {
    setIsManaging(true);
    try {
      const res = await fetch(`/api/projects/${flowGroupId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const error = await res.json();
        alert(`Failed to manage share: ${error.error?.message || "Unknown error"}`);
      }
    } catch (e) {
      alert("Failed to communicate with the server.");
    } finally {
      setIsManaging(false);
    }
  }

  async function handleSetExpiration() {
    setIsManaging(true);
    try {
      const res = await fetch(`/api/projects/${flowGroupId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "SET_EXPIRATION", 
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null 
        }),
      });
      if (res.ok) {
        setShowExpirationForm(false);
        router.refresh();
      } else {
        const error = await res.json();
        alert(`Failed to set expiration: ${error.error?.message || "Unknown error"}`);
      }
    } catch (e) {
      alert("Failed to communicate with the server.");
    } finally {
      setIsManaging(false);
    }
  }

  async function handleResolve() {
    setIsManaging(true);
    try {
      const res = await fetch(`/api/projects/${flowGroupId}/share/resolve-clarification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: resolutionNote }),
      });
      if (res.ok) {
        setShowResolveForm(false);
        setResolutionNote("");
        router.refresh();
      } else {
        const error = await res.json();
        alert(`Failed to resolve clarification: ${error.error?.message || "Unknown error"}`);
      }
    } catch (e) {
      alert("Failed to communicate with the server.");
    } finally {
      setIsManaging(false);
    }
  }

  async function handleEscalate() {
    setIsManaging(true);
    try {
      const res = await fetch(`/api/projects/${flowGroupId}/share/escalate`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const error = await res.json();
        alert(`Failed to escalate clarification: ${error.error?.message || "Unknown error"}`);
      }
    } catch (e) {
      alert("Failed to communicate with the server.");
    } finally {
      setIsManaging(false);
    }
  }

  function handleCopy() {
    if (!rollup.publicShareToken) return;
    const url = `${window.location.origin}/portal/projects/${rollup.publicShareToken}`;
    void navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  async function handleMarkSeen() {
    setIsManaging(true);
    try {
      const res = await fetch(`/api/projects/${flowGroupId}/share/notification-seen`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (e) {
      // silent
    } finally {
      setIsManaging(false);
    }
  }

  const isPublished = rollup.publicShareStatus === "PUBLISHED";

  const lastResponseAt = rollup.publicShareReceiptAcknowledgedAt ? new Date(rollup.publicShareReceiptAcknowledgedAt) : null;
  const lastClarificationAt = rollup.publicShareClarificationRequestedAt ? new Date(rollup.publicShareClarificationRequestedAt) : null;
  
  const hasUnseenActivity = rollup.notificationPriority !== "NONE";
  const isClarificationUnresolved = rollup.isClarificationUnresolved;
  const isEscalated = !!rollup.publicShareClarificationEscalatedAt;

  function getMessagePreview() {
    const portalUrl = rollup.publicShareToken ? `${window.location.origin}/portal/projects/${rollup.publicShareToken}` : "[Link]";
    if (deliveryMethod === "EMAIL") {
      return `Subject: Project Evidence Dashboard: ${rollup.projectName}\n\nHi ${rollup.customerName},\n\nYou can now view the full verified work evidence dashboard for your project "${rollup.projectName}" at the following link:\n\n${portalUrl}\n\nThank you,\nStruxient`;
    } else if (deliveryMethod === "SMS") {
      return `Hi ${rollup.customerName}, view your full project evidence dashboard for "${rollup.projectName}" at: ${portalUrl}`;
    }
    return "Manual link share recorded.";
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            rollup.interactionStatus === "PUBLISHED" || rollup.interactionStatus === "VIEWED" || rollup.interactionStatus === "ACKNOWLEDGED" || rollup.interactionStatus === "CLARIFICATION_RESOLVED" 
              ? 'bg-emerald-500 animate-pulse' 
              : rollup.interactionStatus === "CLARIFICATION_REQUESTED" 
                ? 'bg-amber-500' 
                : 'bg-zinc-600'
          }`}></span>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Project Interaction Status: {rollup.interactionStatus.replace(/_/g, " ")}
          </p>
        </div>
        {rollup.publicShareReceiptAcknowledgedAt && (
           <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
             <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
             Acknowledged
           </span>
        )}
      </div>

      {hasUnseenActivity && (
        <div className={`flex flex-col gap-3 p-3 rounded-xl border animate-in slide-in-from-left-2 duration-300 ${
          rollup.notificationPriority === "URGENT" 
            ? "border-amber-900/20 bg-amber-900/10" 
            : "border-emerald-900/20 bg-emerald-900/10"
        }`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
               <span className={`w-2 h-2 rounded-full animate-pulse ${
                 rollup.notificationPriority === "URGENT" ? "bg-amber-500" : "bg-emerald-500"
               }`}></span>
               <div className="space-y-0.5">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${
                    rollup.notificationPriority === "URGENT" ? "text-amber-400" : "text-emerald-400"
                  }`}>
                    {rollup.notificationPriority === "URGENT" ? "Action Required" : "New Activity"}
                  </p>
                  <p className="text-[9px] text-zinc-400 font-medium italic">
                    {rollup.notificationPriority === "URGENT" 
                      ? "The customer has requested clarification." 
                      : "The customer has acknowledged the project roll-up."}
                  </p>
               </div>
            </div>
            <button
              onClick={handleMarkSeen}
              disabled={isManaging}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {isClarificationUnresolved && (
        <div className="flex flex-col gap-3 p-4 bg-amber-900/10 border border-amber-900/20 rounded-xl animate-in slide-in-from-top-2 duration-300">
           <div className="flex justify-between items-start gap-4">
              <div className="space-y-1.5">
                 <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isEscalated ? "bg-red-500" : "bg-amber-500"}`}></span>
                    <h4 className={`text-[10px] font-black uppercase tracking-widest ${isEscalated ? "text-red-400" : "text-amber-400"}`}>
                      {isEscalated ? "Clarification Escalated" : "Clarification Requested"}
                    </h4>
                 </div>
                 <p className="text-[11px] text-zinc-200 leading-relaxed font-sans italic pl-3.5 border-l-2 border-amber-900/30">
                   "{rollup.publicShareClarificationReason}"
                 </p>
                 <div className="flex items-center gap-3 pl-3.5">
                    <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">
                      Requested {new Date(rollup.publicShareClarificationRequestedAt!).toLocaleDateString()}
                    </p>
                    {isEscalated && (
                      <span className="text-[8px] font-black text-red-500/60 uppercase tracking-widest bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                        ESCALATED {new Date(rollup.publicShareClarificationEscalatedAt!).toLocaleDateString()}
                      </span>
                    )}
                 </div>
              </div>
              <div className="flex flex-col gap-2">
                {!isEscalated && (
                  <button 
                    onClick={handleEscalate}
                    disabled={isManaging}
                    className="px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-red-900/20"
                  >
                    {isManaging ? "..." : "Escalate"}
                  </button>
                )}
                <button 
                  onClick={() => setShowResolveForm(!showResolveForm)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-900/20"
                >
                  {showResolveForm ? "Cancel" : "Resolve"}
                </button>
              </div>
           </div>

           {showResolveForm && (
             <div className="space-y-3 pt-2 border-t border-amber-900/20 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="space-y-1.5">
                   <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block pl-1">Resolution Note (Internal & Customer-visible)</label>
                   <textarea 
                     value={resolutionNote}
                     onChange={e => setResolutionNote(e.target.value)}
                     placeholder="How was this resolved? (e.g. 'Added missing documents', 'Fixed task status')"
                     className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-[11px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 min-h-[60px]"
                   />
                </div>
                <button
                  onClick={handleResolve}
                  disabled={isManaging || !resolutionNote.trim()}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {isManaging ? "Resolving..." : "Complete Resolution"}
                </button>
             </div>
           )}
        </div>
      )}

      {rollup.publicShareClarificationResolvedAt && !isClarificationUnresolved && (
         <div className="flex flex-col gap-2 p-3 bg-sky-900/5 border border-sky-900/10 rounded-xl opacity-80">
            <div className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
               <h4 className="text-[9px] font-black uppercase tracking-widest text-sky-500/80">Clarification Resolved</h4>
            </div>
            <p className="text-[10px] text-zinc-500 italic pl-3.5 border-l border-sky-900/20">
              "{rollup.publicShareClarificationResolutionNote}"
            </p>
         </div>
      )}

      {isPublished && (
        <div className="flex flex-col border-y border-zinc-800/30 py-2">
           <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-1.5">
                <span className={`w-1 h-1 rounded-full ${rollup.publicShareExpiresAt && new Date(rollup.publicShareExpiresAt) < new Date() ? 'bg-red-500' : 'bg-zinc-500'}`}></span>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  {rollup.publicShareExpiresAt 
                    ? `Expires ${new Date(rollup.publicShareExpiresAt).toLocaleDateString()}` 
                    : 'No Expiration Set'}
                </p>
              </div>
              <button 
                onClick={() => setShowExpirationForm(!showExpirationForm)}
                className="text-[9px] font-black uppercase text-sky-500 hover:text-sky-400"
              >
                {showExpirationForm ? 'Cancel' : 'Edit Expiry'}
              </button>
           </div>

           {showExpirationForm && (
             <div className="flex gap-2 px-1 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <input 
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-sky-500/50"
                />
                <button
                  onClick={handleSetExpiration}
                  disabled={isManaging}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[9px] font-black uppercase tracking-widest transition-all"
                >
                  Save
                </button>
             </div>
           )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!isPublished ? (
          <button
            onClick={() => handleAction("PUBLISH")}
            disabled={isManaging}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
          >
            {isManaging ? "Publishing..." : "Publish Project Portal"}
          </button>
        ) : (
          <>
            <button
              onClick={() => setShowDeliveryForm(!showDeliveryForm)}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
            >
              Deliver Project Link
            </button>
            <button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${
                isCopied 
                  ? "bg-emerald-600 border-emerald-500 text-white" 
                  : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {isCopied ? "✓ Copied!" : "Copy Project Link"}
            </button>
            <button
              onClick={() => handleAction("REGENERATE")}
              disabled={isManaging}
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
            >
              {isManaging ? "Regenerating..." : "Regenerate Token"}
            </button>
            <button
              onClick={() => handleAction("REVOKE")}
              disabled={isManaging}
              className="px-4 py-2 bg-red-900/20 border border-red-900/40 text-red-400 hover:bg-red-900/40 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ml-auto"
            >
              {isManaging ? "Revoking..." : "Revoke Project Link"}
            </button>
          </>
        )}
      </div>

      {showDeliveryForm && (
        <div className="mt-2 p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
           <div className="flex justify-between items-center">
             <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Project Delivery Bridge</p>
             <button onClick={() => setShowDeliveryForm(false)} className="text-zinc-600 hover:text-zinc-400 text-xs font-bold uppercase tracking-widest">Cancel</button>
           </div>
           
           <div className="flex gap-2">
             {(["EMAIL", "SMS", "MANUAL_LINK"] as const).map(m => (
               <button
                 key={m}
                 onClick={() => setDeliveryMethod(m)}
                 className={`flex-1 py-2 rounded-md text-[9px] font-black uppercase tracking-widest transition-all border ${
                   deliveryMethod === m ? "bg-sky-900/20 border-sky-500 text-sky-400" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                 }`}
               >
                 {m.replace('_', ' ')}
               </button>
             ))}
           </div>

           <div className="space-y-1.5">
             <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block pl-1">
               {deliveryMethod === "EMAIL" ? "Recipient Email" : deliveryMethod === "SMS" ? "Recipient Phone" : "Note / Label"}
             </label>
             <div className="flex gap-2">
               <input 
                 type="text" 
                 value={recipientDetail}
                 onChange={e => setRecipientDetail(e.target.value)}
                 placeholder={deliveryMethod === "EMAIL" ? "customer@example.com" : deliveryMethod === "SMS" ? "555-0123" : "Internal link copy"}
                 className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-sky-500/50"
               />
               <button
                 onClick={handleDeliver}
                 disabled={isManaging || !recipientDetail.trim()}
                 className="px-6 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
               >
                 {isManaging ? "Sending..." : "Send Dashboard"}
               </button>
             </div>
           </div>

           <div className="space-y-1 bg-zinc-900/50 p-2 rounded border border-zinc-800/50">
             <p className="text-[8px] font-black uppercase tracking-widest text-zinc-700 pl-1">Message Preview</p>
             <pre className="text-[10px] text-zinc-500 whitespace-pre-wrap leading-relaxed font-sans italic">
               {getMessagePreview()}
             </pre>
           </div>
        </div>
      )}

      {rollup.deliveries.length > 0 && (
        <div className="mt-2 pt-2 border-t border-zinc-800/50 space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 pl-1">Delivery History</p>
          <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {rollup.deliveries.map(d => (
              <div key={d.id} className="flex flex-col p-2 bg-zinc-950/30 rounded border border-zinc-800/30 gap-1">
                <div className="flex justify-between items-center text-[9px]">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 font-black uppercase tracking-tighter opacity-70">[{d.deliveryMethod}]</span>
                    <span className="text-zinc-400 font-medium">{d.recipientDetail}</span>
                  </div>
                  <span className="text-zinc-600 italic">{new Date(d.deliveredAt).toLocaleDateString()} {new Date(d.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex items-center gap-1.5 pl-1">
                  <span className={`w-1 h-1 rounded-full ${
                    d.providerStatus === 'SENT' ? 'bg-emerald-500' : 
                    d.providerStatus === 'FAILED' ? 'bg-red-500' : 
                    d.providerStatus === 'SENDING' ? 'bg-sky-500 animate-pulse' :
                    'bg-amber-500'
                  }`}></span>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${
                    d.providerStatus === 'SENT' ? 'text-emerald-600' : 
                    d.providerStatus === 'FAILED' ? 'text-red-600' : 
                    d.providerStatus === 'SENDING' ? 'text-sky-600' :
                    'text-amber-600'
                  }`}>
                    {d.providerStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
