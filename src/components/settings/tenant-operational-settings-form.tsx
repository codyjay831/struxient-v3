"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TenantOperationalSettingsDto } from "@/server/slice1/reads/tenant-operational-settings-reads";

type Props = {
  initial: TenantOperationalSettingsDto;
  canOfficeMutate: boolean;
};

function mbFromBytes(n: number): string {
  return (n / (1024 * 1024)).toFixed(2).replace(/\.?0+$/, "");
}

export function TenantOperationalSettingsForm({ initial, canOfficeMutate }: Props) {
  const router = useRouter();
  const [storedMb, setStoredMb] = useState(mbFromBytes(initial.customerDocumentMaxBytesStored));
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canOfficeMutate) return;
    const mb = Number.parseFloat(storedMb);
    if (!Number.isFinite(mb) || mb <= 0) {
      setMsg({ kind: "err", text: "Enter a positive number (megabytes)." });
      return;
    }
    const bytes = Math.round(mb * 1024 * 1024);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tenant/operational-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerDocumentMaxBytes: bytes }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string }; data?: { settings?: TenantOperationalSettingsDto } };
      if (!res.ok) {
        setMsg({ kind: "err", text: j.error?.message ?? `HTTP ${res.status}` });
        return;
      }
      if (j.data?.settings) {
        setStoredMb(mbFromBytes(j.data.settings.customerDocumentMaxBytesStored));
      }
      setMsg({ kind: "ok", text: "Saved. Customer document uploads will use the new limit immediately." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const { limits } = initial;

  return (
    <form onSubmit={(ev) => void save(ev)} className="space-y-4 max-w-md">
      <div>
        <label className="block text-xs font-medium text-zinc-400">
          Max customer document upload (MB)
        </label>
        <input
          type="number"
          step="0.25"
          min={limits.minBytes / (1024 * 1024)}
          max={limits.maxBytesCeiling / (1024 * 1024)}
          value={storedMb}
          onChange={(e) => setStoredMb(e.target.value)}
          disabled={!canOfficeMutate || busy}
          className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
        />
        <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">
          Applies to office uploads on customer files. Allowed between {mbFromBytes(limits.minBytes)} MB and{" "}
          {mbFromBytes(limits.maxBytesCeiling)} MB (platform ceiling). Default product value {mbFromBytes(limits.defaultBytes)}{" "}
          MB. Effective after clamp: {mbFromBytes(initial.customerDocumentMaxBytesEffective)} MB.
        </p>
      </div>
      {canOfficeMutate ? (
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      ) : (
        <p className="text-xs text-zinc-500">Only office admins can change tenant policy.</p>
      )}
      {msg ? (
        <p className={`text-sm ${msg.kind === "ok" ? "text-emerald-400/90" : "text-rose-400/90"}`} role="status">
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}
