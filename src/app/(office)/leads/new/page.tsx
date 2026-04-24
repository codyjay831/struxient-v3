import Link from "next/link";
import { redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { listTenantMembersForTenant } from "@/server/slice1/reads/tenant-team-reads";
import { NewLeadForm } from "./new-lead-form";

export const dynamic = "force-dynamic";

export default async function OfficeNewLeadPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }
  if (!principalHasCapability(auth.principal, "office_mutate")) {
    redirect("/leads");
  }

  const members = await listTenantMembersForTenant(getPrisma(), { tenantId: auth.principal.tenantId });
  const memberOptions = members.map((m) => ({
    id: m.id,
    label: (m.displayName && m.displayName.trim()) || m.email,
  }));

  return (
    <main className="p-8 max-w-2xl">
      <header className="mb-8">
        <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2">
          <Link href="/leads" className="hover:text-zinc-300 transition-colors">
            Leads
          </Link>
          <span>/</span>
          <span className="text-zinc-400">New</span>
        </nav>
        <h1 className="text-2xl font-semibold text-zinc-50">New Lead</h1>
        <p className="text-sm text-zinc-500 mt-1">Minimal intake: name and optional contact fields. You can convert later from the lead detail page.</p>
      </header>

      <NewLeadForm memberOptions={memberOptions} />
    </main>
  );
}
