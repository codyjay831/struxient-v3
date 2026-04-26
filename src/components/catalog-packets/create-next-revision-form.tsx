"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Smallest safe revision-2 evolution affordance: create the next DRAFT
 * `ScopePacketRevision` as a deep clone of the current PUBLISHED revision.
 *
 * Surfaced inline on the dev catalog packet detail page AND the office
 * library packet detail page; visible only when:
 *   - the packet has a current PUBLISHED revision (`latestPublishedRevisionId != null`)
 *   - the packet has zero DRAFT revisions (`hasDraftRevision === false`)
 *
 * Both conditions are enforced server-side as well (decision pack §3 / §4)
 * with `SCOPE_PACKET_REVISION_CREATE_DRAFT_NO_PUBLISHED_SOURCE` and
 * `SCOPE_PACKET_REVISION_CREATE_DRAFT_PACKET_HAS_DRAFT` respectively. The
 * UI gate is purely a usability hint; the server is the source of truth.
 *
 * On success, the caller is navigated to the new DRAFT's revision detail page
 * so they can edit task lines and publish. The `surfacePath` prop selects
 * which surface (`/dev/catalog-packets` vs `/library/packets`) to land on,
 * matching the surface the form was mounted under.
 *
 * No editor surface. No PacketTaskLine CRUD. No metadata edit.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md ("Canon amendment — revision-2 evolution
 *     policy (post-publish)")
 *   - docs/implementation/decision-packs/revision-2-evolution-decision-pack.md
 */
export function CreateNextRevisionForm({
  scopePacketId,
  latestPublishedRevisionNumber,
  surfacePath = "/dev/catalog-packets",
  draftEditorAvailable = false,
}: {
  scopePacketId: string;
  latestPublishedRevisionNumber: number;
  /**
   * Base path for the post-success redirect (no trailing slash). The form
   * routes to `${surfacePath}/${scopePacketId}/revisions/${newRevisionId}`.
   * Defaults to the dev surface for backward compatibility — office surface
   * passes `/library/packets`.
   */
  surfacePath?: string;
  /**
   * Whether the destination revision page exposes a task-line editor for
   * DRAFT revisions. Controls only user-facing copy — the server is unaware
   * of this hint. The office library revision page mounts the embedded /
   * library task-line forms, so it passes `true`. The dev catalog revision
   * page is inspector-only, so the default `false` keeps that copy honest.
   */
  draftEditorAvailable?: boolean;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/scope-packets/${encodeURIComponent(scopePacketId)}/revisions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        let code = `HTTP_${res.status}`;
        let message = `Create-DRAFT failed (HTTP ${res.status}).`;
        try {
          const j = (await res.json()) as { error?: { code?: string; message?: string } };
          if (j.error?.code) code = j.error.code;
          if (j.error?.message) message = j.error.message;
        } catch {
          // body wasn't JSON; fall through with the HTTP status only.
        }
        setError(`${code}: ${message}`);
        setBusy(false);
        return;
      }
      const j = (await res.json()) as {
        data?: {
          createDraftFromPublished?: { newRevision?: { id: string } };
        };
      };
      const newRevisionId = j.data?.createDraftFromPublished?.newRevision?.id;
      if (newRevisionId) {
        router.push(
          `${surfacePath}/${encodeURIComponent(scopePacketId)}/revisions/${encodeURIComponent(newRevisionId)}`,
        );
        // router.push doesn't refresh the list automatically on the same path;
        // refresh keeps the previous packet detail in sync if the user
        // navigates back. Cheap, idempotent.
        router.refresh();
        return;
      }
      // Defensive: if the body didn't include the new revision id, fall back
      // to refreshing the current page so the operator can see the new row.
      router.refresh();
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create-DRAFT failed (network error).");
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-amber-800/60 bg-amber-950/20 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300">
        Create next DRAFT revision
      </h2>
      <p className="mt-2 text-[11px] leading-relaxed text-amber-200/80">
        Deep-clones every <code className="text-amber-100">PacketTaskLine</code> on
        the current PUBLISHED revision (r{latestPublishedRevisionNumber}) into a
        new <code className="text-amber-100">DRAFT</code> revision on the same
        packet. The PUBLISHED revision is not touched.{" "}
        {draftEditorAvailable
          ? "You will land on the new DRAFT's revision page where you can add, edit, reorder, and delete task lines before publishing."
          : "Catalog-side editing of the new DRAFT is not available on this surface; the dev inspector only supports create-DRAFT and publish-with-supersede."}{" "}
        Publishing the new DRAFT will demote r{latestPublishedRevisionNumber} to{" "}
        <code className="text-amber-100">SUPERSEDED</code> automatically.
      </p>
      <label className="mt-2 flex items-start gap-2 text-[11px] text-amber-200/90">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={busy}
          className="mt-0.5"
        />
        <span>
          I understand that at most one DRAFT revision per packet is allowed
          {draftEditorAvailable
            ? " and that publishing it will supersede the current published revision."
            : " and the new DRAFT cannot yet be edited from this inspector."}
          .
        </span>
      </label>
      {error ? (
        <p className="mt-2 rounded border border-red-900/60 bg-red-950/30 px-2 py-1 text-[11px] text-red-300">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleCreate}
          disabled={!confirmed || busy}
          className="rounded border border-amber-700/60 bg-amber-900/40 px-3 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-900/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create next DRAFT revision"}
        </button>
      </div>
    </section>
  );
}
