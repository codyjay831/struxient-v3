import { PrismaClient } from "@prisma/client";

export type SatisfyPaymentGateResult =
  | { ok: true; data: { satisfiedAt: string } }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "already_satisfied" }
  | { ok: false; kind: "invalid_actor" };

export async function satisfyPaymentGateForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    paymentGateId: string;
    actorUserId: string;
  },
): Promise<SatisfyPaymentGateResult> {
  const actor = await prisma.user.findFirst({
    where: { id: params.actorUserId, tenantId: params.tenantId },
    select: { id: true },
  });

  if (!actor) {
    return { ok: false, kind: "invalid_actor" };
  }

  return prisma.$transaction(async (tx) => {
    const gate = await tx.paymentGate.findFirst({
      where: { id: params.paymentGateId, tenantId: params.tenantId },
      select: { id: true, status: true },
    });

    if (!gate) {
      return { ok: false, kind: "not_found" };
    }

    if (gate.status === "SATISFIED") {
      return { ok: false, kind: "already_satisfied" };
    }

    const satisfiedAt = new Date();
    await tx.paymentGate.update({
      where: { id: params.paymentGateId },
      data: {
        status: "SATISFIED",
        satisfiedAt,
        satisfiedById: actor.id,
      },
    });

    return {
      ok: true,
      data: {
        satisfiedAt: satisfiedAt.toISOString(),
      },
    };
  });
}
