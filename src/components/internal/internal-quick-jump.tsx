import Link from "next/link";
import React from "react";

type QuickJumpLink = {
  label: string;
  href: string;
  variant?: "default" | "emerald" | "sky" | "amber";
  isActive?: boolean;
};

type Props = {
  title?: string;
  links: QuickJumpLink[];
};

/**
 * Lightweight convenience strip for common internal testing moves.
 */
export function InternalQuickJump({ title = "Quick jump", links }: Props) {
  if (links.length === 0) return null;

  return (
    <nav className="flex flex-wrap items-center gap-2 text-[11px]">
      <span className="font-semibold uppercase tracking-wide text-zinc-600 mr-1">
        {title}
      </span>
      {links.map((link, i) => {
        const variantClasses = {
          default: "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800",
          emerald: "border-emerald-800/60 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/40",
          sky: "border-sky-800/60 bg-sky-950/20 text-sky-400 hover:bg-sky-950/40",
          amber: "border-amber-800/60 bg-amber-950/20 text-amber-400 hover:bg-amber-950/40",
        };

        const activeClasses = "bg-zinc-800 text-zinc-400 cursor-default border-transparent";
        const className = `rounded border px-2 py-1 transition-colors font-medium ${
          link.isActive ? activeClasses : variantClasses[link.variant ?? "default"]
        }`;

        if (link.isActive) {
          return (
            <span key={i} className={className}>
              {link.label}
            </span>
          );
        }

        return (
          <Link key={i} href={link.href} className={className}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
