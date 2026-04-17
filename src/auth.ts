import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { TenantMemberRole } from "@prisma/client";
import type { JWT } from "next-auth/jwt";
import { getPrisma } from "@/server/db/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        tenantId: { label: "Tenant ID", type: "text" },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const tenantId = typeof credentials?.tenantId === "string" ? credentials.tenantId.trim() : "";
        if (!email || !password || !tenantId) {
          return null;
        }

        const prisma = getPrisma();
        const user = await prisma.user.findUnique({
          where: { tenantId_email: { tenantId, email } },
          select: { id: true, email: true, tenantId: true, passwordHash: true, role: true },
        });
        if (!user?.passwordHash) {
          return null;
        }
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role as TenantMemberRole,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user && "tenantId" in user && user.tenantId && "role" in user && user.role) {
        token.tenantId = user.tenantId as string;
        token.role = user.role as TenantMemberRole;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as JWT & { tenantId?: string; role?: TenantMemberRole };
      if (session.user && token.sub && t.tenantId && t.role) {
        session.user.id = token.sub;
        session.user.tenantId = t.tenantId;
        session.user.role = t.role;
      }
      return session;
    },
  },
});
