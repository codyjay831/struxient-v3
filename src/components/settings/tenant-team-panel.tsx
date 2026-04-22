"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { TenantMemberRole } from "@prisma/client";
import type { TenantMemberSummaryDto } from "@/server/slice1/reads/tenant-team-reads";

const ROLE_OPTIONS: { value: TenantMemberRole; label: string }[] = [
  { value: "OFFICE_ADMIN", label: "Office admin" },
  { value: "FIELD_WORKER", label: "Field worker" },
  { value: "READ_ONLY", label: "Read only" },
];

type Props = {
  currentUserId: string;
};

type RowState = {
  role: TenantMemberRole;
  busy: boolean;
  msg: { kind: "ok" | "err"; text: string } | null;
};

export function TenantTeamPanel({ currentUserId }: Props) {
  const router = useRouter();
  const [members, setMembers] = useState<TenantMemberSummaryDto[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const res = await fetch("/api/tenant/members", { credentials: "include" });
      const j = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
        data?: { members?: TenantMemberSummaryDto[] };
      };
      if (!res.ok) {
        setLoadErr(j.error?.message ?? `HTTP ${res.status}`);
        setMembers(null);
        return;
      }
      const list = j.data?.members ?? [];
      setMembers(list);
      const next: Record<string, RowState> = {};
      for (const m of list) {
        next[m.id] = { role: m.role, busy: false, msg: null };
      }
      setRowState(next);
    } catch {
      setLoadErr("Network error.");
      setMembers(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRole(userId: string) {
    const st = rowState[userId];
    if (!st) return;
    const member = members?.find((m) => m.id === userId);
    if (!member || st.role === member.role) return;

    setRowState((prev) => ({
      ...prev,
      [userId]: { ...prev[userId]!, busy: true, msg: null },
    }));
    try {
      const res = await fetch(`/api/tenant/members/${encodeURIComponent(userId)}/role`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: st.role }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
      if (!res.ok) {
        setRowState((prev) => ({
          ...prev,
          [userId]: {
            ...prev[userId]!,
            busy: false,
            msg: { kind: "err", text: j.error?.message ?? `HTTP ${res.status}` },
          },
        }));
        return;
      }
      setMembers((prev) =>
        prev ? prev.map((m) => (m.id === userId ? { ...m, role: st.role } : m)) : prev,
      );
      setRowState((prev) => ({
        ...prev,
        [userId]: { ...prev[userId]!, busy: false, msg: { kind: "ok", text: "Role updated." } },
      }));
      router.refresh();
    } catch {
      setRowState((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId]!,
          busy: false,
          msg: { kind: "err", text: "Network error." },
        },
      }));
    }
  }

  if (loadErr) {
    return (
      <div className="rounded-lg border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">
        {loadErr}
      </div>
    );
  }

  if (!members) {
    return <p className="text-sm text-zinc-500">Loading team…</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-800 bg-zinc-900/40 text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-4 py-3 font-medium">Member</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium w-40" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {members.map((m) => {
            const st = rowState[m.id];
            const dirty = st && st.role !== m.role;
            const you = m.id === currentUserId;
            return (
              <tr key={m.id} className="bg-zinc-950/30">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-200">{m.email}</div>
                  {m.displayName ? <div className="text-xs text-zinc-500">{m.displayName}</div> : null}
                  {you ? <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">You</div> : null}
                </td>
                <td className="px-4 py-3">
                  <select
                    className="w-full max-w-[200px] rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-zinc-100 disabled:opacity-50"
                    value={st?.role ?? m.role}
                    disabled={!st || st.busy}
                    onChange={(e) => {
                      const role = e.target.value as TenantMemberRole;
                      setRowState((prev) => ({
                        ...prev,
                        [m.id]: { ...(prev[m.id] ?? { role: m.role, busy: false, msg: null }), role, msg: null },
                      }));
                    }}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {st?.msg ? (
                    <p
                      className={`mt-1 text-xs ${st.msg.kind === "ok" ? "text-emerald-400/90" : "text-rose-400/90"}`}
                      role="status"
                    >
                      {st.msg.text}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={!dirty || !st || st.busy}
                    onClick={() => void saveRole(m.id)}
                    className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-40"
                  >
                    {st?.busy ? "Saving…" : "Save"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-zinc-800 px-4 py-3 text-[11px] text-zinc-500 leading-relaxed">
        Capabilities follow role: office admins can change quotes and tenant policy; field workers can execute field tasks;
        read-only is view-only. Changing your own role may require signing in again to refresh your session.
      </p>
    </div>
  );
}
