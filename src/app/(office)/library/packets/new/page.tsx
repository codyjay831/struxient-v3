import Link from "next/link";
import { redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { CreateScopePacketForm } from "@/components/catalog-packets/create-scope-packet-form";

export const dynamic = "force-dynamic";

/**
 * Greenfield catalog packet create (Epic 15). Office admins only; creates empty r1 DRAFT for task-line authoring elsewhere.
 */
export default async function OfficeNewScopePacketPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) redirect("/login");
  if (!principalHasCapability(auth.principal, "office_mutate")) redirect("/quotes");

  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <nav className="mb-4 text-xs text-zinc-500">
        <Link href="/library/packets" className="hover:text-zinc-300">
          Library packets
        </Link>
        <span className="mx-2 text-zinc-700">/</span>
        <span className="text-zinc-400">New packet</span>
      </nav>

      <h1 className="text-2xl font-semibold text-zinc-50">New library packet</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Creates a catalog <strong className="text-zinc-400">ScopePacket</strong> and its first{" "}
        <strong className="text-zinc-400">DRAFT</strong> revision (empty). Add task lines before publishing; promotion from a
        quote-local packet remains available as an alternative path.
      </p>

      <div className="mt-8">
        <CreateScopePacketForm />
      </div>
    </main>
  );
}
