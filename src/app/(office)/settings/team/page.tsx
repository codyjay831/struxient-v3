import { redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { TenantTeamPanel } from "@/components/settings/tenant-team-panel";

export const dynamic = "force-dynamic";

/**
 * Epic 59 — tenant member roles (`User.role` / `TenantMemberRole`). Office admins only.
 */
export default async function TenantTeamSettingsPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) redirect("/login");
  if (!principalHasCapability(auth.principal, "office_mutate")) redirect("/quotes");

  return (
    <main className="mx-auto max-w-4xl p-8 text-zinc-200">
      <h1 className="text-2xl font-semibold text-zinc-50">Team & roles</h1>
      <p className="mt-2 text-sm text-zinc-500">
        View and update roles for users in your tenant. Changes are enforced server-side and written to the audit log.
      </p>

      <section className="mt-10">
        <TenantTeamPanel currentUserId={auth.principal.userId} />
      </section>
    </main>
  );
}
