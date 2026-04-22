import type { PrismaClient } from "@prisma/client";

/**
 * Epic 58 foundation — substring match over anchored office entities only.
 * Not full-text search, ranking, or cross-tenant indexing.
 */
export const OFFICE_TENANT_SEARCH_READ_SCHEMA_VERSION = 1 as const;

export const OFFICE_SEARCH_QUERY_MIN_LEN = 2;
export const OFFICE_SEARCH_QUERY_MAX_LEN = 80;
export const OFFICE_SEARCH_DEFAULT_LIMIT_PER_SECTION = 8;

export type OfficeSearchRefusalReason = "too_short" | "too_long";

/** `q` missing or whitespace only — no DB work, not an error. */
export type OfficeSearchQueryAbsent = { ok: "absent" };

export type OfficeSearchHitKind =
  | "customer"
  | "quote"
  /** Flow group / “project” shell in office navigation. */
  | "project"
  | "job"
  | "flow"
  | "library_packet"
  | "library_task_definition"
  | "library_process_template";

export type OfficeSearchHit = {
  kind: OfficeSearchHitKind;
  id: string;
  title: string;
  subtitle: string | null;
  /** Path under office app (leading slash). */
  href: string;
};

export type OfficeSearchSectionKind =
  | "customers"
  | "quotes"
  | "projects"
  | "jobs"
  | "flows"
  | "library_packets"
  | "library_task_definitions"
  | "library_process_templates";

export type OfficeSearchSection = {
  kind: OfficeSearchSectionKind;
  /** Stable section ordering is defined by `SECTION_ORDER` — not relevance ranking. */
  label: string;
  hits: OfficeSearchHit[];
};

export type OfficeTenantSearchReadModel = {
  schemaVersion: typeof OFFICE_TENANT_SEARCH_READ_SCHEMA_VERSION;
  /** Normalized needle used for matching; empty when search was refused or not run. */
  needle: string;
  refusal: OfficeSearchRefusalReason | null;
  sections: OfficeSearchSection[];
};

/** Fixed section ordering (not relevance-ranked). */
export const OFFICE_SEARCH_SECTION_ORDER: readonly OfficeSearchSectionKind[] = [
  "customers",
  "quotes",
  "projects",
  "jobs",
  "flows",
  "library_packets",
  "library_task_definitions",
  "library_process_templates",
] as const;

export type NormalizeOfficeSearchQueryResult =
  | { ok: true; needle: string }
  | { ok: false; refusal: OfficeSearchRefusalReason }
  | OfficeSearchQueryAbsent;

/**
 * Trims whitespace. Absent/blank `q` → `absent` (no search). Too short / too long → refusal (no DB in caller).
 */
export function normalizeOfficeSearchQuery(raw: string | null | undefined): NormalizeOfficeSearchQueryResult {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) {
    return { ok: "absent" };
  }
  if (trimmed.length < OFFICE_SEARCH_QUERY_MIN_LEN) {
    return { ok: false, refusal: "too_short" };
  }
  if (trimmed.length > OFFICE_SEARCH_QUERY_MAX_LEN) {
    return { ok: false, refusal: "too_long" };
  }
  return { ok: true, needle: trimmed };
}

function emptyModel(needle: string, refusal: OfficeSearchRefusalReason | null): OfficeTenantSearchReadModel {
  return {
    schemaVersion: OFFICE_TENANT_SEARCH_READ_SCHEMA_VERSION,
    needle,
    refusal,
    sections: OFFICE_SEARCH_SECTION_ORDER.map((kind) => ({
      kind,
      label: sectionLabel(kind),
      hits: [],
    })),
  };
}

function sectionLabel(kind: OfficeSearchSectionKind): string {
  switch (kind) {
    case "customers":
      return "Customers";
    case "quotes":
      return "Quotes";
    case "projects":
      return "Projects";
    case "jobs":
      return "Jobs";
    case "flows":
      return "Flows";
    case "library_packets":
      return "Library · scope packets";
    case "library_task_definitions":
      return "Library · task definitions";
    case "library_process_templates":
      return "Library · process templates";
    default:
      return kind;
  }
}

function sectionMap(sections: OfficeSearchSection[]): OfficeSearchSection[] {
  const byKind = new Map(sections.map((s) => [s.kind, s]));
  return OFFICE_SEARCH_SECTION_ORDER.map(
    (kind) => byKind.get(kind) ?? { kind, label: sectionLabel(kind), hits: [] },
  );
}

/**
 * Tenant-scoped substring search across high-traffic office anchors.
 * Every query includes `tenantId` on the root model — no cross-tenant leakage.
 */
export async function searchOfficeTenantAnchors(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    query: string | null | undefined;
    limitPerSection?: number;
  },
): Promise<OfficeTenantSearchReadModel> {
  const limit = Math.min(
    25,
    Math.max(1, params.limitPerSection ?? OFFICE_SEARCH_DEFAULT_LIMIT_PER_SECTION),
  );
  const parsed = normalizeOfficeSearchQuery(params.query);
  if (parsed.ok === "absent") {
    return emptyModel("", null);
  }
  if (!parsed.ok) {
    return emptyModel("", parsed.refusal);
  }
  const { needle } = parsed;
  const tenantId = params.tenantId;

  const [
    customers,
    quotes,
    flowGroups,
    jobs,
    flows,
    scopePackets,
    taskDefinitions,
    workflowTemplates,
  ] = await Promise.all([
    prisma.customer.findMany({
      where: {
        tenantId,
        OR: [
          { name: { contains: needle, mode: "insensitive" } },
          { primaryEmail: { contains: needle, mode: "insensitive" } },
          { primaryPhone: { contains: needle, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, primaryEmail: true },
    }),
    prisma.quote.findMany({
      where: {
        tenantId,
        quoteNumber: { contains: needle, mode: "insensitive" },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, quoteNumber: true, customer: { select: { name: true } } },
    }),
    prisma.flowGroup.findMany({
      where: {
        tenantId,
        OR: [
          { name: { contains: needle, mode: "insensitive" } },
          { customer: { name: { contains: needle, mode: "insensitive" } } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, customer: { select: { name: true } } },
    }),
    prisma.job.findMany({
      where: {
        tenantId,
        OR: [
          { id: { contains: needle, mode: "insensitive" } },
          { flowGroup: { name: { contains: needle, mode: "insensitive" } } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, flowGroup: { select: { name: true } } },
    }),
    prisma.flow.findMany({
      where: {
        tenantId,
        OR: [
          { id: { contains: needle, mode: "insensitive" } },
          { quoteVersion: { quote: { quoteNumber: { contains: needle, mode: "insensitive" } } } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        jobId: true,
        quoteVersion: { select: { quote: { select: { quoteNumber: true } } } },
      },
    }),
    prisma.scopePacket.findMany({
      where: {
        tenantId,
        OR: [
          { displayName: { contains: needle, mode: "insensitive" } },
          { packetKey: { contains: needle, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { id: "desc" },
      select: { id: true, displayName: true, packetKey: true },
    }),
    prisma.taskDefinition.findMany({
      where: {
        tenantId,
        OR: [
          { displayName: { contains: needle, mode: "insensitive" } },
          { taskKey: { contains: needle, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: { id: true, displayName: true, taskKey: true },
    }),
    prisma.workflowTemplate.findMany({
      where: {
        tenantId,
        OR: [
          { displayName: { contains: needle, mode: "insensitive" } },
          { templateKey: { contains: needle, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { id: "desc" },
      select: { id: true, displayName: true, templateKey: true },
    }),
  ]);

  const sections: OfficeSearchSection[] = [
    {
      kind: "customers",
      label: sectionLabel("customers"),
      hits: customers.map((c) => ({
        kind: "customer" as const,
        id: c.id,
        title: c.name,
        subtitle: c.primaryEmail ?? null,
        href: `/customers/${c.id}`,
      })),
    },
    {
      kind: "quotes",
      label: sectionLabel("quotes"),
      hits: quotes.map((q) => ({
        kind: "quote" as const,
        id: q.id,
        title: `Quote ${q.quoteNumber}`,
        subtitle: q.customer.name,
        href: `/quotes/${q.id}`,
      })),
    },
    {
      kind: "projects",
      label: sectionLabel("projects"),
      hits: flowGroups.map((g) => ({
        kind: "project" as const,
        id: g.id,
        title: g.name,
        subtitle: g.customer.name,
        href: `/projects/${g.id}`,
      })),
    },
    {
      kind: "jobs",
      label: sectionLabel("jobs"),
      hits: jobs.map((j) => ({
        kind: "job" as const,
        id: j.id,
        title: j.flowGroup.name,
        subtitle: `Job ${j.id}`,
        href: `/jobs/${j.id}`,
      })),
    },
    {
      kind: "flows",
      label: sectionLabel("flows"),
      hits: flows.map((f) => ({
        kind: "flow" as const,
        id: f.id,
        title: `Flow · quote ${f.quoteVersion.quote.quoteNumber}`,
        subtitle: `Job ${f.jobId}`,
        href: `/flows/${f.id}`,
      })),
    },
    {
      kind: "library_packets",
      label: sectionLabel("library_packets"),
      hits: scopePackets.map((p) => ({
        kind: "library_packet" as const,
        id: p.id,
        title: p.displayName,
        subtitle: p.packetKey,
        href: `/library/packets/${p.id}`,
      })),
    },
    {
      kind: "library_task_definitions",
      label: sectionLabel("library_task_definitions"),
      hits: taskDefinitions.map((t) => ({
        kind: "library_task_definition" as const,
        id: t.id,
        title: t.displayName,
        subtitle: t.taskKey,
        href: `/library/task-definitions/${t.id}`,
      })),
    },
    {
      kind: "library_process_templates",
      label: sectionLabel("library_process_templates"),
      hits: workflowTemplates.map((w) => ({
        kind: "library_process_template" as const,
        id: w.id,
        title: w.displayName,
        subtitle: w.templateKey,
        href: `/library/process-templates/${w.id}`,
      })),
    },
  ];

  return {
    schemaVersion: OFFICE_TENANT_SEARCH_READ_SCHEMA_VERSION,
    needle,
    refusal: null,
    sections: sectionMap(sections),
  };
}
