"use client";

import { useState, useEffect } from "react";
import type { FlowExecutionApiDto } from "@/lib/flow-execution-dto";
import { useRouter } from "next/navigation";

type Props = {
  flowId: string;
  share: FlowExecutionApiDto["flow"];
  customer: FlowExecutionApiDto["customer"];
  project: FlowExecutionApiDto["project"];
  tenant: FlowExecutionApiDto["tenant"];
  deliveries: FlowExecutionApiDto["deliveries"];
};

export function FlowShareControls({ flowId, share, customer, project, tenant, deliveries }: Props) {
  const [isManaging, setIsManaging] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"EMAIL" | "SMS" | "MANUAL_LINK">("EMAIL");
  const [recipientDetail, setRecipientDetail] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [showExpirationForm, setShowExpirationForm] = useState(false);
  const [expiresAt, setExpiresAt] = useState(share.publicShareExpiresAt ? share.publicShareExpiresAt.split('T')[0] : "");
  const router = useRouter();

  useEffect(() => {
    if (showDeliveryForm) {
      if (deliveryMethod === "EMAIL" && customer.email) {
        setRecipientDetail(customer.email);
      } else if (deliveryMethod === "SMS" && customer.phone) {
        setRecipientDetail(customer.phone);
      } else {
        setRecipientDetail("");
      }
    }
  }, [showDeliveryForm, deliveryMethod, customer.email, customer.phone]);

  async function handleDeliver(isFollowUp: boolean = false) {
    if (!recipientDetail.trim()) return;
    setIsManaging(true);
    try {
      const res = await fetch(`/api/flows/${flowId}/share/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: deliveryMethod, recipientDetail, isFollowUp }),
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

  async function handleRetry(deliveryId: string) {
    setIsManaging(true);
    try {
      const res = await fetch(`/api/flows/${flowId}/share/deliver/${deliveryId}/retry`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const error = await res.json();
        alert(`Failed to retry delivery: ${error.error?.message || "Unknown error"}`);
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
      const res = await fetch(`/api/flows/${flowId}/share`, {
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
      const res = await fetch(`/api/flows/${flowId}/share`, {
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

  function handleCopy() {
    if (!share.publicShareToken) return;
    const url = `${window.location.origin}/portal/flows/${share.publicShareToken}`;
    void navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  const isPublished = share.publicShareStatus === "PUBLISHED";
  const hasDeliveries = deliveries.length > 0;
  const neverViewed = hasDeliveries && share.publicShareViewCount === 0;
  const recentlyViewed = share.publicShareViewCount > 0 && !share.publicShareLastFollowUpSentAt;

  const lastResponseAt = [
    share.publicShareClarificationRequestedAt,
    share.publicShareReceiptAcknowledgedAt
  ].filter(Boolean).map(d => new Date(d!)).sort((a, b) => b.getTime() - a.getTime())[0] || null;

  const hasUnseenResponse = lastResponseAt && (!share.publicShareNotificationLastSeenAt || new Date(share.publicShareNotificationLastSeenAt) < lastResponseAt);
  const isClarificationPending = share.publicShareClarificationRequestedAt && !share.publicShareClarificationResolvedAt;

  async function handleMarkSeen() {
    setIsManaging(true);
    try {
      const res = await fetch(`/api/flows/${flowId}/share/notification-seen`, {
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

  async function handleResolve() {
    setIsManaging(true);
    try {
      const res = await fetch(`/api/flows/${flowId}/share/resolve-clarification`, {
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

  function getRecommendation() {
    if (!isPublished) return null;
    if (neverViewed) return { type: 'NEVER_VIEWED', label: 'Customer has not accessed the portal yet. Consider a follow-up.' };
    if (recentlyViewed) return { type: 'FIRST_VIEW', label: 'Customer recently accessed the portal. Acknowledge and confirm details?' };
    return null;
  }

  const recommendation = getRecommendation();

  function getMessagePreview() {
    const portalUrl = share.publicShareToken ? `${window.location.origin}/portal/flows/${share.publicShareToken}` : "[Link]";
    const isFollowUp = !!recommendation;
    if (deliveryMethod === "EMAIL") {
      const subjectPrefix = isFollowUp ? "FOLLOW-UP: " : "";
      const intro = isFollowUp 
        ? `Following up on your project "${project.name}". Just a reminder that you can view the verified work evidence at the link below:`
        : `You can view the verified work evidence for your project "${project.name}" at the following link:`;
      
      return `Subject: ${subjectPrefix}Work Evidence Portal: ${project.name}\n\nHi ${customer.name},\n\n${intro}\n\n${portalUrl}\n\nThank you,\n${tenant.name}`;
    } else if (deliveryMethod === "SMS") {
      return isFollowUp 
        ? `Follow-up: View your project "${project.name}" evidence at: ${portalUrl}`
        : `Hi ${customer.name}, view your project evidence for "${project.name}" at: ${portalUrl}`;
    }
    return "Manual link share recorded.";
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isPublished ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}></span>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Customer Share: {share.publicShareStatus}
          </p>
        </div>
        {share.publicShareTokenGeneratedAt && (
           <p className="text-[9px] text-zinc-600 font-medium italic">
             Token created {new Date(share.publicShareTokenGeneratedAt).toLocaleDateString()}
           </p>
        )}
      </div>

      {share.publicShareViewCount > 0 && (
        <div className="flex flex-col mb-1 border-y border-zinc-800/30">
          <div className="flex justify-between items-center px-1 py-1">
            <div className="flex items-center gap-1.5" title="Total valid portal accesses">
              <span className="w-1 h-1 rounded-full bg-sky-500"></span>
              <p className="text-[9px] font-black uppercase tracking-widest text-sky-500/80">
                {share.publicShareViewCount} View{share.publicShareViewCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex gap-3 text-[9px] text-zinc-600 font-medium italic">
              {share.publicShareFirstViewedAt && (
                <span>First: {new Date(share.publicShareFirstViewedAt).toLocaleDateString()}</span>
              )}
              {share.publicShareLastViewedAt && (
                <span>Latest: {new Date(share.publicShareLastViewedAt).toLocaleDateString()}</span>
              )}
              {share.publicShareLastFollowUpSentAt && (
                <span className="text-amber-500/80">Follow-up: {new Date(share.publicShareLastFollowUpSentAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          
          {(share.publicShareReceiptAcknowledgedAt || share.publicShareClarificationRequestedAt) && (
            <div className="px-1 pb-1 pt-0.5 space-y-1">
               {share.publicShareReceiptAcknowledgedAt && (
                 <div className="flex items-center gap-1.5">
                   <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                   <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/80">
                     Receipt Acknowledged {new Date(share.publicShareReceiptAcknowledgedAt).toLocaleDateString()}
                   </p>
                 </div>
               )}
               {share.publicShareClarificationRequestedAt && (
                 <div className="flex flex-col gap-1 p-1.5 bg-amber-950/20 border border-amber-900/20 rounded">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1 h-1 rounded-full ${share.publicShareClarificationResolvedAt ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${share.publicShareClarificationResolvedAt ? 'text-emerald-500/80' : 'text-amber-500'}`}>
                          Clarification {share.publicShareClarificationResolvedAt ? 'Resolved' : 'Requested'} {new Date(share.publicShareClarificationResolvedAt || share.publicShareClarificationRequestedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {share.publicShareClarificationReason && (
                       <p className="text-[10px] text-amber-200/70 italic leading-relaxed pl-2.5">&ldquo;{share.publicShareClarificationReason}&rdquo;</p>
                    )}
                    {share.publicShareClarificationResolvedAt && share.publicShareClarificationResolutionNote && (
                       <div className="mt-1 pl-2.5 border-l border-emerald-500/30">
                          <p className="text-[8px] font-black uppercase text-emerald-600/60 mb-0.5 tracking-tighter">Resolution Note</p>
                          <p className="text-[10px] text-emerald-200/70 italic leading-relaxed">&ldquo;{share.publicShareClarificationResolutionNote}&rdquo;</p>
                       </div>
                    )}
                 </div>
               )}
            </div>
          )}
        </div>
      )}

      {isPublished && (
        <div className="flex flex-col mb-1 border-b border-zinc-800/30 pb-1">
           <div className="flex justify-between items-center px-1 py-1">
              <div className="flex items-center gap-1.5">
                <span className={`w-1 h-1 rounded-full ${share.publicShareExpiresAt && new Date(share.publicShareExpiresAt) < new Date() ? 'bg-red-500' : 'bg-zinc-500'}`}></span>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  {share.publicShareExpiresAt 
                    ? `Expires ${new Date(share.publicShareExpiresAt).toLocaleDateString()}` 
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
             <div className="flex gap-2 px-1 py-1 animate-in fade-in slide-in-from-top-1 duration-200">
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

      {isPublished && recommendation && (
        <div className="flex items-center gap-2 p-2 bg-amber-900/20 border border-amber-900/40 rounded-lg mb-1">
          <span className="text-[12px]">💡</span>
          <p className="text-[10px] text-amber-200 font-medium">
            {recommendation.label}
          </p>
        </div>
      )}

      {(hasUnseenResponse || isClarificationPending) && (
        <div className={`flex flex-col gap-3 p-3 rounded-xl border animate-in slide-in-from-left-2 duration-300 mb-1 ${
          isClarificationPending ? 'bg-red-900/20 border-red-900/40' : 'bg-emerald-900/10 border-emerald-900/20'
        }`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
               <span className={`w-2 h-2 rounded-full ${isClarificationPending ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
               <div className="space-y-0.5">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${isClarificationPending ? 'text-red-400' : 'text-emerald-400'}`}>
                    {isClarificationPending ? 'Clarification Required' : 'Customer Response'}
                  </p>
                  <p className="text-[9px] text-zinc-400 font-medium italic">
                    {isClarificationPending ? 'Customer has questions about the evidence.' : 'Customer has acknowledged the report.'}
                  </p>
               </div>
            </div>
            <div className="flex gap-2">
              {isClarificationPending && !showResolveForm && (
                <button
                  onClick={() => setShowResolveForm(true)}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                >
                  Resolve
                </button>
              )}
              <button
                onClick={handleMarkSeen}
                disabled={isManaging}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>

          {isClarificationPending && showResolveForm && (
            <div className="space-y-2 pt-2 border-t border-red-900/20">
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Internal resolution note (optional)..."
                className="w-full bg-black/40 border border-red-900/40 rounded-lg px-3 py-2 text-[10px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-sky-500/50 min-h-[60px]"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleResolve}
                  disabled={isManaging}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                >
                  {isManaging ? "Resolving..." : "Mark Resolved"}
                </button>
                <button
                  onClick={() => setShowResolveForm(false)}
                  disabled={isManaging}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!isPublished ? (
          <button
            onClick={() => handleAction("PUBLISH")}
            disabled={isManaging}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
          >
            {isManaging ? "Publishing..." : "Publish Evidence"}
          </button>
        ) : (
          <>
            <button
              onClick={() => setShowDeliveryForm(!showDeliveryForm)}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
            >
              Send to Customer
            </button>
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${
                isCopied 
                  ? "bg-emerald-600 border-emerald-500 text-white" 
                  : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {isCopied ? "✓ Copied!" : "Copy Portal Link"}
            </button>
            <button
              onClick={() => handleAction("REGENERATE")}
              disabled={isManaging}
              className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
            >
              {isManaging ? "Regenerating..." : "Regenerate Token"}
            </button>
            <button
              onClick={() => handleAction("REVOKE")}
              disabled={isManaging}
              className="px-3 py-1.5 bg-red-900/20 border border-red-900/40 text-red-400 hover:bg-red-900/40 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ml-auto"
            >
              {isManaging ? "Revoking..." : "Revoke Access"}
            </button>
          </>
        )}
      </div>

      {showDeliveryForm && (
        <div className="mt-2 p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
           <div className="flex justify-between items-center">
             <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Delivery Bridge</p>
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
                 onClick={() => handleDeliver(!!recommendation)}
                 disabled={isManaging || !recipientDetail.trim()}
                 className={`px-4 py-2 ${!!recommendation ? 'bg-amber-600 hover:bg-amber-500' : 'bg-sky-600 hover:bg-sky-500'} disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all`}
               >
                 {isManaging ? "Sending..." : (!!recommendation ? "Send Follow-up" : "Send")}
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

      {isPublished && (
        <p className="text-[9px] text-zinc-500 leading-relaxed bg-zinc-950/50 p-2 rounded border border-zinc-800/50">
          The verified evidence portal is currently live. Anyone with the portal link can view verified work, notes, and media.
        </p>
      )}

      {deliveries.length > 0 && (
        <div className="mt-2 pt-2 border-t border-zinc-800/50 space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 pl-1">Delivery History</p>
          <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {deliveries.map(d => (
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
                  {d.providerStatus === 'FAILED' && (
                    <button 
                      onClick={() => handleRetry(d.id)}
                      disabled={isManaging}
                      className="text-[8px] font-black uppercase text-sky-500 hover:text-sky-400 disabled:opacity-50 ml-2"
                    >
                      Retry
                    </button>
                  )}
                  {d.providerError && (
                    <span className="text-[8px] text-red-900 font-medium truncate ml-1 opacity-70" title={d.providerError}>
                      {d.providerError}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
