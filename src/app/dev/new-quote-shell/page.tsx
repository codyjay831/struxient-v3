"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import {
  deriveQuoteShellMode,
  describeQuoteShellMode,
  parseQuoteShellApiResponse,
  type QuoteShellApiOutcome,
  type QuoteShellFormFields,
} from "@/lib/commercial/quote-shell-form-state";

/**
 * Internal dev surface for `POST /api/commercial/quote-shell`. The page is
 * intentionally thin: all input → request-body and response → outcome shaping
 * lives in `quote-shell-form-state.ts` (covered by unit tests). This component
 * only owns local form state, the HTTP call, and rendering.
 *
 * Auth/tenant/capability checks remain enforced server-side. The page renders
 * `meta.auth.source` returned by the route so the operator can see at a
 * glance whether the request was authenticated by a real session or by the
 * documented dev bypass — without ever weakening the gate itself.
 */
export default function DevNewQuoteShellPage() {
  const [fields, setFields] = useState<QuoteShellFormFields>({
    customerName: "Dev Customer",
    flowGroupName: "Dev Flow Group",
    customerId: "",
    flowGroupId: "",
    quoteNumber: "",
  });
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<QuoteShellApiOutcome | null>(null);
  const [rawJsonForDetails, setRawJsonForDetails] = useState<string>("");

  const preflight = useMemo(() => deriveQuoteShellMode(fields), [fields]);

  function patch(p: Partial<QuoteShellFormFields>) {
    setFields((f) => ({ ...f, ...p }));
  }

  async function submit() {
    if (!preflight.ok || busy) return;
    setBusy(true);
    setOutcome(null);
    setRawJsonForDetails("");
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
      setOutcome(classified);
      setRawJsonForDetails(
        JSON.stringify({ status: res.status, body: parsed ?? text }, null, 2),
      );
    } catch (networkError) {
      setOutcome({
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

  function reuseCustomerId(id: string) {
    patch({ customerName: "", customerId: id });
  }

  function reuseFlowGroupId(id: string) {
    patch({ flowGroupName: "", flowGroupId: id });
  }

  return (
    <main className="mx-auto max-w-2xl p-8 text-zinc-200">
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 text-sky-400">
          <div>
            <InternalBreadcrumb
              category="Commercial"
              segments={[{ label: "Quotes", href: "/dev/quotes" }, { label: "New shell" }]}
            />
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">
              New quote shell
            </h1>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">
              Create a customer + flow group + quote shell in one transaction, or attach to
              existing ones. Requires an office session (role <code className="text-zinc-400">OFFICE_ADMIN</code>);
              auth, tenant, and capability checks are enforced server-side.
            </p>
          </div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-400">
            ← Hub
          </Link>
        </div>
      </header>

      <div className="space-y-4">
        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <FieldRow label="Customer name">
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
              value={fields.customerName}
              onChange={(e) => patch({ customerName: e.target.value })}
              placeholder="e.g. Acme Corp"
            />
          </FieldRow>
          <FieldRow label="Flow group name">
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
              value={fields.flowGroupName}
              onChange={(e) => patch({ flowGroupName: e.target.value })}
              placeholder="e.g. Spring 2026 HVAC"
            />
          </FieldRow>
          <FieldRow label="Quote number (optional — auto-allocated when blank)">
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
              value={fields.quoteNumber}
              onChange={(e) => patch({ quoteNumber: e.target.value })}
              placeholder="AUTO-…"
            />
          </FieldRow>
        </div>

        <details className="rounded-lg border border-zinc-800 bg-zinc-900/20 p-3">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-zinc-600 hover:text-zinc-500">
            Advanced — attach to existing
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Filling <code className="text-zinc-400">customerId</code> overrides{" "}
              <em>customer name</em> (attaches to that customer instead of creating one). Filling
              both ids attaches to an existing flow group too. Server enforces tenant scope on
              every id.
            </p>
            <FieldRow label="customerId (overrides name)">
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs"
                value={fields.customerId}
                onChange={(e) => patch({ customerId: e.target.value })}
                placeholder="cuid…"
              />
            </FieldRow>
            <FieldRow label="flowGroupId (requires customerId; overrides FG name)">
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs"
                value={fields.flowGroupId}
                onChange={(e) => patch({ flowGroupId: e.target.value })}
                placeholder="cuid…"
              />
            </FieldRow>
          </div>
        </details>

        <ModeHint preflight={preflight} />

        <button
          type="button"
          disabled={busy || !preflight.ok}
          onClick={() => void submit()}
          className="w-full rounded bg-sky-700 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {busy ? "Creating…" : "Create quote shell"}
        </button>
      </div>

      {outcome ? (
        <OutcomePanel
          outcome={outcome}
          onReuseCustomerId={reuseCustomerId}
          onReuseFlowGroupId={reuseFlowGroupId}
        />
      ) : null}

      <details className="mt-8 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-4">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-400">
          Technical details
        </summary>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]">
            <code className="text-zinc-500">POST /api/commercial/quote-shell</code>
          </div>
          {rawJsonForDetails ? (
            <pre className="mt-2 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-snug text-zinc-400">
              {rawJsonForDetails}
            </pre>
          ) : (
            <p className="text-[11px] text-zinc-600">
              Raw request/response will appear here after the next submit.
            </p>
          )}
        </div>
      </details>
    </main>
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

function OutcomePanel({
  outcome,
  onReuseCustomerId,
  onReuseFlowGroupId,
}: {
  outcome: QuoteShellApiOutcome;
  onReuseCustomerId: (id: string) => void;
  onReuseFlowGroupId: (id: string) => void;
}) {
  if (outcome.kind === "success") {
    const e = outcome.entities;
    return (
      <section className="mt-6 rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-5 shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
            Shell created — HTTP {outcome.status}
          </p>
          {outcome.auth ? <AuthChip source={outcome.auth.source} /> : null}
        </header>
        <p className="mt-1 text-sm text-zinc-200 leading-relaxed">
          Quote{" "}
          <span className="font-semibold text-zinc-50">{e.quote.quoteNumber}</span> initialized as{" "}
          <span className="font-semibold text-zinc-50">{e.quoteVersion.status}</span>{" "}
          v{e.quoteVersion.versionNumber}.
        </p>

        <dl className="mt-4 grid gap-2 text-[11px]">
          <EntityRow
            label="Customer"
            id={e.customer.id}
            secondary={e.customer.name}
            reuseLabel="Reuse as customerId"
            onReuse={() => onReuseCustomerId(e.customer.id)}
          />
          <EntityRow
            label="FlowGroup"
            id={e.flowGroup.id}
            secondary={`${e.flowGroup.name} — customerId ${shortId(e.flowGroup.customerId)}`}
            reuseLabel="Reuse as flowGroupId"
            onReuse={() => onReuseFlowGroupId(e.flowGroup.id)}
          />
          <EntityRow label="Quote" id={e.quote.id} secondary={`quoteNumber ${e.quote.quoteNumber}`} />
          <EntityRow
            label="QuoteVersion"
            id={e.quoteVersion.id}
            secondary={`v${e.quoteVersion.versionNumber} ${e.quoteVersion.status}`}
          />
          <EntityRow
            label="ProposalGroup"
            id={e.proposalGroup.id}
            secondary={`${e.proposalGroup.name} (sortOrder ${e.proposalGroup.sortOrder})`}
          />
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/dev/quotes/${e.quote.id}`}
            className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 transition-colors"
          >
            Open quote workspace
          </Link>
          <Link
            href={`/dev/quote-scope/${e.quoteVersion.id}`}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Open quote scope
          </Link>
          <Link
            href="/dev/quotes"
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            All quotes
          </Link>
        </div>
      </section>
    );
  }

  if (outcome.kind === "structured_error") {
    return (
      <section className="mt-6 rounded-lg border border-amber-900/60 bg-amber-950/20 p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
          Request failed — HTTP {outcome.status === 0 ? "(no response)" : outcome.status}
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
        {outcome.context !== undefined && outcome.context !== null ? (
          <pre className="mt-3 overflow-auto rounded border border-amber-900/40 bg-amber-950/40 p-2 font-mono text-[10px] text-amber-200/80">
            {JSON.stringify(outcome.context, null, 2)}
          </pre>
        ) : null}
      </section>
    );
  }

  if (outcome.kind === "non_json") {
    return (
      <section className="mt-6 rounded-lg border border-red-900/60 bg-red-950/20 p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-red-300">
          Server returned a non-JSON body — HTTP {outcome.status}
        </p>
        <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
          This should not happen for any route in this codebase: every error path is supposed to
          go through <code>jsonResponseForCaughtError</code>. Capture the body preview below and
          check the dev server logs.
        </p>
        <pre className="mt-3 overflow-auto rounded border border-red-900/40 bg-black/40 p-2 font-mono text-[10px] text-zinc-300">
          {outcome.bodyPreview || "(empty body)"}
        </pre>
      </section>
    );
  }

  // malformed_success — 2xx but DTO did not deserialize cleanly.
  return (
    <section className="mt-6 rounded-lg border border-red-900/60 bg-red-950/20 p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-300">
        Server returned 2xx but the response shape was unexpected — HTTP {outcome.status}
      </p>
      <p className="mt-1 text-xs text-zinc-300 leading-relaxed">{outcome.reason}</p>
      <p className="mt-1 text-[11px] text-zinc-500">
        Open <em>Technical details</em> below to see the raw body.
      </p>
    </section>
  );
}

function AuthChip({ source }: { source: "session" | "dev_bypass" }) {
  const isSession = source === "session";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        isSession
          ? "border border-emerald-700/60 bg-emerald-900/30 text-emerald-200"
          : "border border-amber-700/60 bg-amber-900/30 text-amber-200"
      }`}
      title={
        isSession
          ? "Authenticated via real NextAuth session."
          : "Authenticated via STRUXIENT_DEV_AUTH_BYPASS — non-production only."
      }
    >
      auth: {source}
    </span>
  );
}

function EntityRow({
  label,
  id,
  secondary,
  reuseLabel,
  onReuse,
}: {
  label: string;
  id: string;
  secondary?: string;
  reuseLabel?: string;
  onReuse?: () => void;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 rounded border border-emerald-900/30 bg-emerald-950/10 px-2 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80">
        {label}
      </span>
      <span className="min-w-0 truncate font-mono text-[11px] text-zinc-200" title={id}>
        {id}
        {secondary ? (
          <span className="ml-2 text-[10px] text-zinc-500">{secondary}</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <CopyButton value={id} />
        {reuseLabel && onReuse ? (
          <button
            type="button"
            onClick={onReuse}
            className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            {reuseLabel}
          </button>
        ) : null}
      </span>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // Clipboard unavailable (e.g. insecure context) — silently no-op;
          // the id is already visible and selectable in the row.
        }
      }}
      className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800 transition-colors"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function shortId(id: string): string {
  return id.length > 12 ? id.slice(0, 8) + "…" : id;
}
