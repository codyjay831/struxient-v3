"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

type MemberOption = { id: string; label: string };

export function NewLeadForm({ memberOptions }: { memberOptions: MemberOption[] }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [source, setSource] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [summary, setSummary] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
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
      const j = (await res.json().catch(() => ({}))) as {
        data?: { id?: string };
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setError(j.error?.message ?? j.error?.code ?? `Request failed (${res.status})`);
        return;
      }
      const id = j.data?.id;
      if (!id) {
        setError("Missing lead id in response.");
        return;
      }
      router.replace(`/leads/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <FieldRow label="Display name" required>
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Who is the prospect?"
            disabled={busy}
          />
        </FieldRow>
        <FieldRow label="Source">
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g. phone, referral, web"
            disabled={busy}
          />
        </FieldRow>
        <FieldRow label="Primary email">
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none"
            value={primaryEmail}
            onChange={(e) => setPrimaryEmail(e.target.value)}
            type="email"
            disabled={busy}
          />
        </FieldRow>
        <FieldRow label="Primary phone">
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none"
            value={primaryPhone}
            onChange={(e) => setPrimaryPhone(e.target.value)}
            disabled={busy}
          />
        </FieldRow>
        <FieldRow label="Summary">
          <textarea
            className="mt-1 w-full min-h-[100px] rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Short notes (optional)"
            disabled={busy}
          />
        </FieldRow>
        {memberOptions.length > 0 ? (
          <FieldRow label="Assigned to">
            <select
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none"
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              disabled={busy}
            >
              <option value="">— Unassigned —</option>
              {memberOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </FieldRow>
        ) : null}
      </div>

      {error ? (
        <p className="rounded border border-red-900/60 bg-red-950/20 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !displayName.trim()}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Create lead"}
        </button>
        <Link href="/leads" className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
          Cancel
        </Link>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-zinc-400">
        {label}
        {required ? <span className="text-amber-400/90"> *</span> : null}
      </label>
      {children}
    </div>
  );
}
