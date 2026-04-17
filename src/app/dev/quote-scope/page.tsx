import Link from "next/link";
import { redirect } from "next/navigation";

/** Read `.env.local` after seed at request time (not at `next build`). */
export const dynamic = "force-dynamic";

/**
 * After `npm run db:seed`, `.env.local` contains STRUXIENT_DEV_QUOTE_VERSION_ID → redirect to the scope view.
 */
export default function DevQuoteScopeHelperPage() {
  const quoteVersionId = process.env.STRUXIENT_DEV_QUOTE_VERSION_ID?.trim();
  if (quoteVersionId) {
    redirect(`/dev/quote-scope/${quoteVersionId}`);
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="mb-4 text-lg font-medium text-zinc-100">Quote scope (dev)</h1>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-400">
        <li>
          Run <code className="text-zinc-300">npm run db:seed</code> against your database (with <code className="text-zinc-300">DATABASE_URL</code>{" "}
          in <code className="text-zinc-300">.env</code>).
        </li>
        <li>
          Seed updates <code className="text-zinc-300">.env.local</code> with{" "}
          <code className="text-zinc-300">STRUXIENT_DEV_TENANT_ID</code> and{" "}
          <code className="text-zinc-300">STRUXIENT_DEV_QUOTE_VERSION_ID</code> (unless{" "}
          <code className="text-zinc-300">STRUXIENT_SEED_SKIP_DEV_ENV=1</code>).
        </li>
        <li>
          Restart <code className="text-zinc-300">npm run dev</code>, then open this page again — it will redirect to the seeded quote version.
        </li>
      </ol>
      <p className="mt-4 text-xs text-zinc-500">
        API: <code className="text-zinc-400">GET /api/quote-versions/&lt;id&gt;/scope</code> requires a session cookie or dev auth bypass.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm text-sky-400 hover:text-sky-300">
        ← Home
      </Link>
    </main>
  );
}
