import Link from "next/link";

type HubLink = {
  href: string;
  label: string;
  description: string;
  state?: "ready" | "needs-seed" | "needs-data";
};

type HubSection = {
  id: string;
  title: string;
  intent: string;
  testFirst?: string;
  links: HubLink[];
};

const HUB_SECTIONS: HubSection[] = [
  {
    id: "setup",
    title: "1. Setup & access",
    intent: "Sign in (or enable dev auth bypass) before opening any tenant-scoped surface.",
    testFirst: "Sign in as the seeded office user, then open the quote list to confirm the session works.",
    links: [
      {
        href: "/dev/login",
        label: "Sign in",
        description: "Tenant id + email + password (from npm run db:seed).",
        state: "ready",
      },
    ],
  },
  {
    id: "create",
    title: "2. Create",
    intent: "Create a new customer + flow group + quote shell, or attach to existing ones.",
    testFirst: "Use the form below to create a fresh shell, then jump straight into its workspace.",
    links: [
      {
        href: "/dev/new-quote-shell",
        label: "New quote shell",
        description: "POST /api/commercial/quote-shell. office_mutate required.",
        state: "ready",
      },
    ],
  },
  {
    id: "discovery",
    title: "3. Discovery",
    intent: "Browse what already exists in the tenant. All lists are tenant-scoped reads.",
    testFirst: "Open the quote list — every row links into its workspace.",
    links: [
      {
        href: "/dev/quotes",
        label: "Quote list",
        description: "All quotes for this tenant. Each row links into its workspace.",
        state: "ready",
      },
      {
        href: "/dev/customers",
        label: "Customer list",
        description: "Customers in this tenant. Useful for attach-mode creation.",
        state: "ready",
      },
      {
        href: "/dev/flow-groups",
        label: "Flow group list",
        description: "Flow groups (one per customer engagement). One Job per group.",
        state: "ready",
      },
      {
        href: "/dev/task-definitions",
        label: "Task definition library",
        description:
          "Curated authored standards. Author completion requirements (notes, photos, checklists, measurements, identifiers, overall result) that flow into runtime validation.",
        state: "ready",
      },
      {
        href: "/dev/catalog-packets",
        label: "Catalog packets (read-only)",
        description:
          "Inspect tenant-scoped scope packets, revisions, and packet task lines. Read-only — no authoring, promotion, or PacketTier surface yet.",
        state: "ready",
      },
    ],
  },
  {
    id: "workspace",
    title: "4. Quote workspace",
    intent:
      "The office workspace for a single quote: readiness, lifecycle steps (select workflow, send, sign, activate), history, and the execution bridge.",
    testFirst:
      "Open a quote from the discovery list → click into its workspace → walk through the numbered steps.",
    links: [
      {
        href: "/dev/quote-scope",
        label: "Quote scope (seeded redirect)",
        description:
          "Auto-opens the quote version from STRUXIENT_DEV_QUOTE_VERSION_ID.",
        state: "needs-seed",
      },
    ],
  },
  {
    id: "execution",
    title: "5. Execution",
    intent: "Once a signed quote is activated, the workspace exposes a flow + job + work feed.",
    testFirst:
      "Open Activated flows to discover real tenant execution records — no env-seeded ids needed.",
    links: [
      {
        href: "/dev/flows",
        label: "Activated flows (discovery)",
        description:
          "Tenant-scoped list of every Flow row. Each row links to flow detail and work feed.",
        state: "ready",
      },
      {
        href: "/dev/jobs",
        label: "Jobs (discovery)",
        description:
          "Tenant-scoped list of Job records. Jobs are the stable anchors created at SIGN.",
        state: "ready",
      },
      {
        href: "/dev/flow",
        label: "Flow detail (seed shortcut)",
        description:
          "Redirects to /dev/flow/<flowId> using STRUXIENT_DEV_FLOW_ID. Prefer the discovery list above.",
        state: "needs-seed",
      },
      {
        href: "/dev/work-feed",
        label: "Work feed (seed shortcut)",
        description:
          "Redirects to /dev/work-feed/<flowId> after npm run db:seed:activated. Prefer the discovery list above.",
        state: "needs-seed",
      },
    ],
  },
];

const STATE_LABEL: Record<NonNullable<HubLink["state"]>, { label: string; cls: string }> = {
  ready: { label: "Ready", cls: "border-emerald-800/80 bg-emerald-950/50 text-emerald-300" },
  "needs-seed": {
    label: "Needs seed",
    cls: "border-amber-800/80 bg-amber-950/50 text-amber-300",
  },
  "needs-data": {
    label: "Needs data",
    cls: "border-zinc-700 bg-zinc-900 text-zinc-300",
  },
};

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-200 sm:px-6">
      <header className="mb-8 border-b border-zinc-800/80 pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Internal testing hub</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Struxient v3</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Reach the implemented commercial-to-execution surfaces without memorizing dev URLs. Each section
          maps to a real coded slice; surfaces marked <span className="font-medium text-amber-300">Needs seed</span>{" "}
          require <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-300">npm run db:seed</code> (and{" "}
          <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-300">npm run db:seed:activated</code> for
          execution).
        </p>
      </header>

      <ol className="space-y-8">
        {HUB_SECTIONS.map((section) => (
          <li key={section.id} id={section.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-5">
            <h2 className="text-sm font-semibold text-zinc-100">{section.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{section.intent}</p>
            {section.testFirst ? (
              <p className="mt-2 rounded border border-sky-900/40 bg-sky-950/20 px-3 py-1.5 text-[11px] leading-relaxed text-sky-300/90">
                <span className="font-semibold uppercase tracking-wide">Test first:</span> {section.testFirst}
              </p>
            ) : null}

            <ul className="mt-4 space-y-3">
              {section.links.map((link) => {
                const state = link.state ? STATE_LABEL[link.state] : null;
                return (
                  <li key={link.href} className="rounded border border-zinc-800/80 bg-zinc-900/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={link.href}
                        className="text-sm font-medium text-sky-400 hover:text-sky-300"
                      >
                        {link.label}
                      </Link>
                      {state ? (
                        <span
                          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${state.cls}`}
                        >
                          {state.label}
                        </span>
                      ) : null}
                      <code className="ml-auto text-[10px] text-zinc-500">{link.href}</code>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{link.description}</p>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>

      <details className="mt-10 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-4">
        <summary className="cursor-pointer text-xs font-medium text-zinc-400 hover:text-zinc-300">
          Technical details
        </summary>
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          Raw route references for direct API testing. The structured sections above are the recommended path for
          manual UI testing.
        </p>
        <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-zinc-500">
          <p>
            Read scope: <code className="text-zinc-400">GET /api/quote-versions/&lt;id&gt;/scope</code>
          </p>
          <p>
            Lifecycle: <code className="text-zinc-400">GET /api/quote-versions/&lt;id&gt;/lifecycle</code> — status,
            job (via flow group), signature, optional flow / activation.
          </p>
          <p>
            Job shell: <code className="text-zinc-400">GET /api/jobs/&lt;jobId&gt;</code> — flow group + flows,
            activation, runtime tasks, per-task execution + actionability.
          </p>
          <p>
            Flow execution: <code className="text-zinc-400">GET /api/flows/&lt;flowId&gt;</code> — activation,
            workflow node order, skeleton + runtime arrays, merged work items, actionability.
          </p>
          <p>
            Pin workflow (draft):{" "}
            <code className="text-zinc-400">PATCH /api/quote-versions/&lt;id&gt;</code>{" "}
            <code className="text-zinc-400">{`{"pinnedWorkflowVersionId":"<wfVersionId>"}`}</code> or{" "}
            <code className="text-zinc-400">null</code> to clear.
          </p>
          <p>
            Lines (draft only):{" "}
            <code className="text-zinc-400">POST /api/quote-versions/&lt;id&gt;/line-items</code>,{" "}
            <code className="text-zinc-400">PATCH/DELETE …/line-items/&lt;lineId&gt;</code>.
          </p>
          <p>
            Compose preview: <code className="text-zinc-400">POST /api/quote-versions/&lt;id&gt;/compose-preview</code>.
          </p>
          <p>
            Send / freeze: <code className="text-zinc-400">POST /api/quote-versions/&lt;id&gt;/send</code> —
            requires <code className="text-zinc-400">clientStalenessToken</code> from compose preview.
          </p>
          <p>
            Frozen read: <code className="text-zinc-400">GET /api/quote-versions/&lt;id&gt;/freeze</code> — 409 if
            still draft.
          </p>
          <p>
            Sign: <code className="text-zinc-400">POST /api/quote-versions/&lt;id&gt;/sign</code> — SENT → SIGNED;
            chains activate when <code className="text-zinc-400">Tenant.autoActivateOnSign</code>.
          </p>
          <p>
            Activate: <code className="text-zinc-400">POST /api/quote-versions/&lt;id&gt;/activate</code> — SIGNED
            → flow + runtime tasks from frozen package.
          </p>
          <p>
            Runtime execution:{" "}
            <code className="text-zinc-400">POST /api/runtime-tasks/&lt;id&gt;/start</code> /{" "}
            <code className="text-zinc-400">…/complete</code>.
          </p>
          <p>
            Skeleton execution:{" "}
            <code className="text-zinc-400">
              POST /api/flows/&lt;flowId&gt;/skeleton-tasks/&lt;skeletonTaskId&gt;/start
            </code>{" "}
            / <code className="text-zinc-400">…/complete</code>.
          </p>
          <p>
            Auth: session cookie (JWT) + tenant membership. Optional local-only{" "}
            <code className="text-zinc-400">STRUXIENT_DEV_AUTH_BYPASS</code> — see{" "}
            <code className="text-zinc-400">.env.example</code>.
          </p>
        </div>
      </details>
    </main>
  );
}
