import Link from "next/link";
import { redirect } from "next/navigation";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { NewQuoteForm } from "./new-quote-form";

export const dynamic = "force-dynamic";

/**
 * Office-surface entry point for creating a new commercial quote shell.
 *
 * Posts to the same canonical mutation contract as the dev surface
 * (`POST /api/commercial/quote-shell`); validation logic is shared from
 * `@/lib/commercial/quote-shell-form-state`. Auth is gated server-side via
 * `tryGetApiPrincipal`; capability (`office_mutate`) is enforced by the API
 * route itself, not weakened here.
 */
export default async function OfficeNewQuotePage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  return (
    <main className="p-8 max-w-2xl">
      <header className="mb-8">
        <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2">
          <Link href="/quotes" className="hover:text-zinc-300 transition-colors">
            Quotes
          </Link>
          <span>/</span>
          <span className="text-zinc-400">New</span>
        </nav>
        <h1 className="text-2xl font-semibold text-zinc-50">New Quote</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Create a customer, flow group, and quote shell in one step. You will land in the new
          workspace once it is created.
        </p>
      </header>

      <NewQuoteForm />
    </main>
  );
}
