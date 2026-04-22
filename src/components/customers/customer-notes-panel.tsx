"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CustomerNoteSummaryDto } from "@/server/slice1/reads/customer-note-reads";

type Props = {
  customerId: string;
  initialNotes: CustomerNoteSummaryDto[];
  canOfficeMutate: boolean;
  /** Signed-in office user; edit/archive are author-only in API. */
  viewerUserId: string;
};

export function CustomerNotesPanel({ customerId, initialNotes, canOfficeMutate, viewerUserId }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const base = `/api/customers/${encodeURIComponent(customerId)}/notes`;

  async function addNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canOfficeMutate) return;
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get("body") ?? "");
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setMessage({ kind: "err", text: j.error?.message ?? `HTTP ${res.status}` });
        return;
      }
      (e.target as HTMLFormElement).reset();
      setMessage({ kind: "ok", text: "Note saved." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(noteId: string, body: string) {
    if (!canOfficeMutate) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(noteId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setMessage({ kind: "err", text: j.error?.message ?? `HTTP ${res.status}` });
        return;
      }
      setEditingId(null);
      setMessage({ kind: "ok", text: "Note updated." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function archiveNote(noteId: string) {
    if (!canOfficeMutate) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(noteId)}`, {
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
      setMessage({ kind: "ok", text: "Note archived." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6" aria-labelledby="notes-heading">
      <div className="mb-4 border-b border-zinc-800 pb-4">
        <h2 id="notes-heading" className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Notes
        </h2>
        <p className="mt-1 text-xs text-zinc-600 max-w-xl leading-relaxed">
          Office-authored context for this customer. This is not an activity timeline — system events stay in audit
          streams elsewhere. Nothing here is customer-visible or execution truth.{" "}
          <strong className="font-medium text-zinc-500">Edit and archive</strong> are limited to the author of each
          note (not every office admin).
        </p>
      </div>

      {message ? (
        <p
          className={`mb-4 text-xs ${message.kind === "ok" ? "text-emerald-500/90" : "text-amber-400"}`}
          role="status"
        >
          {message.text}
        </p>
      ) : null}

      {canOfficeMutate ? (
        <form onSubmit={(ev) => void addNote(ev)} className="mb-6 space-y-2 border-b border-zinc-800/80 pb-6">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Add note</label>
          <textarea
            name="body"
            required
            rows={3}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
            placeholder="Plain text — site access, billing context, follow-ups…"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-sky-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            Save note
          </button>
        </form>
      ) : null}

      {initialNotes.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No notes yet.
          {canOfficeMutate ? " Add context for your team — newest appears first." : ""}
        </p>
      ) : (
        <ul className="space-y-4">
          {initialNotes.map((n) => {
            const isAuthor = n.createdById === viewerUserId;
            const canEditThisNote = canOfficeMutate && isAuthor;
            return (
            <li key={n.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-zinc-500">
                <span>
                  <span className="text-zinc-400">{n.createdByLabel}</span>
                  <span className="mx-1.5">·</span>
                  <span className="font-mono">{n.createdAtIso}</span>
                  {n.updatedAtIso !== n.createdAtIso ? (
                    <span className="ml-2 text-zinc-600">(edited {n.updatedAtIso})</span>
                  ) : null}
                </span>
                {canEditThisNote ? (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditingId((id) => (id === n.id ? null : n.id))}
                      className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 hover:text-sky-400 disabled:opacity-50"
                    >
                      {editingId === n.id ? "Cancel" : "Edit"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void archiveNote(n.id)}
                      className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 hover:text-amber-400 disabled:opacity-50"
                    >
                      Archive
                    </button>
                  </div>
                ) : canOfficeMutate && !isAuthor ? (
                  <span className="text-[10px] text-zinc-600">Author only</span>
                ) : null}
              </div>
              {editingId === n.id && canEditThisNote ? (
                <EditNoteForm
                  initialBody={n.body}
                  busy={busy}
                  onSave={(body) => void saveEdit(n.id, body)}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed">{n.body}</p>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EditNoteForm({
  initialBody,
  busy,
  onSave,
}: {
  initialBody: string;
  busy: boolean;
  onSave: (body: string) => void;
}) {
  const [text, setText] = useState(initialBody);
  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => onSave(text)}
        className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
      >
        Save changes
      </button>
    </div>
  );
}
