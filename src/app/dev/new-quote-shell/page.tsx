"use client";

import Link from "next/link";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { useState } from "react";

type CreatedShellTarget = {
  quoteId: string;
  quoteNumber: string | null;
  quoteVersionId: string;
};

/**
 * Manual check: sign in as an office user, then POST the commercial shell.
 */
export default function DevNewQuoteShellPage() {
  const [customerName, setCustomerName] = useState("Dev Customer");
  const [flowGroupName, setFlowGroupName] = useState("Dev Flow Group");
  const [customerId, setCustomerId] = useState("");
  const [flowGroupId, setFlowGroupId] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [out, setOut] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedShellTarget | null>(null);

  async function submit() {
    setBusy(true);
    setOut("");
    setCreated(null);
    try {
      const body: Record<string, unknown> = {};
      const cid = customerId.trim();
      const fgid = flowGroupId.trim();
      if (cid) {
        body.customerId = cid;
        if (fgid) {
          body.flowGroupId = fgid;
        } else {
          body.flowGroupName = flowGroupName;
        }
      } else {
        body.customerName = customerName;
        body.flowGroupName = flowGroupName;
      }
      const qn = quoteNumber.trim();
      if (qn) body.quoteNumber = qn;

      const res = await fetch("/api/commercial/quote-shell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as {
        data?: {
          quote?: { id?: string; quoteNumber?: string | null };
          quoteVersion?: { id?: string };
        };
      };
      setOut(JSON.stringify({ status: res.status, body: j }, null, 2));
      const quoteIdFromResponse = j?.data?.quote?.id;
      const quoteVersionIdFromResponse = j?.data?.quoteVersion?.id;
      if (res.ok && quoteIdFromResponse && quoteVersionIdFromResponse) {
        setCreated({
          quoteId: quoteIdFromResponse,
          quoteNumber: j?.data?.quote?.quoteNumber ?? null,
          quoteVersionId: quoteVersionIdFromResponse,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-8 text-zinc-200">
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
              Create a new customer, flow group, and quote shell, or attach to existing ones. Requires
              an office session with elevated permissions.
            </p>
          </div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-400">
            ← Hub
          </Link>
        </div>
      </header>

      <div className="space-y-4">
        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Customer name
            </span>
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Acme Corp"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Flow group name
            </span>
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
              value={flowGroupName}
              onChange={(e) => setFlowGroupName(e.target.value)}
              placeholder="e.g. Spring 2026 HVAC"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Quote number (optional)
            </span>
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
              value={quoteNumber}
              onChange={(e) => setQuoteNumber(e.target.value)}
              placeholder="AUTO-…"
            />
          </label>
        </div>

        <details className="rounded-lg border border-zinc-800 bg-zinc-900/20 p-3">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-zinc-600 hover:text-zinc-500">
            Advanced: Attach to existing
          </summary>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-[11px] text-zinc-500">CustomerId (overrides name)</span>
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="cuid…"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-zinc-500">FlowGroupId (overrides FG name)</span>
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs"
                value={flowGroupId}
                onChange={(e) => setFlowGroupId(e.target.value)}
                placeholder="cuid…"
              />
            </label>
          </div>
        </details>

        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="w-full rounded bg-sky-700 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50 transition-colors"
        >
          {busy ? "Creating…" : "Create quote shell"}
        </button>
      </div>

      {created ? (
        <div className="mt-6 rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
            Shell created successfully
          </p>
          <p className="mt-1 text-sm text-zinc-200 leading-relaxed">
            Quote{" "}
            <span className="font-semibold text-zinc-50">
              {created.quoteNumber ?? created.quoteId.slice(0, 10) + "…"}
            </span>{" "}
            has been initialized. Continue to the workspace to select a workflow and add line items.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/dev/quotes/${created.quoteId}`}
              className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 transition-colors"
            >
              Open quote workspace
            </Link>
            <Link
              href={`/dev/quote-scope/${created.quoteVersionId}`}
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
        </div>
      ) : null}

      <details className="mt-8 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-4">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-400">
          Technical details
        </summary>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]">
            <code className="text-zinc-500">POST /api/commercial/quote-shell</code>
          </div>
          {out && (
            <pre className="mt-2 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-snug text-zinc-400">
              {out}
            </pre>
          )}
        </div>
      </details>
    </main>
  );
}
