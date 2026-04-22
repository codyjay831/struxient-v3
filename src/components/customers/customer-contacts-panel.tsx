"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CustomerContactSummaryDto } from "@/server/slice1/reads/customer-contact-reads";

type Props = {
  customerId: string;
  initialContacts: CustomerContactSummaryDto[];
  canOfficeMutate: boolean;
};

const ROLES = ["", "BILLING", "SITE", "OWNER", "OTHER"] as const;
const METHOD_TYPES = ["EMAIL", "PHONE", "MOBILE", "OTHER"] as const;

export function CustomerContactsPanel({ customerId, initialContacts, canOfficeMutate }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const base = `/api/customers/${encodeURIComponent(customerId)}/contacts`;

  async function refresh(msg?: { kind: "ok" | "err"; text: string }) {
    if (msg) setMessage(msg);
    setBusy(true);
    try {
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canOfficeMutate) return;
    const fd = new FormData(e.currentTarget);
    const displayName = String(fd.get("displayName") ?? "").trim();
    const role = String(fd.get("role") ?? "").trim();
    const notes = String(fd.get("notes") ?? "").trim();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          ...(role ? { role } : {}),
          ...(notes ? { notes } : {}),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setMessage({ kind: "err", text: j.error?.message ?? `HTTP ${res.status}` });
        return;
      }
      (e.target as HTMLFormElement).reset();
      await refresh({ kind: "ok", text: "Contact added." });
    } finally {
      setBusy(false);
    }
  }

  async function archiveContact(contactId: string) {
    if (!canOfficeMutate) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(contactId)}`, {
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
      await refresh({ kind: "ok", text: "Contact archived." });
    } finally {
      setBusy(false);
    }
  }

  async function addMethod(e: React.FormEvent<HTMLFormElement>, contactId: string) {
    e.preventDefault();
    if (!canOfficeMutate) return;
    const fd = new FormData(e.currentTarget);
    const type = String(fd.get("type") ?? "");
    const value = String(fd.get("value") ?? "").trim();
    const isPrimary = fd.get("isPrimary") === "on";
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(contactId)}/methods`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value, isPrimary }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setMessage({ kind: "err", text: j.error?.message ?? `HTTP ${res.status}` });
        return;
      }
      (e.target as HTMLFormElement).reset();
      await refresh({ kind: "ok", text: "Method added." });
    } finally {
      setBusy(false);
    }
  }

  async function removeMethod(contactId: string, methodId: string) {
    if (!canOfficeMutate) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `${base}/${encodeURIComponent(contactId)}/methods/${encodeURIComponent(methodId)}`,
        { method: "DELETE", credentials: "include" },
      );
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setMessage({ kind: "err", text: j.error?.message ?? `HTTP ${res.status}` });
        return;
      }
      await refresh({ kind: "ok", text: "Method removed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6" aria-labelledby="contacts-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h2 id="contacts-heading" className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Contacts
          </h2>
          <p className="mt-1 text-xs text-zinc-600 max-w-xl leading-relaxed">
            People and reach methods for this customer record. This is not a CRM pipeline — only structured
            identity for quoting and follow-up.{" "}
            <strong className="font-medium text-zinc-500">Primary</strong> is one per method type (email, phone,
            mobile, other) for the <strong className="font-medium text-zinc-500">whole customer</strong>, not per
            contact.
          </p>
        </div>
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
        <form onSubmit={(ev) => void addContact(ev)} className="mb-6 flex flex-wrap items-end gap-3 border-b border-zinc-800/80 pb-6">
          <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Display name</label>
            <input
              name="displayName"
              required
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200"
              placeholder="Jane Doe"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Role</label>
            <select name="role" className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200">
              {ROLES.map((r) => (
                <option key={r || "none"} value={r}>
                  {r === "" ? "—" : r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[8rem] flex-1 flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Notes (optional)</label>
            <input
              name="notes"
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200"
              placeholder="Short context"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-sky-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            Add contact
          </button>
        </form>
      ) : null}

      {initialContacts.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No contacts yet.
          {canOfficeMutate
            ? " Add a billing or site contact to keep communication explicit."
            : " Ask an office admin to add contacts."}
        </p>
      ) : (
        <ul className="space-y-5">
          {initialContacts.map((c) => (
            <li key={c.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-zinc-100">{c.displayName}</div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    {c.role ? <span className="font-mono text-zinc-400">{c.role}</span> : <span>No role tag</span>}
                    {c.notes ? <span className="ml-2 text-zinc-500">· {c.notes}</span> : null}
                  </div>
                </div>
                {canOfficeMutate ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void archiveContact(c.id)}
                    className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 hover:text-amber-400 disabled:opacity-50"
                  >
                    Archive
                  </button>
                ) : null}
              </div>
              <ul className="mt-3 space-y-1.5 border-t border-zinc-800/60 pt-3">
                {c.methods.length === 0 ? (
                  <li className="text-[11px] text-zinc-500">No methods — add email or phone.</li>
                ) : (
                  c.methods.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-300">
                      <span>
                        <span className="font-mono text-[10px] text-zinc-500">{m.type}</span>{" "}
                        <span className="text-zinc-200">{m.value}</span>
                        {m.isPrimary ? (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-500">primary</span>
                        ) : null}
                      </span>
                      {canOfficeMutate ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeMethod(c.id, m.id)}
                          className="text-[10px] text-zinc-500 hover:text-rose-400 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
              {canOfficeMutate ? (
                <form
                  onSubmit={(ev) => void addMethod(ev, c.id)}
                  className="mt-3 flex flex-wrap items-end gap-2 border-t border-dashed border-zinc-800/60 pt-3"
                >
                  <select
                    name="type"
                    required
                    className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200"
                    defaultValue="EMAIL"
                  >
                    {METHOD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    name="value"
                    required
                    placeholder="value"
                    className="min-w-[8rem] flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200"
                  />
                  <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <input type="checkbox" name="isPrimary" className="rounded border-zinc-600" />
                    Primary
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    Add method
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
