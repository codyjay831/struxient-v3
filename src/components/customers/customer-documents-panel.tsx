"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CustomerDocumentSummaryDto } from "@/server/slice1/reads/customer-document-reads";

type Props = {
  customerId: string;
  initialDocuments: CustomerDocumentSummaryDto[];
  canOfficeMutate: boolean;
  /** From `Tenant.customerDocumentMaxBytes` (Epic 60); null if unavailable. */
  tenantMaxUploadBytesEffective?: number | null;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Office customer **files** (Epic 06): upload + list + download + archive.
 * Not task completion evidence — uses `CustomerDocument` + `/api/media/:key` when authorized.
 */
export function CustomerDocumentsPanel({
  customerId,
  initialDocuments,
  canOfficeMutate,
  tenantMaxUploadBytesEffective,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const base = `/api/customers/${encodeURIComponent(customerId)}/documents`;

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canOfficeMutate) return;
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage({ kind: "err", text: "Choose a file to upload." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const postFd = new FormData();
      postFd.set("file", file);
      const cap = fd.get("caption");
      if (typeof cap === "string" && cap.trim()) postFd.set("caption", cap.trim());
      const cat = fd.get("category");
      if (typeof cat === "string" && cat.trim()) postFd.set("category", cat.trim());

      const res = await fetch(base, { method: "POST", credentials: "include", body: postFd });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setMessage({ kind: "err", text: j.error?.message ?? `HTTP ${res.status}` });
        return;
      }
      (e.target as HTMLFormElement).reset();
      setMessage({ kind: "ok", text: "File stored on customer record." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function archive(documentId: string) {
    if (!canOfficeMutate) return;
    if (!window.confirm("Archive this file? It will disappear from the list; storage is retained.")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(documentId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setMessage({ kind: "err", text: j.error?.message ?? `HTTP ${res.status}` });
        return;
      }
      setMessage({ kind: "ok", text: "Document archived." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Files &amp; documents</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
        Office-only attachments on this customer (plans, scans, correspondence). This is not field task evidence — those stay on
        runtime completions.
        {typeof tenantMaxUploadBytesEffective === "number" ? (
          <> Tenant max per file: {formatBytes(tenantMaxUploadBytesEffective)} (see Tenant settings).</>
        ) : null}
      </p>

      {message ? (
        <p
          className={`mt-3 text-xs ${message.kind === "ok" ? "text-emerald-400/90" : "text-rose-400/90"}`}
          role="status"
        >
          {message.text}
        </p>
      ) : null}

      {canOfficeMutate ? (
        <form onSubmit={(ev) => void onUpload(ev)} className="mt-4 space-y-3 border-t border-zinc-800/60 pt-4">
          <label className="block text-[11px] text-zinc-400">
            <span className="font-medium text-zinc-300">Upload</span>
            <input
              name="file"
              type="file"
              required
              disabled={busy}
              className="mt-1 block w-full text-xs text-zinc-200 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-[11px] file:text-zinc-200"
            />
          </label>
          <label className="block text-[11px] text-zinc-400">
            <span className="font-medium text-zinc-300">Caption (optional)</span>
            <input
              name="caption"
              type="text"
              maxLength={500}
              disabled={busy}
              placeholder="e.g. Signed NDA 2026"
              className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
            />
          </label>
          <label className="block text-[11px] text-zinc-400">
            <span className="font-medium text-zinc-300">Category override (optional)</span>
            <select
              name="category"
              disabled={busy}
              defaultValue=""
              className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
            >
              <option value="">Infer from file type</option>
              <option value="DOCUMENT">Document</option>
              <option value="IMAGE">Image</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {busy ? "Working…" : "Upload to customer"}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">Upload requires office admin permissions.</p>
      )}

      {initialDocuments.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 border-t border-zinc-800/60 pt-4">No files yet.</p>
      ) : (
        <ul className="mt-4 space-y-2 border-t border-zinc-800/60 pt-4">
          {initialDocuments.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={`/api/media/${encodeURIComponent(d.storageKey)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-sky-400 hover:text-sky-300 break-all"
                >
                  {d.fileName}
                </a>
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  {formatBytes(d.sizeBytes)} · {d.contentType} · {d.category} · {d.createdAtIso.slice(0, 10)} ·{" "}
                  {d.uploadedByLabel}
                </p>
                {d.caption ? <p className="mt-1 text-[11px] text-zinc-400">{d.caption}</p> : null}
              </div>
              {canOfficeMutate ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void archive(d.id)}
                  className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400 hover:border-rose-900/60 hover:text-rose-300 disabled:opacity-50"
                >
                  Archive
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
