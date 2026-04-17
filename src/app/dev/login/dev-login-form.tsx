"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  defaultTenantId: string;
};

export function DevLoginForm({ defaultTenantId }: Props) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState(defaultTenantId);
  const [email, setEmail] = useState("seed@example.com");
  const [password, setPassword] = useState("struxient-dev");
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
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <h1 className="text-lg font-medium text-zinc-100">Dev sign-in</h1>
      <p className="text-xs leading-relaxed text-zinc-500">
        Credentials auth for local use. Default password after <code className="text-zinc-400">npm run db:seed</code> is{" "}
        <code className="text-zinc-400">struxient-dev</code> unless <code className="text-zinc-400">STRUXIENT_SEED_DEV_PASSWORD</code>{" "}
        was set. Tenant id comes from <code className="text-zinc-400">.env.local</code>.
      </p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <label className="block space-y-1">
        <span className="text-xs text-zinc-400">Tenant ID</span>
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
          value={tenantId}
          onChange={(ev) => setTenantId(ev.target.value)}
          autoComplete="off"
          required
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-zinc-400">Email</span>
        <input
          type="email"
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-zinc-400">Password</span>
        <input
          type="password"
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-sky-700 px-3 py-2 text-sm text-white hover:bg-sky-600 disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
