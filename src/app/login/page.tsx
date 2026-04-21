import { OfficeLoginForm } from "./office-login-form";

/**
 * Office sign-in page. Lives outside the `(office)` route group so the office
 * layout's auth gate cannot recursively redirect into itself.
 *
 * Mounts the same NextAuth credentials flow used by `/dev/login` — there is
 * exactly one auth path; this is a thin office-styled entry point on top of it.
 *
 * `STRUXIENT_DEV_TENANT_ID` is read server-side and passed through as a
 * pre-fill convenience for local environments. Never used as authn truth.
 */
export const dynamic = "force-dynamic";

export default function OfficeLoginPage() {
  const defaultTenantId = process.env.STRUXIENT_DEV_TENANT_ID?.trim() ?? "";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded bg-sky-600 flex items-center justify-center text-white font-bold text-lg">
              S
            </div>
            <span className="text-lg font-semibold text-zinc-50 tracking-tight">
              Struxient Office
            </span>
          </div>
        </div>
        <OfficeLoginForm defaultTenantId={defaultTenantId} />
      </div>
    </main>
  );
}
