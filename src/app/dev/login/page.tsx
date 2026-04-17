import Link from "next/link";
import { DevLoginForm } from "./dev-login-form";

export const dynamic = "force-dynamic";

export default function DevLoginPage() {
  const defaultTenantId = process.env.STRUXIENT_DEV_TENANT_ID?.trim() ?? "";

  return (
    <main className="mx-auto max-w-lg space-y-6 p-8">
      <DevLoginForm defaultTenantId={defaultTenantId} />
      <p className="text-center text-xs text-zinc-500">
        <Link href="/" className="text-sky-400 hover:text-sky-300">
          Home
        </Link>
      </p>
    </main>
  );
}
