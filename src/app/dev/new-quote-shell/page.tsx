"use client";

import Link from "next/link";
import { useState } from "react";

type CreatedShellTarget = {
  quoteId: string;
  quoteNumber: string | null;
  quoteVersionId: string;
};

/**
 * Manual check: sign in as an office user, then POST the commercial shell (same cookie as other dev APIs).
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
      <h1 className="mb-2 text-lg font-medium">New commercial quote shell (dev)</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Office session only — <code className="text-zinc-300">POST /api/commercial/quote-shell</code>.{" "}
        New customer: names below. Attach: fill <code className="text-zinc-400">customerId</code> — then
        either <code className="text-zinc-400">flowGroupName</code> (new FG) or <code className="text-zinc-400">flowGroupId</code> (reuse
        FG). Ids from <code className="text-zinc-400">GET /api/quotes</code> / create response.
      </p>
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="text-zinc-500">customerId (optional — when set, customerName is ignored)</span>
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="cuid…"
          />
        </label>
        <label className="block">
          <span className="text-zinc-500">flowGroupId (optional — when set with customerId, flowGroupName ignored)</span>
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs"
            value={flowGroupId}
            onChange={(e) => setFlowGroupId(e.target.value)}
            placeholder="cuid…"
          />
        </label>
        <label className="block">
          <span className="text-zinc-500">customerName</span>
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-zinc-500">flowGroupName</span>
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
            value={flowGroupName}
            onChange={(e) => setFlowGroupName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-zinc-500">quoteNumber (optional; empty → AUTO-…)</span>
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
            value={quoteNumber}
            onChange={(e) => setQuoteNumber(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="rounded bg-sky-700 px-3 py-1.5 text-white hover:bg-sky-600 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create shell"}
        </button>
      </div>
      {created ? (
        <div className="mt-6 rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">Shell created</p>
          <p className="mt-1 text-sm text-zinc-200">
            Quote{" "}
            <span className="font-medium text-zinc-50">
              {created.quoteNumber ?? created.quoteId.slice(0, 10) + "…"}
            </span>{" "}
            is ready. Continue testing:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/dev/quotes/${created.quoteId}`}
              className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
            >
              Open quote workspace
            </Link>
            <Link
              href={`/dev/quote-scope/${created.quoteVersionId}`}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
            >
              Open scope (read)
            </Link>
            <Link
              href="/dev/quotes"
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              All quotes
            </Link>
          </div>
        </div>
      ) : null}

      {out ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400">
            Raw response
          </summary>
          <pre className="mt-2 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
            {out}
          </pre>
        </details>
      ) : null}
      <p className="mt-6 text-xs text-zinc-500">
        Manual fallback: open <code className="text-zinc-400">/dev/quote-scope/&lt;quoteVersionId&gt;</code> using{" "}
        <code className="text-zinc-400">data.quoteVersion.id</code> from the response above.
      </p>
      <Link href="/" className="mt-4 inline-block text-sm text-sky-400 hover:text-sky-300">
        ← Testing hub
      </Link>
    </main>
  );
}
