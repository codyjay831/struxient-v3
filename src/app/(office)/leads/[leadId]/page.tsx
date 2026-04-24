import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { getLeadForTenant } from "@/server/slice1/reads/lead-reads";
import { listTenantMembersForTenant } from "@/server/slice1/reads/tenant-team-reads";
import { LeadDetailClient } from "./lead-detail-client";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ leadId: string }> };

export default async function OfficeLeadDetailPage({ params }: PageProps) {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const { leadId } = await params;
  const prisma = getPrisma();
  const lead = await getLeadForTenant(prisma, { tenantId: auth.principal.tenantId, leadId });
  if (!lead) {
    notFound();
  }

  const assignee =
    lead.assignedToUserId != null
      ? await prisma.user.findFirst({
          where: { id: lead.assignedToUserId, tenantId: auth.principal.tenantId },
          select: { displayName: true, email: true },
        })
      : null;
  const assigneeLabel =
    assignee != null ? (assignee.displayName && assignee.displayName.trim()) || assignee.email : null;

  const canMutate = principalHasCapability(auth.principal, "office_mutate");
  const members = canMutate ? await listTenantMembersForTenant(prisma, { tenantId: auth.principal.tenantId }) : [];
  const memberOptions = members.map((m) => ({
    id: m.id,
    label: (m.displayName && m.displayName.trim()) || m.email,
  }));

  const quoteRow =
    lead.status === "CONVERTED"
      ? await prisma.quote.findFirst({
          where: { tenantId: auth.principal.tenantId, leadId },
          select: { id: true },
          orderBy: { createdAt: "asc" },
        })
      : null;

  return (
    <main className="p-8 max-w-3xl">
      <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-4">
        <Link href="/leads" className="hover:text-zinc-300 transition-colors">
          Leads
        </Link>
        <span>/</span>
        <span className="text-zinc-400 truncate">{lead.displayName}</span>
      </nav>

      <LeadDetailClient
        leadId={leadId}
        initial={lead}
        assigneeLabel={assigneeLabel}
        memberOptions={memberOptions}
        canMutate={canMutate}
        quoteId={quoteRow?.id ?? null}
      />
    </main>
  );
}
