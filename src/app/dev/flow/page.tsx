import Link from "next/link";
import { redirect } from "next/navigation";

/** Read `.env.local` after `db:seed:activated` at request time (not at `next build`). */
export const dynamic = "force-dynamic";

/**
 * After `npm run db:seed:activated`, `.env.local` may contain STRUXIENT_DEV_FLOW_ID → redirect to the
 * execution view. For real tenant-scoped discovery without env shortcuts, use /dev/flows.
 */
export default function DevFlowHelperPage() {
  const flowId = process.env.STRUXIENT_DEV_FLOW_ID?.trim();
  if (flowId) {
    redirect(`/dev/flow/${flowId}`);
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="mb-2 text-lg font-medium text-zinc-100">Flow execution (dev helper)</h1>
      <p className="mb-4 rounded border border-sky-900/40 bg-sky-950/20 px-3 py-2 text-xs leading-relaxed text-sky-300/90">
        For real tenant data, use{" "}
        <Link href="/dev/flows" className="font-medium text-sky-300 hover:text-sky-200">
          /dev/flows
        </Link>{" "}
        — the discovery list shows every activated execution record without needing env-seeded ids.
      </p>
      <p className="mb-3 text-xs text-zinc-500">
        This page is a seed shortcut: it redirects to the flow recorded in{" "}
        <code className="text-zinc-300">STRUXIENT_DEV_FLOW_ID</code> after{" "}
        <code className="text-zinc-300">npm run db:seed:activated</code>.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-400">
        <li>
          Run <code className="text-zinc-300">npm run db:seed</code> then{" "}
          <code className="text-zinc-300">npm run db:seed:activated</code>.
        </li>
        <li>
          Restart <code className="text-zinc-300">npm run dev</code> so it picks up the new{" "}
          <code className="text-zinc-300">STRUXIENT_DEV_FLOW_ID</code>.
        </li>
        <li>Open this page again — it redirects to the seeded flow.</li>
      </ol>
      <p className="mt-4 text-xs text-zinc-500">
        API: <code className="text-zinc-400">GET /api/flows/&lt;flowId&gt;</code> requires a session cookie or
        dev auth bypass.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/dev/flows" className="text-sky-400 hover:text-sky-300">
          Activated flows list
        </Link>
        <Link href="/" className="text-zinc-500 hover:text-zinc-400">
          ← Testing hub
        </Link>
      </div>
    </main>
  );
}
