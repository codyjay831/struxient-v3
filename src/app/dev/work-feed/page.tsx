import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * After `db:seed:activated`, `.env.local` may contain STRUXIENT_DEV_FLOW_ID → work feed for that flow.
 * For real tenant-scoped discovery without env shortcuts, use /dev/flows.
 */
export default function DevWorkFeedHelperPage() {
  const flowId = process.env.STRUXIENT_DEV_FLOW_ID?.trim();
  if (flowId) {
    redirect(`/dev/work-feed/${flowId}`);
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="mb-2 text-lg font-medium text-zinc-100">Work feed (dev helper)</h1>
      <p className="mb-4 rounded border border-sky-900/40 bg-sky-950/20 px-3 py-2 text-xs leading-relaxed text-sky-300/90">
        For real tenant data, use{" "}
        <Link href="/dev/flows" className="font-medium text-sky-300 hover:text-sky-200">
          /dev/flows
        </Link>{" "}
        — every row has an{" "}
        <span className="font-medium">Open work feed</span> button. This page is only a seed-id shortcut.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-400">
        <li>
          Run <code className="text-zinc-300">npm run db:seed</code> then{" "}
          <code className="text-zinc-300">npm run db:seed:activated</code>.
        </li>
        <li>
          Sign in at <Link href="/dev/login" className="text-sky-400">/dev/login</Link>, or set{" "}
          <code className="text-zinc-300">STRUXIENT_DEV_AUTH_BYPASS=true</code> with tenant/user ids in{" "}
          <code className="text-zinc-300">.env.local</code> (non-production only).
        </li>
        <li>
          Restart <code className="text-zinc-300">npm run dev</code>, open this page again, or go straight to{" "}
          <Link href="/dev/flows" className="text-sky-400">/dev/flows</Link>.
        </li>
      </ol>
      <p className="mt-4 text-xs text-zinc-500">
        Phase 8 shell: merged <code className="text-zinc-400">workItems</code> with Start/Complete wired to
        slice1 routes.
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
