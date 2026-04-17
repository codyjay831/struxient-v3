import type { DefaultSession } from "next-auth";
import type { TenantMemberRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: TenantMemberRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId?: string;
    role?: TenantMemberRole;
  }
}
