import Link from "next/link";
import React from "react";

type BreadcrumbSegment = {
  label: string;
  href?: string;
};

type Props = {
  category: "Commercial" | "Execution";
  segments?: BreadcrumbSegment[];
};

/**
 * Lightweight orienting breadcrumb line for internal testing surfaces.
 * Format: Category / Segment 1 / Segment 2 ...
 */
export function InternalBreadcrumb({ category, segments = [] }: Props) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
      <span className={category === "Commercial" ? "text-zinc-500" : "text-zinc-500"}>
        {category}
      </span>
      {segments.map((s, i) => (
        <React.Fragment key={i}>
          <span className="text-zinc-700">/</span>
          {s.href ? (
            <Link href={s.href} className="hover:text-zinc-300 transition-colors">
              {s.label}
            </Link>
          ) : (
            <span className="text-zinc-400">{s.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
