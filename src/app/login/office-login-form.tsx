"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Office sign-in form. Reuses the same NextAuth `credentials` provider as the
 * dev login (canon-safe single auth path) — only the chrome differs.
 *
 * Honors a `?from=...` query so the gate can return the operator to the page
 * they were trying to reach. Falls back to /quotes (the office root).
 */
type Props = {
  defaultTenantId: string;
};

const DEFAULT_REDIRECT = "/quotes";

function isSafeRedirect(target: string | null | undefined): target is string {
  if (!target) return false;
  if (!target.startsWith("/")) return false;
  if (target.startsWith("//")) return false;
  return true;
}

export function OfficeLoginForm({ defaultTenantId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams?.get("from") ?? null;
  const redirectTarget = isSafeRedirect(fromParam) ? fromParam : DEFAULT_REDIRECT;

  const [tenantId, setTenantId] = useState(defaultTenantId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await signIn("credentials", {
        tenantId: tenantId.trim(),
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid tenant id, email, or password.");
        return;
      }
      router.push(redirectTarget);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-lg"
    >
      <div>
        <h1 className="text-xl font-semibold text-zinc-50">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Sign in to your Struxient Office workspace.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-zinc-300">Tenant ID</span>
        <input
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          value={tenantId}
          onChange={(ev) => setTenantId(ev.target.value)}
          autoComplete="off"
          required
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-zinc-300">Email</span>
        <input
          type="email"
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          autoComplete="username"
          required
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-zinc-300">Password</span>
        <input
          type="password"
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
