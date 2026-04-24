"use client";

import type { LeadStatus } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LeadDetailDto } from "@/server/slice1/reads/lead-reads";
import { isLeadContentImmutable } from "@/server/slice1/invariants/lead";
import { manualLeadStatusTargets, officeLeadConvertAllowed } from "../lead-status-ui";

type MemberOption = { id: string; label: string };

export function LeadDetailClient({
  leadId,
  initial,
  assigneeLabel,
  memberOptions,
  canMutate,
  quoteId,
}: {
  leadId: string;
  initial: LeadDetailDto;
  assigneeLabel: string | null;
  memberOptions: MemberOption[];
  canMutate: boolean;
  quoteId: string | null;
}) {
  const router = useRouter();
  const [lead, setLead] = useState(initial);
  const contentLocked = isLeadContentImmutable(lead.status);
  const allowEdit = canMutate && !contentLocked;
  const allowConvert = officeLeadConvertAllowed(lead.status, canMutate);

  const [displayName, setDisplayName] = useState(lead.displayName);
  const [source, setSource] = useState(lead.source ?? "");
  const [primaryEmail, setPrimaryEmail] = useState(lead.primaryEmail ?? "");
  const [primaryPhone, setPrimaryPhone] = useState(lead.primaryPhone ?? "");
  const [summary, setSummary] = useState(lead.summary ?? "");
  const [assignedToUserId, setAssignedToUserId] = useState(lead.assignedToUserId ?? "");

  const [statusTarget, setStatusTarget] = useState<LeadStatus | "">("");
  const [lostReason, setLostReason] = useState(lead.lostReason ?? "");

  const [customerName, setCustomerName] = useState("");
  const [flowGroupName, setFlowGroupName] = useState("");

  const [busy, setBusy] = useState<null | "save" | "status" | "convert">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLead(initial);
    setDisplayName(initial.displayName);
    setSource(initial.source ?? "");
    setPrimaryEmail(initial.primaryEmail ?? "");
    setPrimaryPhone(initial.primaryPhone ?? "");
    setSummary(initial.summary ?? "");
    setAssignedToUserId(initial.assignedToUserId ?? "");
    setLostReason(initial.lostReason ?? "");
  }, [initial]);

  const statusChoices = useMemo(() => manualLeadStatusTargets(lead.status), [lead.status]);

  const assigneeDisplay = useMemo(() => {
    if (!lead.assignedToUserId) return "—";
    const m = memberOptions.find((x) => x.id === lead.assignedToUserId);
    return m?.label ?? assigneeLabel ?? lead.assignedToUserId;
  }, [lead.assignedToUserId, memberOptions, assigneeLabel]);

  async function saveEdits() {
    if (!allowEdit || busy) return;
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          displayName,
          source: source.trim() || null,
          primaryEmail: primaryEmail.trim() || null,
          primaryPhone: primaryPhone.trim() || null,
          summary: summary.trim() || null,
          assignedToUserId: assignedToUserId.trim() || null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
      if (!res.ok) {
        setError(j.error?.message ?? j.error?.code ?? `Update failed (${res.status})`);
        return;
      }
      setLead((prev) => ({
        ...prev,
        displayName,
        source: source.trim() || null,
        primaryEmail: primaryEmail.trim() || null,
        primaryPhone: primaryPhone.trim() || null,
        summary: summary.trim() || null,
        assignedToUserId: assignedToUserId.trim() || null,
      }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(null);
    }
  }

  async function applyStatus() {
    if (!canMutate || !statusTarget || busy) return;
    setBusy("status");
    setError(null);
    try {
      const body: { nextStatus: LeadStatus; lostReason?: string | null } = { nextStatus: statusTarget };
      if (statusTarget === "LOST") {
        body.lostReason = lostReason.trim() || null;
      }
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
      if (!res.ok) {
        setError(j.error?.message ?? j.error?.code ?? `Status update failed (${res.status})`);
        return;
      }
      setLead((prev) => ({
        ...prev,
        status: statusTarget,
        lostReason: statusTarget === "LOST" ? lostReason.trim() || null : null,
      }));
      setStatusTarget("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(null);
    }
  }

  async function convert() {
    if (!allowConvert || busy) return;
    setBusy("convert");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerName: customerName.trim(),
          flowGroupName: flowGroupName.trim(),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        data?: { quoteId?: string };
        error?: { message?: string; code?: string };
      };
      if (!res.ok) {
        setError(j.error?.message ?? j.error?.code ?? `Convert failed (${res.status})`);
        return;
      }
      const qid = j.data?.quoteId;
      if (!qid) {
        setError("Missing quote id after convert.");
        return;
      }
      router.replace(`/quotes/${qid}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-50">{lead.displayName}</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Status{" "}
              <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300">
                {lead.status}
              </span>
            </p>
          </div>
        </div>
      </header>

      {lead.status === "CONVERTED" ? (
        <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-sm text-emerald-100/90">
          <p className="font-medium text-emerald-200">Converted</p>
          <p className="text-emerald-100/70 text-xs mt-1">
            This lead is read-only. Open the quote or customer record to continue work.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {quoteId ? (
              <li>
                <Link href={`/quotes/${quoteId}`} className="text-sky-400 hover:text-sky-300 font-medium">
                  Open quote
                </Link>
              </li>
            ) : null}
            {lead.convertedCustomerId ? (
              <li>
                <Link href={`/customers/${lead.convertedCustomerId}`} className="text-sky-400 hover:text-sky-300">
                  Customer
                </Link>
              </li>
            ) : null}
            {lead.convertedFlowGroupId ? (
              <li>
                <Link href={`/projects/${lead.convertedFlowGroupId}`} className="text-sky-400 hover:text-sky-300">
                  Project (flow group)
                </Link>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {contentLocked && lead.status !== "CONVERTED" ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-400">
          Fields and status cannot be changed for {lead.status} leads in this MVP.
          {lead.status === "LOST" && lead.lostReason ? (
            <span className="block mt-2 text-zinc-500">
              Reason: <span className="text-zinc-300">{lead.lostReason}</span>
            </span>
          ) : null}
        </p>
      ) : null}

      {error ? (
        <p className="rounded border border-red-900/60 bg-red-950/20 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : null}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Details</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500 text-xs">Created</dt>
            <dd className="text-zinc-300">{lead.createdAt.slice(0, 19).replace("T", " ")}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 text-xs">Updated</dt>
            <dd className="text-zinc-300">{lead.updatedAt.slice(0, 19).replace("T", " ")}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 text-xs">Assignee</dt>
            <dd className="text-zinc-300">{assigneeDisplay}</dd>
          </div>
        </dl>

        {allowEdit ? (
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <label className="block text-xs font-medium text-zinc-400">
              Display name
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={!!busy}
              />
            </label>
            <label className="block text-xs font-medium text-zinc-400">
              Source
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                disabled={!!busy}
              />
            </label>
            <label className="block text-xs font-medium text-zinc-400">
              Primary email
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
                type="email"
                value={primaryEmail}
                onChange={(e) => setPrimaryEmail(e.target.value)}
                disabled={!!busy}
              />
            </label>
            <label className="block text-xs font-medium text-zinc-400">
              Primary phone
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
                value={primaryPhone}
                onChange={(e) => setPrimaryPhone(e.target.value)}
                disabled={!!busy}
              />
            </label>
            <label className="block text-xs font-medium text-zinc-400">
              Summary
              <textarea
                className="mt-1 w-full min-h-[88px] rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                disabled={!!busy}
              />
            </label>
            {memberOptions.length > 0 ? (
              <label className="block text-xs font-medium text-zinc-400">
                Assigned to
                <select
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
                  value={assignedToUserId}
                  onChange={(e) => setAssignedToUserId(e.target.value)}
                  disabled={!!busy}
                >
                  <option value="">— Unassigned —</option>
                  {memberOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => void saveEdits()}
              disabled={!!busy || !displayName.trim()}
              className="rounded-md bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600 disabled:opacity-40"
            >
              {busy === "save" ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : (
          <div className="space-y-2 pt-2 border-t border-zinc-800 text-sm text-zinc-400">
            <p>
              <span className="text-zinc-500">Source:</span> {lead.source ?? "—"}
            </p>
            <p>
              <span className="text-zinc-500">Email:</span> {lead.primaryEmail ?? "—"}
            </p>
            <p>
              <span className="text-zinc-500">Phone:</span> {lead.primaryPhone ?? "—"}
            </p>
            <p className="whitespace-pre-wrap">
              <span className="text-zinc-500">Summary:</span> {lead.summary ?? "—"}
            </p>
          </div>
        )}
      </section>

      {canMutate && statusChoices.length > 0 ? (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Change status</h2>
          <p className="text-xs text-zinc-500">Only transitions allowed by the server are listed.</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-zinc-400">
              Next status
              <select
                className="mt-1 block rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 min-w-[10rem]"
                value={statusTarget}
                onChange={(e) => setStatusTarget((e.target.value || "") as LeadStatus | "")}
                disabled={!!busy}
              >
                <option value="">— Select —</option>
                {statusChoices.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {statusTarget === "LOST" ? (
              <label className="text-xs font-medium text-zinc-400 flex-1 min-w-[12rem]">
                Lost reason (optional)
                <input
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  placeholder="Why was it lost?"
                  disabled={!!busy}
                />
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => void applyStatus()}
              disabled={!!busy || !statusTarget}
              className="rounded-md bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600 disabled:opacity-40"
            >
              {busy === "status" ? "Updating…" : "Apply status"}
            </button>
          </div>
        </section>
      ) : null}

      {allowConvert ? (
        <section className="rounded-xl border border-sky-900/40 bg-sky-950/20 p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-400/90">Convert to quote</h2>
          <p className="text-xs text-zinc-500">
            Creates a new customer and project (flow group), then opens the new commercial quote shell. Only OPEN
            leads can convert.
          </p>
          <label className="block text-xs font-medium text-zinc-400">
            Customer name
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={!!busy}
              placeholder="Legal or display name for the new customer"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-400">
            Project / flow group name
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
              value={flowGroupName}
              onChange={(e) => setFlowGroupName(e.target.value)}
              disabled={!!busy}
              placeholder="Name for the new project bucket"
            />
          </label>
          <button
            type="button"
            onClick={() => void convert()}
            disabled={!!busy || !customerName.trim() || !flowGroupName.trim()}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {busy === "convert" ? "Converting…" : "Convert and open quote"}
          </button>
        </section>
      ) : lead.status === "OPEN" && !canMutate ? (
        <p className="text-xs text-zinc-500">You need office edit permission to convert this lead.</p>
      ) : null}
    </div>
  );
}
