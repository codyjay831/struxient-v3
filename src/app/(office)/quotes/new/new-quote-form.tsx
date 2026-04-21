"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  deriveQuoteShellMode,
  describeQuoteShellMode,
  parseQuoteShellApiResponse,
  type QuoteShellApiOutcome,
  type QuoteShellFormFields,
} from "@/lib/commercial/quote-shell-form-state";

/**
 * Office-flavored client form for `POST /api/commercial/quote-shell`.
 *
 * Reuses the validated pure helpers from `@/lib/commercial/quote-shell-form-state`
 * so the UI ↔ server preflight stays in lock-step with the dev surface. On
 * success this navigates the office user directly into the created quote
 * workspace at `/quotes/[quoteId]`. No advanced/raw-JSON dev chrome.
 */
export function NewQuoteForm() {
  const router = useRouter();

  const [fields, setFields] = useState<QuoteShellFormFields>({
    customerName: "",
    flowGroupName: "",
    customerId: "",
    flowGroupId: "",
    quoteNumber: "",
  });
  const [busy, setBusy] = useState(false);
  const [errorOutcome, setErrorOutcome] = useState<
    Exclude<QuoteShellApiOutcome, { kind: "success" }> | null
  >(null);

  const preflight = useMemo(() => deriveQuoteShellMode(fields), [fields]);

  function patch(p: Partial<QuoteShellFormFields>) {
    setFields((f) => ({ ...f, ...p }));
  }

  async function submit() {
    if (!preflight.ok || busy) return;
    setBusy(true);
    setErrorOutcome(null);
    try {
      const res = await fetch("/api/commercial/quote-shell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(preflight.requestBody),
      });
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text.length === 0 ? {} : JSON.parse(text);
      } catch {
        parsed = undefined;
      }
      const classified = parseQuoteShellApiResponse(res.status, parsed, text);

      if (classified.kind === "success") {
        // Navigate into the new workspace inside the office shell.
        // `replace` avoids leaving "/quotes/new" in history once the entity exists.
        router.replace(`/quotes/${classified.entities.quote.id}`);
        // Fresh server fetch so the workspace reads the just-created row.
        router.refresh();
        return;
      }

      setErrorOutcome(classified);
    } catch (networkError) {
      setErrorOutcome({
        kind: "structured_error",
        status: 0,
        code: "NETWORK_ERROR",
        message:
          networkError instanceof Error
            ? networkError.message
            : "Network request failed before the server responded.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <FieldRow label="Customer name">
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none"
            value={fields.customerName}
            onChange={(e) => patch({ customerName: e.target.value })}
            placeholder="e.g. Acme Corp"
            disabled={busy}
          />
        </FieldRow>
        <FieldRow label="Flow group name">
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none"
            value={fields.flowGroupName}
            onChange={(e) => patch({ flowGroupName: e.target.value })}
            placeholder="e.g. Spring 2026 HVAC"
            disabled={busy}
          />
        </FieldRow>
        <FieldRow label="Quote number (optional — auto-allocated when blank)">
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none"
            value={fields.quoteNumber}
            onChange={(e) => patch({ quoteNumber: e.target.value })}
            placeholder="AUTO-…"
            disabled={busy}
          />
        </FieldRow>
      </div>

      <details className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-400">
          Attach to existing customer or flow group
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Filling <code className="text-zinc-400">customerId</code> attaches to that customer
            instead of creating a new one. Filling both ids attaches to an existing flow group
            too. Tenant scope is enforced server-side on every id.
          </p>
          <FieldRow label="customerId (overrides customer name)">
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 focus:border-sky-600 focus:outline-none"
              value={fields.customerId}
              onChange={(e) => patch({ customerId: e.target.value })}
              placeholder="cuid…"
              disabled={busy}
            />
          </FieldRow>
          <FieldRow label="flowGroupId (requires customerId; overrides flow group name)">
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 focus:border-sky-600 focus:outline-none"
              value={fields.flowGroupId}
              onChange={(e) => patch({ flowGroupId: e.target.value })}
              placeholder="cuid…"
              disabled={busy}
            />
          </FieldRow>
        </div>
      </details>

      <ModeHint preflight={preflight} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy || !preflight.ok}
          onClick={() => void submit()}
          className="flex-1 rounded bg-sky-700 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {busy ? "Creating…" : "Create quote"}
        </button>
        <Link
          href="/quotes"
          className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </Link>
      </div>

      {errorOutcome ? <ErrorPanel outcome={errorOutcome} /> : null}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModeHint({
  preflight,
}: {
  preflight: ReturnType<typeof deriveQuoteShellMode>;
}) {
  if (preflight.ok) {
    return (
      <p className="rounded border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
        <span className="font-semibold uppercase tracking-wide text-zinc-500">Mode:</span>{" "}
        {describeQuoteShellMode(preflight.mode)}
      </p>
    );
  }
  return (
    <p className="rounded border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-300">
      <span className="font-mono text-[10px] tracking-tight">{preflight.code}</span>
      {" — "}
      {preflight.message}
    </p>
  );
}

function ErrorPanel({
  outcome,
}: {
  outcome: Exclude<QuoteShellApiOutcome, { kind: "success" }>;
}) {
  if (outcome.kind === "structured_error") {
    return (
      <section className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
          Could not create quote — HTTP {outcome.status === 0 ? "(no response)" : outcome.status}
        </p>
        <p className="mt-1 text-sm text-zinc-200 leading-relaxed">
          <code className="rounded bg-amber-900/40 px-1.5 py-0.5 font-mono text-[11px] text-amber-100">
            {outcome.code}
          </code>{" "}
          — {outcome.message}
        </p>
        {outcome.hint ? (
          <p className="mt-2 text-[11px] leading-relaxed text-amber-200/80">
            <span className="font-semibold uppercase tracking-wide">Hint:</span> {outcome.hint}
          </p>
        ) : null}
      </section>
    );
  }

  if (outcome.kind === "non_json") {
    return (
      <section className="rounded-lg border border-red-900/60 bg-red-950/20 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-red-300">
          Server returned a non-JSON body — HTTP {outcome.status}
        </p>
        <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
          The request reached the server but the response was not valid JSON. Try again, or
          check server logs.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-red-900/60 bg-red-950/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-300">
        Server returned 2xx but the response shape was unexpected — HTTP {outcome.status}
      </p>
      <p className="mt-1 text-xs text-zinc-300 leading-relaxed">{outcome.reason}</p>
    </section>
  );
}
