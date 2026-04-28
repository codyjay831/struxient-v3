"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { QuoteVersionScopeApiDto } from "@/lib/quote-version-scope-dto";
import type { ScopeProposalGroupWithItems } from "@/lib/quote-scope/quote-scope-grouping";
import type { ScopePacketSummaryDto } from "@/server/slice1/reads/scope-packet-catalog-reads";
import type { QuoteLocalPacketDto } from "@/server/slice1/reads/quote-local-packet-reads";
import type { LineItemPresetSummaryDto } from "@/server/slice1/reads/line-item-preset-reads";
import { type LineItemExecutionPreviewDto } from "@/lib/quote-line-item-execution-preview";
import { LineItemExecutionPreviewBlock } from "@/components/quote-scope/line-item-execution-preview-block";
import { QuickAddLineItemPicker } from "@/components/quote-scope/quick-add-line-item-picker";
import type { LineItemForRecent } from "@/lib/quick-add-line-item-picker-filter";
import {
  buildFieldsFromPacket,
  buildFieldsFromPreset,
} from "@/lib/quote-line-item-prefill";
import {
  mergeLocalPacketsForPicker,
  resolveFieldWorkDisplayNameForQuickCreate,
  validateOneOffWorkDisplayNameInput,
} from "@/lib/quote-line-item-local-packet-quick-create";
import {
  SCOPE_LINE_ITEM_MAX_DESCRIPTION,
  validateScopeLineItemFormFields,
  type ManifestFieldWorkSetup,
} from "@/lib/quote-line-item-scope-form-validation";

const MAX_DESCRIPTION = SCOPE_LINE_ITEM_MAX_DESCRIPTION;

const FIELD_WORK_SECTION_ID = "quote-local-field-work";

function fieldWorkSectionHref(fieldWorkExternalBaseHref?: string | null): string {
  if (fieldWorkExternalBaseHref) {
    return `${fieldWorkExternalBaseHref}#${FIELD_WORK_SECTION_ID}`;
  }
  return `#${FIELD_WORK_SECTION_ID}`;
}

function fieldWorkPacketHref(fieldWorkExternalBaseHref: string | null | undefined, packetId: string): string {
  if (fieldWorkExternalBaseHref) {
    return `${fieldWorkExternalBaseHref}#field-work-${packetId}`;
  }
  return `#field-work-${packetId}`;
}

function scrollFieldWorkSectionIntoView(fieldWorkExternalBaseHref?: string | null) {
  window.setTimeout(() => {
    if (fieldWorkExternalBaseHref) {
      window.location.assign(`${fieldWorkExternalBaseHref}#${FIELD_WORK_SECTION_ID}`);
      return;
    }
    document.getElementById(FIELD_WORK_SECTION_ID)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 200);
}

type ProposalGroup = QuoteVersionScopeApiDto["proposalGroups"][number];
type LineItem = QuoteVersionScopeApiDto["orderedLineItems"][number];
type GroupWithItems = ScopeProposalGroupWithItems<ProposalGroup, LineItem>;

type EditableReason = "ok" | "missing_capability" | "not_editable_head";

/**
 * Library packet summary as the form consumes it. We only show packets that
 * have at least one PUBLISHED revision (the only revisions a quote line item
 * can pin) — filtering happens client-side from the full summary list.
 */
type LibraryPacketOption = ScopePacketSummaryDto;
/**
 * Local packet summary as the form consumes it (subset of `QuoteLocalPacketDto`,
 * but kept as the full DTO so future fields are available without a re-plumb).
 */
type LocalPacketOption = QuoteLocalPacketDto;

type Props = {
  quoteId: string;
  quoteVersionId: string;
  versionNumber: number;
  proposalGroups: ProposalGroup[];
  groupedLineItems: GroupWithItems[];
  /**
   * All catalog packets visible to this tenant. The form filters internally
   * to those with `latestPublishedRevisionId !== null` — DRAFT-only packets
   * are not pinnable from a quote line item (Triangle Mode pin-XOR rule).
   */
  availableLibraryPackets: LibraryPacketOption[];
  /** All quote-local packets attached to this quote version. */
  availableLocalPackets: LocalPacketOption[];
  /**
   * Tenant-scoped saved-line-item presets (Triangle Mode — Phase 2 / Slice 2).
   * Defaults to `[]` when omitted (the page only loads them on the editable
   * head DRAFT branch). Threaded into `<QuickAddLineItemPicker/>` so the
   * "Saved line items" section can render alongside library packets.
   */
  availablePresets?: LineItemPresetSummaryDto[];
  /**
   * Per-line execution preview keyed by `QuoteLineItem.id` (Triangle Mode,
   * Phase 1, Slice C). When `null`, the preview is suppressed (e.g. on the
   * non-editable branch where the loader was skipped). When present, every
   * line in `groupedLineItems` should have a corresponding entry; missing
   * entries collapse to no-preview rendering rather than throw.
   */
  executionPreviewByLineItemId: Record<string, LineItemExecutionPreviewDto> | null;
  /**
   * When false (e.g. frozen head), quote-local `#field-work-*` targets are not mounted on this page.
   */
  fieldWorkAnchorsActive: boolean;
  /**
   * When the editor is embedded without `QuoteLocalPacketEditor` (e.g. quote workspace), set to
   * `/quotes/:quoteId/scope` so `#field-work-*` / `#quote-local-field-work` links open the full-page
   * builder where those DOM ids exist. Omit on the scope page for same-page fragment navigation.
   */
  fieldWorkExternalBaseHref?: string | null;
  canMutate: boolean;
  editableReason: EditableReason;
};

type ExecutionMode = "SOLD_SCOPE" | "MANIFEST";

type FormFields = {
  title: string;
  /**
   * Free-form commercial description (Phase 2, Slice 2). Surfaced on the
   * proposal alongside `title`. Server caps at 4000 chars; the form caps at
   * the same value to mirror server validation client-side.
   */
  description: string;
  quantity: string;
  executionMode: ExecutionMode;
  unitPriceCents: string;
  proposalGroupId: string;
  paymentBeforeWork: boolean;
  paymentGateTitleOverride: string;
  /**
   * How field work is set up for a MANIFEST line. Serializes to XOR pins:
   * - `useSavedTaskPacket` → `scopePacketRevisionId` only
   * - `createNewTasks` | `startFromSavedAndCustomize` → `quoteLocalPacketId` only
   * - `"none"` until the user picks (MANIFEST only).
   */
  manifestFieldWorkSetup: ManifestFieldWorkSetup;
  scopePacketRevisionId: string;
  quoteLocalPacketId: string;
};

type Banner =
  | { kind: "success"; title: string; message?: ReactNode }
  | { kind: "error"; title: string; message?: ReactNode }
  | null;

const blankFields = (group: ProposalGroup | undefined): FormFields => ({
  title: "",
  description: "",
  quantity: "1",
  executionMode: "SOLD_SCOPE",
  unitPriceCents: "",
  proposalGroupId: group?.id ?? "",
  paymentBeforeWork: false,
  paymentGateTitleOverride: "",
  manifestFieldWorkSetup: "none",
  scopePacketRevisionId: "",
  quoteLocalPacketId: "",
});

function deriveInitialFromItem(item: LineItem): FormFields {
  const executionMode: ExecutionMode = item.executionMode === "MANIFEST" ? "MANIFEST" : "SOLD_SCOPE";
  let manifestFieldWorkSetup: ManifestFieldWorkSetup = "none";
  if (executionMode === "MANIFEST") {
    if (item.scopePacketRevisionId != null) manifestFieldWorkSetup = "useSavedTaskPacket";
    else if (item.quoteLocalPacketId != null) manifestFieldWorkSetup = "createNewTasks";
  }
  return {
    title: item.title,
    description: item.description ?? "",
    quantity: String(item.quantity),
    executionMode,
    unitPriceCents: "",
    proposalGroupId: item.proposalGroupId,
    paymentBeforeWork: item.paymentBeforeWork,
    paymentGateTitleOverride: item.paymentGateTitleOverride ?? "",
    manifestFieldWorkSetup,
    scopePacketRevisionId: item.scopePacketRevisionId ?? "",
    quoteLocalPacketId: item.quoteLocalPacketId ?? "",
  };
}

/**
 * Office-side line-item authoring UI.
 *
 *   - Renders one section per proposal group via the shared grouping helper.
 *   - Add: opens an inline form pre-targeted at the section's group with
 *     `sortOrder = max(existing in group) + 1` (1 if empty).
 *   - Edit: inline form per row.
 *   - Delete: confirm + DELETE; row vanishes after `router.refresh()`.
 *
 * MANIFEST line items must pin a packet (library revision XOR quote-local
 * packet) — the picker enforces this client-side and the server re-asserts
 * `MANIFEST_SCOPE_PIN_XOR`. SOLD_SCOPE lines are commercial-only and never
 * carry a packet pin.
 *
 * All mutations call the existing canonical line-item API routes
 * (`POST /api/quote-versions/:quoteVersionId/line-items` and
 * `PATCH/DELETE .../line-items/:lineItemId`). After a successful mutation,
 * the page is refreshed via `router.refresh()` so we re-read canonical
 * server state instead of carrying a divergent local model.
 */
export function ScopeEditor({
  quoteId,
  quoteVersionId,
  versionNumber,
  proposalGroups,
  groupedLineItems,
  availableLibraryPackets,
  availableLocalPackets,
  availablePresets = [],
  executionPreviewByLineItemId,
  fieldWorkAnchorsActive,
  fieldWorkExternalBaseHref,
  canMutate,
  editableReason,
}: Props) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [addingForGroupId, setAddingForGroupId] = useState<string | null>(null);
  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);
  // Triangle Mode Step 1 — quick-add library picker state.
  // Mutually exclusive with `addingForGroupId` for the same group: opening the
  // picker closes any open add form (and vice versa) so authoring stays
  // unambiguous.
  const [libraryPickerForGroupId, setLibraryPickerForGroupId] = useState<string | null>(null);
  // Per-group "staged" prefill carried from the picker into the next render
  // of `LineItemForm`. Cleared on cancel and on successful create — the
  // existing handleCreate is the single submit path; the picker never
  // bypasses it.
  const [pendingPrefillByGroupId, setPendingPrefillByGroupId] = useState<
    Record<string, FormFields>
  >({});

  // Quote-local packets created inline from the line-item form within
  // this render lifecycle. Augments `availableLocalPackets` (which is
  // server-supplied via the parent page and only refreshes after a full
  // `router.refresh()`) so a freshly-created packet is selectable in the
  // dropdown without forcing a refresh that would close the in-progress
  // line-item form.
  //
  // Cleared opportunistically by `router.refresh()` re-mounting the
  // editor. We don't bother clearing it eagerly on packet save: the
  // dedup in `mergeLocalPacketsForPicker` ensures the server entry wins
  // once the next refresh re-reads canon.
  const [freshlyCreatedLocalPackets, setFreshlyCreatedLocalPackets] = useState<
    LocalPacketOption[]
  >([]);

  const mergedLocalPackets = useMemo(
    () => mergeLocalPacketsForPicker(availableLocalPackets, freshlyCreatedLocalPackets),
    [availableLocalPackets, freshlyCreatedLocalPackets],
  );

  const singleDefaultMainGroup =
    proposalGroups.length === 1 && proposalGroups[0]?.name?.trim() === "Main";

  const noGroups = proposalGroups.length === 0;

  const pinnableLibraryPackets = useMemo(
    () => availableLibraryPackets.filter((p) => p.latestPublishedRevisionId != null),
    [availableLibraryPackets],
  );

  // Flatten existing line items into a minimal shape the picker can use to
  // surface "Recent in this quote". Iteration order matches the visible
  // grouping (group order → sortOrder) so the strip is deterministic.
  const recentLineItemsForPicker: LineItemForRecent[] = useMemo(() => {
    const out: LineItemForRecent[] = [];
    for (const g of groupedLineItems) {
      for (const it of g.items) {
        out.push({
          scopePacketRevisionId: it.scopePacketRevisionId ?? null,
          scopeRevision: it.scopeRevision
            ? { scopePacketId: it.scopeRevision.scopePacketId }
            : null,
        });
      }
    }
    return out;
  }, [groupedLineItems]);

  function clearPendingPrefill(groupId: string) {
    setPendingPrefillByGroupId((prev) => {
      if (!(groupId in prev)) return prev;
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  }

  /**
   * Stage a prefill from a selected library packet, then open the existing
   * line-item form for the target group.
   *
   * Field rules (Triangle Mode Step 1 — UX-only):
   *   - `executionMode` always set to `"MANIFEST"` (library packets always
   *     produce runtime tasks; SOLD_SCOPE is not in the picker).
   *   - `manifestFieldWorkSetup` set to `"useSavedTaskPacket"` and `scopePacketRevisionId` set to
   *     the packet's `latestPublishedRevisionId` (server invariant requires
   *     a PUBLISHED revision; the picker filters non-pinnable packets out
   *     before we ever reach here).
   *   - `quoteLocalPacketId` cleared (XOR rule, mirrored client-side); setup
   *     becomes `"useSavedTaskPacket"`.
   *   - `quantity` defaults to "1" only if the previously-staged value is
   *     blank (preserves any explicit value the user staged earlier).
   *   - `title` set to the packet display name **only when the existing
   *     staged title is empty** — never overwrites a user-entered title.
   *   - `unitPriceCents` is intentionally never touched here. Estimators
   *     still set price after adding (no schema-backed price recall yet).
   *
   * The submit path is unchanged: the existing form's "Create line item"
   * button still calls `handleCreate`, which still runs validation, still
   * issues the same POST, and still goes through every existing server
   * mutation invariant (XOR, PUBLISHED-only, tenant alignment).
   */
  function prefillFromPacket(
    packet: LibraryPacketOption,
    group: ProposalGroup,
  ) {
    const base: FormFields = pendingPrefillByGroupId[group.id] ?? blankFields(group);
    const result = buildFieldsFromPacket(packet, base);
    if (!result.ok) return;
    const next: FormFields = {
      ...base,
      ...result.fields,
      proposalGroupId: group.id,
    };
    setPendingPrefillByGroupId((prev) => ({ ...prev, [group.id]: next }));
    setLibraryPickerForGroupId(null);
    setEditingLineItemId(null);
    setAddingForGroupId(group.id);
  }

  /**
   * Stage a prefill from a selected `LineItemPreset`, then open the existing
   * line-item form for the target group (Triangle Mode — Phase 2 / Slice 2).
   *
   * Mirrors `prefillFromPacket` in submit-path discipline:
   *   - Never bypasses the form. The user still clicks "Create line item".
   *   - Never bypasses server validation. `MANIFEST_SCOPE_PIN_XOR` and
   *     PUBLISHED-revision discipline are still authoritative.
   *
   * Differences from the packet path:
   *   - **Commercial defaults are copied verbatim** (price, quantity,
   *     description, payment flags) — the preset's whole job is to remember
   *     these. The user can still edit before submit.
   *   - `executionMode` may be SOLD_SCOPE (from a SOLD_SCOPE preset), in
   *     which case both packet ids are cleared.
   *   - For MANIFEST presets the picker has already gated on usability
   *     (`buildFieldsFromPreset` returns `{ ok: false, … }` for missing
   *     packet / no PUBLISHED revision); this handler short-circuits on
   *     unusable presets defensively even though the picker disables them.
   */
  function prefillFromPreset(
    preset: LineItemPresetSummaryDto,
    group: ProposalGroup,
  ) {
    const base: FormFields = pendingPrefillByGroupId[group.id] ?? blankFields(group);
    const result = buildFieldsFromPreset(preset, base);
    if (!result.ok) return;
    const next: FormFields = {
      ...base,
      ...result.fields,
      proposalGroupId: group.id,
    };
    setPendingPrefillByGroupId((prev) => ({ ...prev, [group.id]: next }));
    setLibraryPickerForGroupId(null);
    setEditingLineItemId(null);
    setAddingForGroupId(group.id);
  }

  if (!canMutate) {
    return (
      <ReadOnlyView
        groupedLineItems={groupedLineItems}
        versionNumber={versionNumber}
        editableReason={editableReason}
        quoteId={quoteId}
        availableLibraryPackets={availableLibraryPackets}
        executionPreviewByLineItemId={executionPreviewByLineItemId}
        fieldWorkAnchorsActive={fieldWorkAnchorsActive}
        fieldWorkExternalBaseHref={fieldWorkExternalBaseHref}
        singleDefaultMainGroup={singleDefaultMainGroup}
      />
    );
  }

  if (noGroups) {
    return (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-sm text-zinc-300">
        <h2 className="text-base font-semibold text-zinc-100">No proposal groups yet</h2>
        <p className="mt-2 text-zinc-400">
          Line items must belong to a proposal group, and this version has none. Proposal-group
          management isn’t part of this slice — open the workspace to seed groups (or use the
          group API) before authoring line items here.
        </p>
        <div className="mt-3">
          <Link
            href={`/quotes/${quoteId}`}
            className="inline-block rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            Open workspace →
          </Link>
        </div>
      </section>
    );
  }

  async function handleCreate(fields: FormFields, group: GroupWithItems) {
    setBusyKey(`create:${group.id}`);
    setBanner(null);
    try {
      const validation = validateScopeLineItemFormFields(fields);
      if (!validation.ok) {
        setBanner({ kind: "error", title: "Cannot create line item", message: validation.message });
        return;
      }

      // sortOrder strategy: max(existing) + 1, or 1 if empty. Server has the
      // final say on uniqueness via the existing mutation contract; this is
      // just a client-side pick that keeps new items at the bottom of the
      // visible group ordering.
      const nextSort =
        group.items.reduce((acc, it) => (it.sortOrder > acc ? it.sortOrder : acc), 0) + 1;

      const body = {
        proposalGroupId: group.id,
        sortOrder: nextSort,
        title: validation.title,
        description: validation.description,
        quantity: validation.quantity,
        executionMode: fields.executionMode,
        unitPriceCents: validation.unitPriceCents,
        paymentBeforeWork: validation.paymentBeforeWork,
        paymentGateTitleOverride: validation.paymentBeforeWork ? validation.paymentGateTitleOverride : null,
        scopePacketRevisionId: validation.scopePacketRevisionId,
        quoteLocalPacketId: validation.quoteLocalPacketId,
      };

      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/line-items`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setBanner({
          kind: "error",
          title: "Create failed",
          message: json.error?.message ?? `${res.status} ${json.error?.code ?? "ERROR"}`,
        });
        return;
      }
      setAddingForGroupId(null);
      clearPendingPrefill(group.id);
      const freshIds = new Set(freshlyCreatedLocalPackets.map((p) => p.id));
      const showAddTasksLink =
        fields.executionMode === "MANIFEST" &&
        validation.quoteLocalPacketId != null &&
        freshIds.has(validation.quoteLocalPacketId);
      setBanner({
        kind: "success",
        title: showAddTasksLink ? "Line saved" : "Line item added",
        message: showAddTasksLink ? (
          <span>
            Next: add tasks to this field work.{" "}
            <Link
              href={fieldWorkSectionHref(fieldWorkExternalBaseHref)}
              className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
            >
              Add tasks →
            </Link>
          </span>
        ) : (
          validation.title
        ),
      });
      await router.refresh();
      if (showAddTasksLink) {
        scrollFieldWorkSectionIntoView(fieldWorkExternalBaseHref);
      }
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUpdate(item: LineItem, fields: FormFields) {
    setBusyKey(`update:${item.id}`);
    setBanner(null);
    try {
      const validation = validateScopeLineItemFormFields(fields);
      if (!validation.ok) {
        setBanner({ kind: "error", title: "Cannot update line item", message: validation.message });
        return;
      }
      // PATCH only fields the operator can edit in this slice. We always
      // send both packet ids (or null) so the server can transition between
      // SOLD_SCOPE / MANIFEST and library / local packet pins atomically
      // under the MANIFEST_SCOPE_PIN_XOR invariant.
      const patch = {
        title: validation.title,
        description: validation.description,
        quantity: validation.quantity,
        executionMode: fields.executionMode,
        unitPriceCents: validation.unitPriceCents,
        paymentBeforeWork: validation.paymentBeforeWork,
        paymentGateTitleOverride: validation.paymentBeforeWork ? validation.paymentGateTitleOverride : null,
        scopePacketRevisionId: validation.scopePacketRevisionId,
        quoteLocalPacketId: validation.quoteLocalPacketId,
      };
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/line-items/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(patch),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setBanner({
          kind: "error",
          title: "Update failed",
          message: json.error?.message ?? `${res.status} ${json.error?.code ?? "ERROR"}`,
        });
        return;
      }
      setEditingLineItemId(null);
      const freshIds = new Set(freshlyCreatedLocalPackets.map((p) => p.id));
      const showAddTasksLink =
        fields.executionMode === "MANIFEST" &&
        validation.quoteLocalPacketId != null &&
        freshIds.has(validation.quoteLocalPacketId);
      setBanner({
        kind: "success",
        title: showAddTasksLink ? "Line saved" : "Line item updated",
        message: showAddTasksLink ? (
          <span>
            Next: add tasks to this field work.{" "}
            <Link
              href={fieldWorkSectionHref(fieldWorkExternalBaseHref)}
              className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
            >
              Add tasks →
            </Link>
          </span>
        ) : (
          validation.title
        ),
      });
      await router.refresh();
      if (showAddTasksLink) {
        scrollFieldWorkSectionIntoView(fieldWorkExternalBaseHref);
      }
    } finally {
      setBusyKey(null);
    }
  }

  /**
   * Inline quote-local packet creation for the line-item form
   * (Triangle Mode UX bridge slice). Wraps the existing
   * `POST /api/quote-versions/:quoteVersionId/local-packets` mutation —
   * server still re-asserts DRAFT-only, tenant scope, and `displayName`
   * validation. The newly returned DTO is added to the in-memory
   * `freshlyCreatedLocalPackets` list so the picker dropdown surfaces it
   * before the next `router.refresh()`.
   *
   * Returns the new packet on success so the caller (the picker's
   * inline form) can immediately set `fields.quoteLocalPacketId` and
   * `manifestFieldWorkSetup` becomes a local-packet path. We deliberately do NOT call
   * `router.refresh()` here — that would re-render the page and unmount
   * the in-progress line-item form, defeating the entire bridge UX.
   * Refresh happens for free after the line-item POST/PATCH that
   * follows, and at that point the new packet shows up in the bottom
   * `<QuoteLocalPacketEditor/>` too.
   */
  async function handleForkFromSavedRevision(
    scopePacketRevisionId: string,
    displayNameOverride: string | undefined,
  ): Promise<{ ok: true; packet: LocalPacketOption } | { ok: false; message: string }> {
    const trimmedRev = scopePacketRevisionId.trim();
    if (!trimmedRev) {
      return { ok: false, message: "Choose a saved task packet to copy from." };
    }
    try {
      const body: { scopePacketRevisionId: string; displayName?: string } = {
        scopePacketRevisionId: trimmedRev,
      };
      const dn = displayNameOverride?.trim();
      if (dn && dn.length > 0) {
        body.displayName = dn;
      }
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/local-packets/fork-from-revision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        data?: LocalPacketOption;
        error?: { code?: string; message?: string };
      };
      if (!res.ok || !json.data) {
        const code = json.error?.code ?? "";
        const msg = json.error?.message ?? `${res.status} ${code || "ERROR"}`;
        if (code === "SCOPE_PACKET_REVISION_FORK_SOURCE_HAS_NO_ITEMS") {
          return {
            ok: false,
            message:
              "That saved task packet has no tasks yet — add tasks in the library first, or pick a different packet.",
          };
        }
        if (code === "SCOPE_PACKET_REVISION_FORK_NOT_PUBLISHED") {
          return {
            ok: false,
            message:
              "Only a published saved task packet can be copied to this quote. Publish the packet in the library, then try again.",
          };
        }
        return { ok: false, message: msg };
      }
      const packet = json.data;
      setFreshlyCreatedLocalPackets((prev) =>
        prev.some((p) => p.id === packet.id) ? prev : [...prev, packet],
      );
      return { ok: true, packet };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Network error copying task packet to this quote.",
      };
    }
  }

  async function handleCreateOneOffWork(
    displayName: string,
  ): Promise<{ ok: true; packet: LocalPacketOption } | { ok: false; message: string }> {
    const validated = validateOneOffWorkDisplayNameInput(displayName);
    if (!validated.ok) {
      return { ok: false, message: validated.message };
    }
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/local-packets`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ displayName: validated.trimmed }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        data?: LocalPacketOption;
        error?: { code?: string; message?: string };
      };
      if (!res.ok || !json.data) {
        return {
          ok: false,
          message: json.error?.message ?? `${res.status} ${json.error?.code ?? "ERROR"}`,
        };
      }
      const packet = json.data;
      setFreshlyCreatedLocalPackets((prev) =>
        prev.some((p) => p.id === packet.id) ? prev : [...prev, packet],
      );
      return { ok: true, packet };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Network error creating field work.",
      };
    }
  }

  async function handleDelete(item: LineItem) {
    if (
      !window.confirm(
        `Delete line item "${item.title}"? This removes it from the head draft and cannot be undone here.`,
      )
    ) {
      return;
    }
    setBusyKey(`delete:${item.id}`);
    setBanner(null);
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(quoteVersionId)}/line-items/${encodeURIComponent(item.id)}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setBanner({
          kind: "error",
          title: "Delete failed",
          message: json.error?.message ?? `${res.status} ${json.error?.code ?? "ERROR"}`,
        });
        return;
      }
      setBanner({ kind: "success", title: "Line item deleted", message: item.title });
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-10">
      {banner ? <BannerView banner={banner} onDismiss={() => setBanner(null)} /> : null}

      {groupedLineItems.map((group) => {
        const isAddingHere = addingForGroupId === group.id;
        const isLibraryPickerHere = libraryPickerForGroupId === group.id;
        return (
          <section
            key={group.id}
            className="rounded-lg border border-zinc-800 bg-zinc-900/20 overflow-hidden"
          >
            <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-4 py-3">
              <div>
                {singleDefaultMainGroup ? (
                  <p className="text-xs text-zinc-500">
                    {group.items.length} {group.items.length === 1 ? "line item" : "line items"} · v{versionNumber}{" "}
                    draft
                  </p>
                ) : (
                  <>
                    <h2 className="text-base font-semibold text-zinc-100">{group.name}</h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      {group.items.length} {group.items.length === 1 ? "item" : "items"} · v{versionNumber} draft
                    </p>
                  </>
                )}
              </div>
              {!isAddingHere && !isLibraryPickerHere ? (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLibraryPickerForGroupId(group.id);
                        setEditingLineItemId(null);
                      }}
                      className="rounded border border-sky-800/60 bg-sky-950/30 px-2.5 py-1 text-[11px] font-medium text-sky-200 hover:text-sky-100 hover:border-sky-700 transition-colors"
                      title="Pick a saved line or saved task packet to prefill a new line"
                    >
                      Insert saved line
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingForGroupId(group.id);
                        setEditingLineItemId(null);
                      }}
                      className="rounded bg-sky-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-sky-600 transition-colors"
                    >
                      + Write a custom line
                    </button>
                  </div>
                  <p className="hidden sm:block max-w-[18rem] text-right text-[10px] text-zinc-500 leading-snug">
                    Write a custom line from scratch, or insert a saved line or saved task packet.
                  </p>
                </div>
              ) : null}
            </header>

            {isLibraryPickerHere ? (
              <div className="border-b border-zinc-800 bg-zinc-950/40 p-4">
                <QuickAddLineItemPicker
                  availableLibraryPackets={availableLibraryPackets}
                  availablePresets={availablePresets}
                  recentLineItems={recentLineItemsForPicker}
                  onSelect={(packet) => prefillFromPacket(packet, group)}
                  onSelectPreset={(preset) => prefillFromPreset(preset, group)}
                  onClose={() => setLibraryPickerForGroupId(null)}
                />
              </div>
            ) : null}

            {isAddingHere ? (
              <div className="border-b border-zinc-800 bg-zinc-950/40 p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                  New line item · {group.name}
                </h3>
                <LineItemForm
                  key={`create-${group.id}`}
                  initial={pendingPrefillByGroupId[group.id] ?? blankFields(group)}
                  proposalGroupOptions={[group]}
                  pinnableLibraryPackets={pinnableLibraryPackets}
                  availableLocalPackets={mergedLocalPackets}
                  onCreateOneOffWork={handleCreateOneOffWork}
                  onForkFromSavedRevision={handleForkFromSavedRevision}
                  fieldWorkExternalBaseHref={fieldWorkExternalBaseHref}
                  busy={busyKey === `create:${group.id}`}
                  submitLabel="Create line item"
                  onCancel={() => {
                    setAddingForGroupId(null);
                    clearPendingPrefill(group.id);
                  }}
                  onSubmit={(fields) => void handleCreate(fields, group)}
                />
              </div>
            ) : null}

            {group.items.length === 0 && !isAddingHere ? (
              <p className="px-4 py-6 text-xs text-zinc-500 text-center">
                No line items in this group yet. Use the buttons above to write a custom line or
                insert a saved line.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {group.items.map((item) => {
                  const isEditing = editingLineItemId === item.id;
                  return (
                    <li key={item.id} className="px-4 py-4">
                      {isEditing ? (
                        <LineItemForm
                          key={item.id}
                          initial={deriveInitialFromItem(item)}
                          proposalGroupOptions={[group]}
                          pinnableLibraryPackets={pinnableLibraryPackets}
                          availableLocalPackets={mergedLocalPackets}
                          onCreateOneOffWork={handleCreateOneOffWork}
                          onForkFromSavedRevision={handleForkFromSavedRevision}
                          fieldWorkExternalBaseHref={fieldWorkExternalBaseHref}
                          existingItem={item}
                          busy={busyKey === `update:${item.id}`}
                          submitLabel="Save changes"
                          onCancel={() => setEditingLineItemId(null)}
                          onSubmit={(fields) => void handleUpdate(item, fields)}
                        />
                      ) : (
                        <LineItemRow
                          item={item}
                          availableLibraryPackets={availableLibraryPackets}
                          executionPreview={
                            executionPreviewByLineItemId?.[item.id] ?? null
                          }
                          fieldWorkAnchorsActive={fieldWorkAnchorsActive}
                          fieldWorkExternalBaseHref={fieldWorkExternalBaseHref}
                          localTaskCountHint={
                            item.quoteLocalPacketId
                              ? mergedLocalPackets.find((p) => p.id === item.quoteLocalPacketId)
                                  ?.itemCount ?? null
                              : null
                          }
                          busy={busyKey === `delete:${item.id}`}
                          onEdit={() => {
                            setEditingLineItemId(item.id);
                            setAddingForGroupId(null);
                          }}
                          onDelete={() => void handleDelete(item)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- Subcomponents ---------------- */

function LineItemRow({
  item,
  availableLibraryPackets,
  executionPreview,
  fieldWorkAnchorsActive,
  fieldWorkExternalBaseHref,
  localTaskCountHint,
  busy,
  onEdit,
  onDelete,
}: {
  item: LineItem;
  availableLibraryPackets: LibraryPacketOption[];
  executionPreview: LineItemExecutionPreviewDto | null;
  fieldWorkAnchorsActive: boolean;
  fieldWorkExternalBaseHref?: string | null;
  localTaskCountHint?: number | null;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const packetSummary = describeAttachedPacket(item, availableLibraryPackets);
  const statusChip = lineItemFieldWorkStatusChip(item, executionPreview);
  const showPacketSummaryLine = shouldShowPacketSummaryUnderTitle(executionPreview);
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/30 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2 gap-y-1">
              <h3 className="text-base font-semibold text-zinc-50 leading-snug truncate">{item.title}</h3>
              <FieldWorkStatusChip chip={statusChip} />
            </div>
            <LineItemScopeMetadata item={item} />
            <LineItemFieldWorkActions
              item={item}
              executionPreview={executionPreview}
              availableLibraryPackets={availableLibraryPackets}
              fieldWorkAnchorsActive={fieldWorkAnchorsActive}
              fieldWorkExternalBaseHref={fieldWorkExternalBaseHref}
              localTaskCountHint={localTaskCountHint}
              onSetUpFieldWorkEdit={onEdit}
            />
            {showPacketSummaryLine && packetSummary ? (
              <p className={`text-xs leading-relaxed ${packetSummary.tone}`}>{packetSummary.label}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            <button
              type="button"
              onClick={onEdit}
              disabled={busy}
              className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50 transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="rounded border border-red-900/60 bg-red-950/30 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/40 hover:text-red-200 disabled:opacity-50 transition-colors"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
      {executionPreview ? (
        <div id={`line-item-${item.id}-task-preview`}>
          <LineItemExecutionPreviewBlock preview={executionPreview} />
        </div>
      ) : null}
    </div>
  );
}

const lineItemFieldWorkLinkClass =
  "text-xs font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2";

function buildSavedPacketRevisionHref(
  item: LineItem,
  availableLibraryPackets: LibraryPacketOption[],
): string | null {
  if (!item.scopePacketRevisionId) return null;
  if (item.scopeRevision) {
    return `/library/packets/${encodeURIComponent(item.scopeRevision.scopePacketId)}/revisions/${encodeURIComponent(item.scopePacketRevisionId)}`;
  }
  for (const p of availableLibraryPackets) {
    if (p.latestPublishedRevisionId === item.scopePacketRevisionId) {
      return `/library/packets/${encodeURIComponent(p.id)}/revisions/${encodeURIComponent(item.scopePacketRevisionId)}`;
    }
  }
  return null;
}

function LineItemFieldWorkActions({
  item,
  executionPreview,
  availableLibraryPackets,
  fieldWorkAnchorsActive,
  fieldWorkExternalBaseHref,
  localTaskCountHint,
  onSetUpFieldWorkEdit,
}: {
  item: LineItem;
  executionPreview: LineItemExecutionPreviewDto | null;
  availableLibraryPackets: LibraryPacketOption[];
  fieldWorkAnchorsActive: boolean;
  fieldWorkExternalBaseHref?: string | null;
  localTaskCountHint?: number | null;
  onSetUpFieldWorkEdit?: () => void;
}) {
  if (item.executionMode !== "MANIFEST") return null;

  const savedHref = buildSavedPacketRevisionHref(item, availableLibraryPackets);
  const kind = executionPreview?.kind;

  if (
    kind === "manifestNoPacket" ||
    kind === "manifestLibraryMissing" ||
    kind === "manifestLocalMissing"
  ) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {fieldWorkAnchorsActive ? (
          <a className={lineItemFieldWorkLinkClass} href={fieldWorkSectionHref(fieldWorkExternalBaseHref)}>
            Set up field work
          </a>
        ) : onSetUpFieldWorkEdit ? (
          <button type="button" onClick={onSetUpFieldWorkEdit} className={lineItemFieldWorkLinkClass}>
            Set up field work
          </button>
        ) : null}
      </div>
    );
  }

  if (kind === "manifestLocal" && executionPreview && item.quoteLocalPacketId && fieldWorkAnchorsActive) {
    const n = executionPreview.tasks.length;
    const label = n > 0 ? "Edit tasks" : "Add tasks";
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <a
          className={lineItemFieldWorkLinkClass}
          href={fieldWorkPacketHref(fieldWorkExternalBaseHref, item.quoteLocalPacketId)}
        >
          {label}
        </a>
      </div>
    );
  }

  if (
    fieldWorkAnchorsActive &&
    item.quoteLocalPacketId &&
    !item.scopePacketRevisionId &&
    executionPreview == null
  ) {
    const n = localTaskCountHint ?? 0;
    const label = n > 0 ? "Edit tasks" : "Add tasks";
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <a
          className={lineItemFieldWorkLinkClass}
          href={fieldWorkPacketHref(fieldWorkExternalBaseHref, item.quoteLocalPacketId)}
        >
          {label}
        </a>
      </div>
    );
  }

  if (kind === "manifestLibrary") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <a className={lineItemFieldWorkLinkClass} href={`#line-item-${item.id}-task-preview`}>
          Review tasks
        </a>
        {savedHref ? (
          <Link
            href={savedHref}
            className={lineItemFieldWorkLinkClass}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open saved packet
          </Link>
        ) : null}
      </div>
    );
  }

  if (item.scopePacketRevisionId && executionPreview == null) {
    return savedHref ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href={savedHref}
          className={lineItemFieldWorkLinkClass}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open saved packet
        </Link>
      </div>
    ) : null;
  }

  return null;
}

function LineItemForm({
  initial,
  proposalGroupOptions,
  pinnableLibraryPackets,
  availableLocalPackets,
  onCreateOneOffWork,
  onForkFromSavedRevision,
  fieldWorkExternalBaseHref,
  existingItem,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormFields;
  proposalGroupOptions: ProposalGroup[];
  pinnableLibraryPackets: LibraryPacketOption[];
  availableLocalPackets: LocalPacketOption[];
  fieldWorkExternalBaseHref?: string | null;
  /**
   * Inline create for a quote-local task packet (same POST as the section
   * below). On success the form pins the new packet to this line.
   */
  onCreateOneOffWork: (
    displayName: string,
  ) => Promise<{ ok: true; packet: LocalPacketOption } | { ok: false; message: string }>;
  /**
   * Fork a published saved revision into quote-local field work; on success
   * the form pins the new packet to this line.
   */
  onForkFromSavedRevision: (
    scopePacketRevisionId: string,
    displayNameOverride: string | undefined,
  ) => Promise<{ ok: true; packet: LocalPacketOption } | { ok: false; message: string }>;
  /** Provided in edit mode so the picker can surface a saved-but-not-latest revision. */
  existingItem?: LineItem;
  busy: boolean;
  submitLabel: string;
  onSubmit: (fields: FormFields) => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<FormFields>(initial);
  const [localPacketHint, setLocalPacketHint] = useState<string | null>(null);
  const groupName = useMemo(
    () => proposalGroupOptions.find((g) => g.id === fields.proposalGroupId)?.name ?? "(none)",
    [fields.proposalGroupId, proposalGroupOptions],
  );

  // Resetting packet state on executionMode toggle keeps the form aligned
  // with the server-side MANIFEST_SCOPE_PIN_XOR invariant. SOLD_SCOPE always
  // pins nothing; flipping back to MANIFEST forces the user to re-pick.
  function setExecutionMode(next: ExecutionMode) {
    if (next === "SOLD_SCOPE") {
      setLocalPacketHint(null);
      setFields({
        ...fields,
        executionMode: next,
        manifestFieldWorkSetup: "none",
        scopePacketRevisionId: "",
        quoteLocalPacketId: "",
      });
      return;
    }
    setLocalPacketHint(null);
    setFields({
      ...fields,
      executionMode: next,
      manifestFieldWorkSetup:
        fields.executionMode === "SOLD_SCOPE" ? "none" : fields.manifestFieldWorkSetup,
    });
  }

  function setManifestFieldWorkSetup(next: ManifestFieldWorkSetup) {
    setLocalPacketHint(null);
    if (next === "useSavedTaskPacket") {
      setFields({
        ...fields,
        manifestFieldWorkSetup: next,
        quoteLocalPacketId: "",
      });
      return;
    }
    if (next === "createNewTasks") {
      setFields({
        ...fields,
        manifestFieldWorkSetup: next,
        scopePacketRevisionId: "",
      });
      return;
    }
    if (next === "startFromSavedAndCustomize") {
      setFields({
        ...fields,
        manifestFieldWorkSetup: next,
        scopePacketRevisionId: "",
        quoteLocalPacketId: "",
      });
      return;
    }
    setFields({ ...fields, manifestFieldWorkSetup: next });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(fields);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="text-zinc-400">
            Title <span className="text-zinc-600 font-normal">(required)</span>
          </span>
          <input
            type="text"
            value={fields.title}
            onChange={(e) => setFields({ ...fields, title: e.target.value })}
            required
            maxLength={500}
            disabled={busy}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
            placeholder="e.g. Install rooftop unit"
          />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="text-zinc-400">
            Description (optional, max {MAX_DESCRIPTION.toLocaleString()})
          </span>
          <textarea
            value={fields.description}
            onChange={(e) => setFields({ ...fields, description: e.target.value })}
            disabled={busy}
            maxLength={MAX_DESCRIPTION}
            rows={3}
            placeholder="Detail to surface on the proposal alongside the title."
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
          />
        </label>
        <label className="block text-xs">
          <span className="text-zinc-400">Quantity (integer)</span>
          <input
            type="number"
            inputMode="numeric"
            step={1}
            min={0}
            value={fields.quantity}
            onChange={(e) => setFields({ ...fields, quantity: e.target.value })}
            required
            disabled={busy}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
          />
        </label>
        <label className="block text-xs">
          <span className="text-zinc-400">Unit price (cents, optional)</span>
          <input
            type="number"
            inputMode="numeric"
            step={1}
            value={fields.unitPriceCents}
            onChange={(e) => setFields({ ...fields, unitPriceCents: e.target.value })}
            disabled={busy}
            placeholder="e.g. 12500"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
          />
        </label>
      </div>

      <FieldWorkQuestion
        executionMode={fields.executionMode}
        busy={busy}
        onChange={setExecutionMode}
      />

      <FieldWorkSetupPicker
        executionMode={fields.executionMode}
        manifestFieldWorkSetup={fields.manifestFieldWorkSetup}
        scopePacketRevisionId={fields.scopePacketRevisionId}
        quoteLocalPacketId={fields.quoteLocalPacketId}
        pinnableLibraryPackets={pinnableLibraryPackets}
        availableLocalPackets={availableLocalPackets}
        existingItem={existingItem}
        busy={busy}
        lineTitle={fields.title}
        onManifestSetupChange={setManifestFieldWorkSetup}
        onLibraryChange={(id) => setFields({ ...fields, scopePacketRevisionId: id })}
        onLocalChange={(id) => setFields({ ...fields, quoteLocalPacketId: id })}
        onCreateOneOffWork={async (displayName) => {
          const result = await onCreateOneOffWork(displayName);
          if (result.ok) {
            setFields({
              ...fields,
              manifestFieldWorkSetup: "createNewTasks",
              scopePacketRevisionId: "",
              quoteLocalPacketId: result.packet.id,
            });
            setLocalPacketHint(
              "Field work created and attached. Save the line, then add tasks below.",
            );
          }
          return result;
        }}
        onForkFromSavedRevision={async (revisionId, displayNameOverride) => {
          const result = await onForkFromSavedRevision(revisionId, displayNameOverride);
          if (result.ok) {
            setFields({
              ...fields,
              manifestFieldWorkSetup: "startFromSavedAndCustomize",
              scopePacketRevisionId: "",
              quoteLocalPacketId: result.packet.id,
            });
            setLocalPacketHint(
              "Field work copied to this quote and attached. Save the line, then add tasks below.",
            );
          }
          return result;
        }}
      />

      {localPacketHint ? (
        <p className="rounded border border-emerald-900/40 bg-emerald-950/15 px-3 py-2 text-[11px] text-emerald-200/95">
          {localPacketHint}{" "}
          <Link
            href={fieldWorkSectionHref(fieldWorkExternalBaseHref)}
            className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
          >
            Add tasks below →
          </Link>
        </p>
      ) : null}

      <label className="flex items-start gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={fields.paymentBeforeWork}
          onChange={(e) =>
            setFields({
              ...fields,
              paymentBeforeWork: e.target.checked,
              paymentGateTitleOverride: e.target.checked ? fields.paymentGateTitleOverride : "",
            })
          }
          disabled={busy}
        />
        <span>
          Require payment before field work starts for tasks from this line (frozen into the send
          package; Epic 47).
        </span>
      </label>
      {fields.paymentBeforeWork ? (
        <label className="block text-xs">
          <span className="text-zinc-400">Gate title override (optional, max 120)</span>
          <input
            type="text"
            value={fields.paymentGateTitleOverride}
            onChange={(e) => setFields({ ...fields, paymentGateTitleOverride: e.target.value })}
            disabled={busy}
            maxLength={120}
            placeholder="e.g. Deposit before mobilization"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
          />
        </label>
      ) : null}
      <p className="text-[10px] text-zinc-500">
        Proposal group: <span className="text-zinc-400">{groupName}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50 transition-colors"
        >
          {busy ? "Working…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Quote vs field-work split. `SOLD_SCOPE` / `MANIFEST` are persisted as-is;
 * packet XOR is enforced separately in {@link FieldWorkSetupPicker}.
 */
function FieldWorkQuestion({
  executionMode,
  busy,
  onChange,
}: {
  executionMode: ExecutionMode;
  busy: boolean;
  onChange: (next: ExecutionMode) => void;
}) {
  return (
    <fieldset className="rounded border border-zinc-800 bg-zinc-950/30 p-3 space-y-2">
      <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Does this line create field work?
      </legend>

      <div className="space-y-2">
        <label
          className={`flex items-start gap-2 rounded border p-2 cursor-pointer transition-colors ${
            executionMode === "SOLD_SCOPE"
              ? "border-zinc-600 bg-zinc-900/60"
              : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
          } ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name="executionMode"
            value="SOLD_SCOPE"
            checked={executionMode === "SOLD_SCOPE"}
            onChange={() => onChange("SOLD_SCOPE")}
            disabled={busy}
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="block text-xs font-medium text-zinc-100">No — Quote only</span>
            <span className="mt-0.5 block text-[11px] text-zinc-500">
              Appears on the proposal but does not create crew work.
            </span>
          </span>
        </label>

        <label
          className={`flex items-start gap-2 rounded border p-2 cursor-pointer transition-colors ${
            executionMode === "MANIFEST"
              ? "border-sky-700/70 bg-sky-950/30"
              : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
          } ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name="executionMode"
            value="MANIFEST"
            checked={executionMode === "MANIFEST"}
            onChange={() => onChange("MANIFEST")}
            disabled={busy}
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="block text-xs font-medium text-zinc-100">Yes — Create field work</span>
            <span className="mt-0.5 block text-[11px] text-zinc-500">
              This line will create crew tasks after approval, using a task packet you set up
              here.
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}

/**
 * MANIFEST-only: three-way setup that still serializes to exactly one of
 * `scopePacketRevisionId` or `quoteLocalPacketId` (server `MANIFEST_SCOPE_PIN_XOR`).
 */
function FieldWorkSetupPicker({
  executionMode,
  manifestFieldWorkSetup,
  scopePacketRevisionId,
  quoteLocalPacketId,
  pinnableLibraryPackets,
  availableLocalPackets,
  existingItem,
  busy,
  lineTitle,
  onManifestSetupChange,
  onLibraryChange,
  onLocalChange,
  onCreateOneOffWork,
  onForkFromSavedRevision,
}: {
  executionMode: ExecutionMode;
  manifestFieldWorkSetup: ManifestFieldWorkSetup;
  scopePacketRevisionId: string;
  quoteLocalPacketId: string;
  pinnableLibraryPackets: LibraryPacketOption[];
  availableLocalPackets: LocalPacketOption[];
  existingItem?: LineItem;
  busy: boolean;
  lineTitle: string;
  onManifestSetupChange: (next: ManifestFieldWorkSetup) => void;
  onLibraryChange: (next: string) => void;
  onLocalChange: (next: string) => void;
  onCreateOneOffWork: (
    displayName: string,
  ) => Promise<{ ok: true; packet: LocalPacketOption } | { ok: false; message: string }>;
  onForkFromSavedRevision: (
    scopePacketRevisionId: string,
    displayNameOverride: string | undefined,
  ) => Promise<{ ok: true; packet: LocalPacketOption } | { ok: false; message: string }>;
}) {
  const [customizeForkRevisionId, setCustomizeForkRevisionId] = useState("");
  const [customizeDisplayName, setCustomizeDisplayName] = useState("");
  const [forkBusy, setForkBusy] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

  useEffect(() => {
    if (manifestFieldWorkSetup !== "startFromSavedAndCustomize") {
      setCustomizeForkRevisionId("");
      setCustomizeDisplayName("");
      setForkError(null);
    }
  }, [manifestFieldWorkSetup]);

  const savedNonLatestLibrary = useMemo(() => {
    if (!existingItem) return null;
    if (!existingItem.scopePacketRevisionId) return null;
    if (!existingItem.scopeRevision) return null;
    const parent = pinnableLibraryPackets.find(
      (p) => p.id === existingItem.scopeRevision!.scopePacketId,
    );
    if (parent && parent.latestPublishedRevisionId === existingItem.scopePacketRevisionId) {
      return null;
    }
    return {
      id: existingItem.scopePacketRevisionId,
      parentDisplayName: parent?.displayName ?? "(unknown packet)",
      parentPacketKey: parent?.packetKey ?? null,
    };
  }, [existingItem, pinnableLibraryPackets]);

  if (executionMode === "SOLD_SCOPE") {
    return (
      <p className="rounded border border-dashed border-zinc-800 bg-zinc-950/40 px-3 py-2 text-[11px] text-zinc-500">
        This line is quote-only. It will appear on the proposal but won&rsquo;t create any crew
        work.
      </p>
    );
  }

  const hasLibrary = pinnableLibraryPackets.length > 0;
  const hasLocal = availableLocalPackets.length > 0;
  const libraryPickDisabled = busy || (!hasLibrary && !savedNonLatestLibrary);
  const customizePickDisabled = busy || (!hasLibrary && !savedNonLatestLibrary);

  async function handleForkClick() {
    setForkError(null);
    const rev = customizeForkRevisionId.trim();
    if (!rev) {
      setForkError("Choose a saved task packet to copy from.");
      return;
    }
    setForkBusy(true);
    try {
      const dn = customizeDisplayName.trim();
      const result = await onForkFromSavedRevision(rev, dn.length > 0 ? dn : undefined);
      if (!result.ok) {
        setForkError(result.message);
        return;
      }
      setCustomizeDisplayName("");
    } finally {
      setForkBusy(false);
    }
  }

  return (
    <fieldset className="rounded border border-zinc-800 bg-zinc-950/30 p-3 space-y-3">
      <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        How should we set up the field work?
      </legend>

      <p className="text-[10px] leading-relaxed text-zinc-500">
        Pick how this line gets its task packet. Saved task packets come from your library; you
        can also build field work on this quote and attach it here.
      </p>

      <div className="space-y-2">
        <label
          className={`flex items-start gap-2 rounded border p-2 cursor-pointer transition-colors ${
            manifestFieldWorkSetup === "useSavedTaskPacket"
              ? "border-sky-700/60 bg-sky-950/25"
              : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
          } ${libraryPickDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name="fieldWorkSetup"
            value="useSavedTaskPacket"
            checked={manifestFieldWorkSetup === "useSavedTaskPacket"}
            onChange={() => onManifestSetupChange("useSavedTaskPacket")}
            disabled={libraryPickDisabled}
            className="mt-0.5"
          />
          <span className="min-w-0 text-xs text-zinc-200">
            <span className="font-medium text-zinc-100">Use a saved task packet</span>
            <span className="mt-0.5 block text-[11px] text-zinc-500">
              Pin a published packet from the library. Edits to tasks happen in the library for
              future quotes; this line keeps the version you pick.
            </span>
          </span>
        </label>

        <label
          className={`flex items-start gap-2 rounded border p-2 cursor-pointer transition-colors ${
            manifestFieldWorkSetup === "createNewTasks"
              ? "border-emerald-800/60 bg-emerald-950/20"
              : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
          } ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name="fieldWorkSetup"
            value="createNewTasks"
            checked={manifestFieldWorkSetup === "createNewTasks"}
            onChange={() => onManifestSetupChange("createNewTasks")}
            disabled={busy}
            className="mt-0.5"
          />
          <span className="min-w-0 text-xs text-zinc-200">
            <span className="font-medium text-zinc-100">Create editable field work for this line</span>
            <span className="mt-0.5 block text-[11px] text-zinc-500">
              This creates editable field work on this quote. After saving the line, add the actual
              tasks below.
            </span>
          </span>
        </label>

        <label
          className={`flex items-start gap-2 rounded border p-2 cursor-pointer transition-colors ${
            manifestFieldWorkSetup === "startFromSavedAndCustomize"
              ? "border-amber-800/50 bg-amber-950/15"
              : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
          } ${customizePickDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name="fieldWorkSetup"
            value="startFromSavedAndCustomize"
            checked={manifestFieldWorkSetup === "startFromSavedAndCustomize"}
            onChange={() => onManifestSetupChange("startFromSavedAndCustomize")}
            disabled={customizePickDisabled}
            className="mt-0.5"
          />
          <span className="min-w-0 text-xs text-zinc-200">
            <span className="font-medium text-zinc-100">Start from a saved task packet and customize</span>
            <span className="mt-0.5 block text-[11px] text-zinc-500">
              Copy a published packet into field work on this quote, then edit tasks below. The
              library packet is not changed.
            </span>
          </span>
        </label>
      </div>

      {manifestFieldWorkSetup === "useSavedTaskPacket" ? (
        <div className="space-y-1">
          <select
            value={scopePacketRevisionId}
            onChange={(e) => onLibraryChange(e.target.value)}
            disabled={busy}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-sky-600 focus:outline-none disabled:opacity-60"
          >
            <option value="">— Choose a saved task packet —</option>
            {savedNonLatestLibrary ? (
              <option value={savedNonLatestLibrary.id}>
                {savedNonLatestLibrary.parentDisplayName}
                {savedNonLatestLibrary.parentPacketKey
                  ? ` (${savedNonLatestLibrary.parentPacketKey})`
                  : ""}{" "}
                · older saved version
              </option>
            ) : null}
            {pinnableLibraryPackets.map((p) => (
              <option key={p.id} value={p.latestPublishedRevisionId ?? ""}>
                {p.displayName} ({p.packetKey}) · v{p.latestPublishedRevisionNumber ?? "?"}
              </option>
            ))}
          </select>
          {!hasLibrary && !savedNonLatestLibrary ? (
            <p className="text-[10px] text-amber-400">
              No saved task packets are available yet. Create one in{" "}
              <Link
                href="/library/packets"
                className="underline underline-offset-2 hover:text-amber-300"
              >
                Library → Packets
              </Link>
              .
            </p>
          ) : (
            <p className="text-[10px] text-zinc-500">
              Pins the published version you select. The line keeps that revision even if the
              packet is republished later.
            </p>
          )}
        </div>
      ) : null}

      {manifestFieldWorkSetup === "createNewTasks" ? (
        <div className="space-y-4">
          <InlineCreateTaskPacketForLine
            busy={busy}
            suggestedDisplayName={lineTitle.trim()}
            onSubmit={onCreateOneOffWork}
            primaryAction
          />
          {hasLocal ? (
            <div className="rounded-md border border-dashed border-zinc-700/70 bg-zinc-950/35 px-3 py-3 space-y-2">
              <p className="text-xs font-medium text-zinc-400">Use existing field work instead</p>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Optional — attach field work you already added on this quote, then save the line.
              </p>
              <select
                value={quoteLocalPacketId}
                onChange={(e) => onLocalChange(e.target.value)}
                disabled={busy}
                className="w-full rounded border border-zinc-700/80 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300 focus:border-zinc-500 focus:outline-none disabled:opacity-60"
              >
                <option value="">Choose existing field work on this quote…</option>
                {availableLocalPackets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName} · {p.itemCount} task{p.itemCount === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-zinc-600">
                Add tasks in Field work on this quote after you save the line.
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 leading-relaxed">
              No other field work on this quote yet. Create above, then save the line and add tasks
              in Field work on this quote below.
            </p>
          )}
        </div>
      ) : null}

      {manifestFieldWorkSetup === "startFromSavedAndCustomize" ? (
        <div className="space-y-2 rounded border border-amber-900/30 bg-amber-950/10 p-2">
          <label className="block text-[10px] text-zinc-400">
            Saved task packet to copy from
            <select
              value={customizeForkRevisionId}
              onChange={(e) => {
                setCustomizeForkRevisionId(e.target.value);
                setForkError(null);
              }}
              disabled={busy || forkBusy}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-600 focus:outline-none disabled:opacity-60"
            >
              <option value="">— Choose a saved task packet —</option>
              {savedNonLatestLibrary ? (
                <option value={savedNonLatestLibrary.id}>
                  {savedNonLatestLibrary.parentDisplayName}
                  {savedNonLatestLibrary.parentPacketKey
                    ? ` (${savedNonLatestLibrary.parentPacketKey})`
                    : ""}{" "}
                  · older saved version
                </option>
              ) : null}
              {pinnableLibraryPackets.map((p) => (
                <option key={p.id} value={p.latestPublishedRevisionId ?? ""}>
                  {p.displayName} ({p.packetKey}) · v{p.latestPublishedRevisionNumber ?? "?"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[10px] text-zinc-400">
            Name on this quote (optional)
            <input
              type="text"
              value={customizeDisplayName}
              onChange={(e) => {
                setCustomizeDisplayName(e.target.value);
                setForkError(null);
              }}
              disabled={busy || forkBusy}
              maxLength={200}
              placeholder="Defaults to the saved packet name"
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-amber-600 focus:outline-none disabled:opacity-60"
            />
          </label>
          {forkError ? (
            <p className="text-[10px] text-amber-400" role="alert">
              {forkError}
            </p>
          ) : (
            <p className="text-[10px] text-zinc-500">
              Copies tasks into field work on this quote. Save the line, then edit tasks in Field
              work on this quote below.
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy || forkBusy || !customizeForkRevisionId.trim()}
              onClick={() => void handleForkClick()}
              className="rounded bg-amber-800/90 px-3 py-1 text-[11px] font-medium text-amber-50 hover:bg-amber-700 disabled:opacity-50"
            >
              {forkBusy ? "Copying…" : "Copy to this quote and attach"}
            </button>
          </div>
        </div>
      ) : null}

      {manifestFieldWorkSetup === "none" ? (
        <p className="text-[10px] text-amber-400">
          Choose one of the field-work options above. Each field-work line must have exactly one
          task packet before it can be saved.
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * Inline create for quote-local field work from the line-item form.
 * Wraps `POST /api/quote-versions/:id/local-packets`.
 * Default name is the line title (one click); optional customize disclosure.
 */
function InlineCreateTaskPacketForLine({
  busy,
  suggestedDisplayName,
  onSubmit,
  primaryAction = false,
}: {
  busy: boolean;
  /** Line item title — used as the default field work display name. */
  suggestedDisplayName: string;
  onSubmit: (
    displayName: string,
  ) => Promise<{ ok: true; packet: LocalPacketOption } | { ok: false; message: string }>;
  /** Stronger button styling when this is the main path (create-new field work branch). */
  primaryAction?: boolean;
}) {
  const [showCustomize, setShowCustomize] = useState(false);
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lineTitle = suggestedDisplayName.trim();
  const canCreate = lineTitle.length > 0 && !busy && !submitting;

  function displayNameForCreate(): string {
    return resolveFieldWorkDisplayNameForQuickCreate({
      lineTitleTrimmed: lineTitle,
      customizeOpen: showCustomize,
      customInputTrimmed: customName.trim(),
    });
  }

  async function handleCreate() {
    setError(null);
    const raw = displayNameForCreate();
    const validated = validateOneOffWorkDisplayNameInput(raw);
    if (!validated.ok) {
      setError(validated.message);
      return;
    }
    setSubmitting(true);
    try {
      const result = await onSubmit(validated.trimmed);
      if (result.ok) {
        setShowCustomize(false);
        setCustomName("");
      } else {
        setError(result.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const createBtnClass = primaryAction
    ? "rounded border border-emerald-700/70 bg-emerald-950/35 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-950/50 hover:border-emerald-600 disabled:opacity-50 transition-colors"
    : "rounded border border-emerald-800/60 bg-emerald-950/20 px-2 py-1 text-[11px] font-medium text-emerald-200 hover:text-emerald-100 hover:border-emerald-700 disabled:opacity-50 transition-colors";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={!canCreate}
        className={createBtnClass}
      >
        {submitting ? "Creating…" : "Create field work for this line"}
      </button>
      {lineTitle.length === 0 ? (
        <p className="text-[10px] text-amber-400/90">Add a line title before creating field work.</p>
      ) : null}
      {error ? <p className="text-[10px] text-amber-400" role="alert">{error}</p> : null}
      {lineTitle.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            setShowCustomize((v) => {
              const next = !v;
              if (next) {
                setCustomName((c) => (c.trim() !== "" ? c : lineTitle));
              }
              setError(null);
              return next;
            });
          }}
          disabled={busy || submitting}
          className="block text-left text-[10px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2 disabled:opacity-50"
        >
          {showCustomize ? "Hide name options" : "Customize name before creating"}
        </button>
      ) : null}
      {showCustomize && lineTitle.length > 0 ? (
        <div className="rounded border border-emerald-900/40 bg-emerald-950/10 p-2 space-y-2">
          <label className="block text-[10px] text-zinc-400">
            Name for this field work on the quote
            <input
              type="text"
              value={customName}
              onChange={(e) => {
                setCustomName(e.target.value);
                if (error) setError(null);
              }}
              disabled={busy || submitting}
              placeholder={lineTitle}
              maxLength={200}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-emerald-600 focus:outline-none disabled:opacity-60"
            />
          </label>
          <p className="text-[10px] text-zinc-500">
            Leave blank to use the line title ({`“${lineTitle}”`}). This creates an empty field work
            group on the quote; save the line, then add tasks in Field work on this quote below.
          </p>
        </div>
      ) : lineTitle.length > 0 ? (
        <p className="text-[10px] text-zinc-500">
          Uses your line title as the field work name. Save the line, then add tasks in Field work on
          this quote below.
        </p>
      ) : null}
    </div>
  );
}

function BannerView({ banner, onDismiss }: { banner: NonNullable<Banner>; onDismiss: () => void }) {
  const isError = banner.kind === "error";
  return (
    <section
      role={isError ? "alert" : "status"}
      className={`rounded-lg border p-3 text-xs flex items-start justify-between gap-3 ${
        isError
          ? "border-red-900/60 bg-red-950/30 text-red-200"
          : "border-emerald-900/60 bg-emerald-950/20 text-emerald-200"
      }`}
    >
      <div>
        <p className="font-semibold">{banner.title}</p>
        {banner.message ? (
          <div className="mt-0.5 opacity-90 text-[11px] leading-snug">{banner.message}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-[11px] opacity-70 hover:opacity-100"
      >
        ✕
      </button>
    </section>
  );
}

function ReadOnlyView({
  groupedLineItems,
  versionNumber,
  editableReason,
  quoteId,
  availableLibraryPackets,
  executionPreviewByLineItemId,
  fieldWorkAnchorsActive,
  fieldWorkExternalBaseHref,
  singleDefaultMainGroup,
}: {
  groupedLineItems: GroupWithItems[];
  versionNumber: number;
  editableReason: EditableReason;
  quoteId: string;
  availableLibraryPackets: LibraryPacketOption[];
  executionPreviewByLineItemId: Record<string, LineItemExecutionPreviewDto> | null;
  fieldWorkAnchorsActive: boolean;
  fieldWorkExternalBaseHref?: string | null;
  singleDefaultMainGroup: boolean;
}) {
  const reasonMessage =
    editableReason === "missing_capability"
      ? "Your session lacks the office_mutate capability, so the editor is read-only here. Sign in as an office user with elevated permissions to edit scope."
      : "This is not the editable head draft. Open the workspace and use “Create new draft version” to start an editable revision.";
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-xs text-zinc-300">
        <p className="font-semibold text-zinc-100">Read-only view (v{versionNumber})</p>
        <p className="mt-1 text-zinc-400">{reasonMessage}</p>
        <div className="mt-3">
          <Link
            href={`/quotes/${quoteId}`}
            className="inline-block rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            Open workspace →
          </Link>
        </div>
      </section>

      {groupedLineItems.map((group) => (
        <section
          key={group.id}
          className="rounded-lg border border-zinc-800 bg-zinc-900/20 overflow-hidden"
        >
          <header className="border-b border-zinc-800 bg-zinc-900/40 px-4 py-3">
            {singleDefaultMainGroup ? (
              <p className="text-xs text-zinc-500">
                {group.items.length} {group.items.length === 1 ? "line item" : "line items"}
              </p>
            ) : (
              <>
                <h2 className="text-base font-semibold text-zinc-100">{group.name}</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  {group.items.length} {group.items.length === 1 ? "item" : "items"}
                </p>
              </>
            )}
          </header>
          {group.items.length === 0 ? (
            <p className="px-4 py-6 text-xs text-zinc-500 text-center">
              No line items in this group.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {group.items.map((item) => {
                const packetSummary = describeAttachedPacket(item, availableLibraryPackets);
                const preview = executionPreviewByLineItemId?.[item.id] ?? null;
                const statusChip = lineItemFieldWorkStatusChip(item, preview);
                const showPacketSummaryLine = shouldShowPacketSummaryUnderTitle(preview);
                return (
                  <li key={item.id} className="px-4 py-4 space-y-3">
                    <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/30 p-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 gap-y-1">
                          <h3 className="text-base font-semibold text-zinc-50 leading-snug">{item.title}</h3>
                          <FieldWorkStatusChip chip={statusChip} />
                        </div>
                        <LineItemScopeMetadata item={item} />
                        <LineItemFieldWorkActions
                          item={item}
                          executionPreview={preview}
                          availableLibraryPackets={availableLibraryPackets}
                          fieldWorkAnchorsActive={fieldWorkAnchorsActive}
                          fieldWorkExternalBaseHref={fieldWorkExternalBaseHref}
                          localTaskCountHint={null}
                        />
                        {showPacketSummaryLine && packetSummary ? (
                          <p className={`text-xs leading-relaxed ${packetSummary.tone}`}>{packetSummary.label}</p>
                        ) : null}
                      </div>
                    </div>
                    {preview ? (
                      <div id={`line-item-${item.id}-task-preview`}>
                        <LineItemExecutionPreviewBlock preview={preview} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/* ---------------- Pure helpers ---------------- */

type FieldWorkStatusChipKind =
  | { label: "Quote only"; variant: "zinc" }
  | { label: "Field work attached"; variant: "emerald" }
  | { label: "Needs field work"; variant: "amber" }
  | { label: "Field work has no tasks"; variant: "amber" };

function lineItemFieldWorkStatusChip(
  item: LineItem,
  preview: LineItemExecutionPreviewDto | null,
): FieldWorkStatusChipKind {
  if (item.executionMode !== "MANIFEST") {
    return { label: "Quote only", variant: "zinc" };
  }
  if (preview?.kind === "soldScopeCommercial") {
    return { label: "Quote only", variant: "zinc" };
  }
  if (
    preview?.kind === "manifestNoPacket" ||
    preview?.kind === "manifestLibraryMissing" ||
    preview?.kind === "manifestLocalMissing"
  ) {
    return { label: "Needs field work", variant: "amber" };
  }
  if (preview?.kind === "manifestLibrary" || preview?.kind === "manifestLocal") {
    if (preview.tasks.length === 0) {
      return { label: "Field work has no tasks", variant: "amber" };
    }
    return { label: "Field work attached", variant: "emerald" };
  }
  if (item.scopePacketRevisionId || item.quoteLocalPacketId) {
    return { label: "Field work attached", variant: "emerald" };
  }
  return { label: "Needs field work", variant: "amber" };
}

function FieldWorkStatusChip({ chip }: { chip: FieldWorkStatusChipKind }) {
  const cls =
    chip.variant === "emerald"
      ? "border-emerald-800/60 bg-emerald-950/35 text-emerald-200"
      : chip.variant === "amber"
        ? "border-amber-800/50 bg-amber-950/30 text-amber-100"
        : "border-zinc-700 bg-zinc-900/60 text-zinc-300";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-tight ${cls}`}
    >
      {chip.label}
    </span>
  );
}

function LineItemScopeMetadata({ item }: { item: LineItem }) {
  const modeLabel =
    item.executionMode === "MANIFEST" ? "Creates field work" : "Quote only";
  const parts: string[] = [`Qty ${item.quantity}`, modeLabel];
  if (item.tierCode) parts.push(`Tier ${item.tierCode}`);
  if (item.paymentBeforeWork) {
    parts.push(
      item.paymentGateTitleOverride?.trim()
        ? `Payment gate: ${item.paymentGateTitleOverride.trim()}`
        : "Payment before work",
    );
  }
  return <p className="text-xs text-zinc-500 leading-relaxed">{parts.join(" · ")}</p>;
}

/** When the execution preview already carries packet identity, skip the duplicate summary line. */
function shouldShowPacketSummaryUnderTitle(preview: LineItemExecutionPreviewDto | null): boolean {
  if (preview == null) return true;
  if (preview.kind === "soldScopeCommercial") return false;
  if (preview.kind === "manifestNoPacket") return false;
  if (preview.kind === "manifestLibraryMissing" || preview.kind === "manifestLocalMissing") return false;
  if (preview.kind === "manifestLibrary" || preview.kind === "manifestLocal") return false;
  return true;
}

/**
 * Resolves a one-line packet attachment summary for a line item, suitable for
 * inline display on `LineItemRow` / `ReadOnlyView`. Returns null when there is
 * nothing meaningful to display (SOLD_SCOPE with no pin — the expected state).
 *
 * For MANIFEST lines that have no pin (an invariant violation that
 * pre-Triangle-Mode data may carry), we return an amber-toned warning so the
 * inconsistency is visible until the operator re-saves the row.
 */
function describeAttachedPacket(
  item: LineItem,
  availableLibraryPackets: LibraryPacketOption[],
): { label: string; tone: string } | null {
  if (item.scopePacketRevisionId && item.scopeRevision) {
    const parent = availableLibraryPackets.find(
      (p) => p.id === item.scopeRevision!.scopePacketId,
    );
    const isLatest =
      parent != null && parent.latestPublishedRevisionId === item.scopePacketRevisionId;
    const namePart = parent ? parent.displayName : "Saved task packet";
    return {
      label: isLatest
        ? `Saved task packet · ${namePart}`
        : `Saved task packet · ${namePart} (older published version)`,
      tone: isLatest ? "text-sky-300" : "text-amber-400",
    };
  }
  if (item.quoteLocalPacketId && item.quoteLocalPacket) {
    return {
      label: `Field work on this quote · ${item.quoteLocalPacket.displayName}`,
      tone: "text-emerald-300",
    };
  }
  if (item.executionMode === "MANIFEST") {
    return {
      label:
        "No field work attached yet — pick saved field work or create field work on this quote, then save.",
      tone: "text-amber-400",
    };
  }
  return null;
}

