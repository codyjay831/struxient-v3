import Link from "next/link";
import React from "react";

type NotFoundProps = {
  title: string;
  message: string;
  backLink: { href: string; label: string };
};

/**
 * Standardized "Record Not Found" or "Unauthorized Access" block for internal pages.
 */
export function InternalNotFoundState({ title, message, backLink }: NotFoundProps) {
  return (
    <section className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-8 text-sm text-zinc-400">
      <h2 className="text-base font-semibold text-zinc-200">{title}</h2>
      <p className="mt-2 leading-relaxed">
        {message}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={backLink.href}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          {backLink.label}
        </Link>
        <Link
          href="/"
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          ← Hub
        </Link>
      </div>
    </section>
  );
}

type SparseProps = {
  message: string;
  hint?: string;
  action?: { href: string; label: string };
};

/**
 * Standardized block for valid records that have no related data yet (e.g. no line items, no flows).
 */
export function InternalSparseState({ message, hint, action }: SparseProps) {
  return (
    <section className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/10 p-8 text-center text-sm text-zinc-400">
      <p className="font-medium text-zinc-300">{message}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500 italic">{hint}</p>}
      {action && (
        <div className="mt-4">
          <Link
            href={action.href}
            className="inline-block rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            {action.label}
          </Link>
        </div>
      )}
    </section>
  );
}

type EmptyDiscoveryProps = {
  resourceName: string;
  createInstructions: string;
  action: { href: string; label: string };
};

/**
 * Standardized empty state for discovery list pages (Quotes, Flows, etc).
 */
export function InternalEmptyDiscoveryState({
  resourceName,
  createInstructions,
  action,
}: EmptyDiscoveryProps) {
  return (
    <section className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-10 text-center">
      <p className="text-sm font-semibold text-zinc-300">No {resourceName.toLowerCase()} found</p>
      <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-zinc-500">
        {createInstructions}
      </p>
      <div className="mt-6 flex justify-center">
        <Link
          href={action.href}
          className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors shadow-sm"
        >
          {action.label}
        </Link>
      </div>
    </section>
  );
}
