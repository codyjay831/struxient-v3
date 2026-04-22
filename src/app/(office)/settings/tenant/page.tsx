import { notFound, redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { getTenantOperationalSettingsForTenant } from "@/server/slice1/reads/tenant-operational-settings-reads";
import { TenantOperationalSettingsForm } from "@/components/settings/tenant-operational-settings-form";

export const dynamic = "force-dynamic";

/**
 * Minimal tenant **operational** settings (Epic 60). Not a full admin console — one policy surface at a time.
 */
export default async function TenantOperationalSettingsPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) redirect("/login");
  if (!principalHasCapability(auth.principal, "office_mutate")) redirect("/quotes");

  const settings = await getTenantOperationalSettingsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
  });
  if (!settings) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <h1 className="text-2xl font-semibold text-zinc-50">Tenant settings</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Operational limits for your organization. Changes are audited and enforced server-side.
      </p>

      <section className="mt-10 rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Customer documents</h2>
        <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
          Maximum size for a single file uploaded to a customer record (Epic 06). MIME allowlist stays in product code for
          safety; only the byte cap is tenant-configurable in this slice.
        </p>
        <div className="mt-6">
          <TenantOperationalSettingsForm initial={settings} canOfficeMutate />
        </div>
      </section>
    </main>
  );
}
