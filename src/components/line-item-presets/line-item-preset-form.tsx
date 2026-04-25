"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ScopePacketSummaryDto } from "@/server/slice1/reads/scope-packet-catalog-reads";
import type { LineItemPresetDetailDto } from "@/server/slice1/reads/line-item-preset-reads";
import { formatExecutionModeLabel } from "@/lib/quote-line-item-execution-mode-label";

/**
 * Shared admin form for creating and editing a `LineItemPreset` (Phase 2 /
 * Slice 3). Used by `/library/line-item-presets/new` and
 * `/library/line-item-presets/[id]`.
 *
 * Wire contract:
 *   - On `mode="create"` POSTs `/api/line-item-presets`. On 201 redirects to
 *     `/library/line-item-presets/{id}` and refreshes server data.
 *   - On `mode="edit"` PATCHes `/api/line-item-presets/{id}`. On 200 stays on
 *     the detail page and refreshes server data.
 *   - Server-side per-field invariants surface their `error.message`
 *     verbatim — the messages are user-readable by design.
 *
 * The MANIFEST/SOLD_SCOPE invariant is mirrored client-side (packet dropdown
 * is hidden + cleared in SOLD_SCOPE; required + advisory shown in MANIFEST)
 * but the server is the source of truth.
 */

type Mode = "create" | "edit";

type FormFields = {
  displayName: string;
  presetKey: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultExecutionMode: "MANIFEST" | "SOLD_SCOPE";
  defaultScopePacketId: string;
  defaultQuantity: string;
  defaultUnitPriceCents: string;
  defaultPaymentBeforeWork: boolean;
  defaultPaymentGateTitleOverride: string;
};

export type LineItemPresetFormProps =
  | {
      mode: "create";
      availablePackets: ReadonlyArray<ScopePacketSummaryDto>;
    }
  | {
      mode: "edit";
      preset: LineItemPresetDetailDto;
      availablePackets: ReadonlyArray<ScopePacketSummaryDto>;
    };

const MAX_DISPLAY_NAME = 200;
const MAX_PRESET_KEY = 80;
const MAX_DEFAULT_TITLE = 500;
const MAX_DEFAULT_DESCRIPTION = 4000;
const MAX_GATE_TITLE_OVERRIDE = 120;

function blankFields(): FormFields {
  return {
    displayName: "",
    presetKey: "",
    defaultTitle: "",
    defaultDescription: "",
    defaultExecutionMode: "MANIFEST",
    defaultScopePacketId: "",
    defaultQuantity: "",
    defaultUnitPriceCents: "",
    defaultPaymentBeforeWork: false,
    defaultPaymentGateTitleOverride: "",
  };
}

function fieldsFromPreset(preset: LineItemPresetDetailDto): FormFields {
  return {
    displayName: preset.displayName,
    presetKey: preset.presetKey ?? "",
    defaultTitle: preset.defaultTitle ?? "",
    defaultDescription: preset.defaultDescription ?? "",
    defaultExecutionMode: preset.defaultExecutionMode,
    defaultScopePacketId: preset.defaultScopePacketId ?? "",
    defaultQuantity: preset.defaultQuantity == null ? "" : String(preset.defaultQuantity),
    defaultUnitPriceCents:
      preset.defaultUnitPriceCents == null ? "" : String(preset.defaultUnitPriceCents),
    defaultPaymentBeforeWork: preset.defaultPaymentBeforeWork ?? false,
    defaultPaymentGateTitleOverride: preset.defaultPaymentGateTitleOverride ?? "",
  };
}

/**
 * Builds the JSON body for create/update. Mirrors the server's normalize-
 * before-validate posture: empty/whitespace strings collapse to `null` for
 * nullable columns; numeric strings parse to `Number`; the packet field is
 * forced to `null` whenever mode is SOLD_SCOPE so the server invariant cannot
 * trip on a stale packetId left in state.
 */
function buildPayload(fields: FormFields): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    displayName: fields.displayName.trim(),
    presetKey: fields.presetKey.trim() ? fields.presetKey.trim() : null,
    defaultTitle: fields.defaultTitle.trim() ? fields.defaultTitle.trim() : null,
    defaultDescription: fields.defaultDescription.trim() ? fields.defaultDescription : null,
    defaultExecutionMode: fields.defaultExecutionMode,
    defaultScopePacketId:
      fields.defaultExecutionMode === "MANIFEST"
        ? fields.defaultScopePacketId || null
        : null,
    defaultQuantity: fields.defaultQuantity.trim()
      ? Number.parseInt(fields.defaultQuantity, 10)
      : null,
    defaultUnitPriceCents: fields.defaultUnitPriceCents.trim()
      ? Number.parseInt(fields.defaultUnitPriceCents, 10)
      : null,
    defaultPaymentBeforeWork: fields.defaultPaymentBeforeWork,
    defaultPaymentGateTitleOverride: fields.defaultPaymentGateTitleOverride.trim()
      ? fields.defaultPaymentGateTitleOverride.trim()
      : null,
  };
  return payload;
}

export function LineItemPresetForm(props: LineItemPresetFormProps) {
  const router = useRouter();
  const initial = props.mode === "edit" ? fieldsFromPreset(props.preset) : blankFields();
  const [fields, setFields] = useState<FormFields>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const isEdit = props.mode === "edit";
  const presetId = props.mode === "edit" ? props.preset.id : null;

  const packetOptions = useMemo(() => {
    return [...props.availablePackets].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
    );
  }, [props.availablePackets]);

  const selectedPacket = useMemo(() => {
    if (fields.defaultExecutionMode !== "MANIFEST") return null;
    if (!fields.defaultScopePacketId) return null;
    return packetOptions.find((p) => p.id === fields.defaultScopePacketId) ?? null;
  }, [packetOptions, fields.defaultExecutionMode, fields.defaultScopePacketId]);

  // Client-side guard mirrors the server invariants. Helps users avoid an
  // obviously-bad submit; server is still the source of truth.
  const submitBlocked =
    busy ||
    fields.displayName.trim().length === 0 ||
    (fields.defaultExecutionMode === "MANIFEST" && !fields.defaultScopePacketId);

  function patch(next: Partial<FormFields>) {
    setFields((prev) => {
      const merged: FormFields = { ...prev, ...next };
      // When mode flips to SOLD_SCOPE, clear the packet so the server invariant
      // and the post-flip submit never see a stale id.
      if (next.defaultExecutionMode === "SOLD_SCOPE") {
        merged.defaultScopePacketId = "";
      }
      return merged;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const payload = buildPayload(fields);
      const url = isEdit ? `/api/line-item-presets/${encodeURIComponent(presetId!)}` : `/api/line-item-presets`;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: { message?: string; code?: string };
        data?: { id?: string };
      };
      if (!res.ok) {
        setMsg({ kind: "err", text: j.error?.message ?? `HTTP ${res.status}` });
        return;
      }
      const newId = j.data?.id;
      if (isEdit) {
        setMsg({ kind: "ok", text: "Saved." });
        router.refresh();
      } else if (newId) {
        router.replace(`/library/line-item-presets/${encodeURIComponent(newId)}`);
        router.refresh();
      } else {
        router.replace(`/library/line-item-presets`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(ev) => void onSubmit(ev)}
      className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/20 p-6"
    >
      {/* ─────── Identity ─────── */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Identity
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="font-medium text-zinc-400">Display name</span>
            <input
              type="text"
              required
              maxLength={MAX_DISPLAY_NAME}
              value={fields.displayName}
              onChange={(e) => patch({ displayName: e.target.value })}
              disabled={busy}
              placeholder="e.g. Level 2 EV charger install"
              className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
            />
            <span className="mt-1 block text-[11px] text-zinc-500">
              Shown wherever this saved line item appears (Quick Add, admin list).
            </span>
          </label>
          <label className="block text-xs">
            <span className="font-medium text-zinc-400">
              Preset key <span className="text-zinc-600">(optional)</span>
            </span>
            <input
              type="text"
              maxLength={MAX_PRESET_KEY}
              value={fields.presetKey}
              onChange={(e) => patch({ presetKey: e.target.value })}
              disabled={busy}
              placeholder="e.g. ev-charger-install"
              className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-mono disabled:opacity-50"
            />
            <span className="mt-1 block text-[11px] text-zinc-500 leading-relaxed">
              Stable handle for scripting. Lowercase letters, digits, hyphens, underscores. Unique per
              tenant.
            </span>
          </label>
        </div>
      </fieldset>

      {/* ─────── Commercial defaults ─────── */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Commercial defaults
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="font-medium text-zinc-400">Default title</span>
            <input
              type="text"
              maxLength={MAX_DEFAULT_TITLE}
              value={fields.defaultTitle}
              onChange={(e) => patch({ defaultTitle: e.target.value })}
              disabled={busy}
              placeholder="Defaults to display name when blank"
              className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
            />
            <span className="mt-1 block text-[11px] text-zinc-500">
              Prefilled into the line item title (only if empty when picked).
            </span>
          </label>
          <label className="block text-xs sm:col-span-2">
            <span className="font-medium text-zinc-400">
              Default description <span className="text-zinc-600">(optional, max {MAX_DEFAULT_DESCRIPTION.toLocaleString()})</span>
            </span>
            <textarea
              rows={3}
              maxLength={MAX_DEFAULT_DESCRIPTION}
              value={fields.defaultDescription}
              onChange={(e) => patch({ defaultDescription: e.target.value })}
              disabled={busy}
              placeholder="Detail to surface on the proposal alongside the title."
              className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
            />
          </label>
          <label className="block text-xs">
            <span className="font-medium text-zinc-400">Default quantity</span>
            <input
              type="number"
              min={1}
              step={1}
              value={fields.defaultQuantity}
              onChange={(e) => patch({ defaultQuantity: e.target.value })}
              disabled={busy}
              placeholder="1"
              className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
            />
          </label>
          <label className="block text-xs">
            <span className="font-medium text-zinc-400">Default unit price (cents)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={fields.defaultUnitPriceCents}
              onChange={(e) => patch({ defaultUnitPriceCents: e.target.value })}
              disabled={busy}
              placeholder="125000  (= $1,250.00)"
              className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
            />
            <span className="mt-1 block text-[11px] text-zinc-500">
              Stored in cents to avoid floating-point drift. 125000 = $1,250.00.
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={fields.defaultPaymentBeforeWork}
              onChange={(e) => patch({ defaultPaymentBeforeWork: e.target.checked })}
              disabled={busy}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-sky-500 focus:ring-sky-600 disabled:opacity-50"
            />
            <span className="font-medium text-zinc-300">Payment before work</span>
          </label>
          {fields.defaultPaymentBeforeWork ? (
            <label className="block text-xs">
              <span className="font-medium text-zinc-400">
                Payment gate title override <span className="text-zinc-600">(optional)</span>
              </span>
              <input
                type="text"
                maxLength={MAX_GATE_TITLE_OVERRIDE}
                value={fields.defaultPaymentGateTitleOverride}
                onChange={(e) => patch({ defaultPaymentGateTitleOverride: e.target.value })}
                disabled={busy}
                placeholder="e.g. Material deposit"
                className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
              />
            </label>
          ) : null}
        </div>
      </fieldset>

      {/* ─────── Execution mode ─────── */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Execution mode
        </legend>
        <div className="space-y-2">
          <label className="flex items-start gap-3 rounded border border-zinc-800 bg-zinc-950/40 p-3 text-xs hover:border-zinc-700">
            <input
              type="radio"
              name="defaultExecutionMode"
              value="MANIFEST"
              checked={fields.defaultExecutionMode === "MANIFEST"}
              onChange={() => patch({ defaultExecutionMode: "MANIFEST" })}
              disabled={busy}
              className="mt-0.5 h-4 w-4 border-zinc-700 bg-zinc-950 text-sky-500 focus:ring-sky-600"
            />
            <span>
              <span className="block font-medium text-zinc-200">
                {formatExecutionModeLabel("MANIFEST")}
              </span>
              <span className="block text-[11px] text-zinc-500 mt-0.5">
                Uses a saved work template to create crew tasks after the quote is approved.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded border border-zinc-800 bg-zinc-950/40 p-3 text-xs hover:border-zinc-700">
            <input
              type="radio"
              name="defaultExecutionMode"
              value="SOLD_SCOPE"
              checked={fields.defaultExecutionMode === "SOLD_SCOPE"}
              onChange={() => patch({ defaultExecutionMode: "SOLD_SCOPE" })}
              disabled={busy}
              className="mt-0.5 h-4 w-4 border-zinc-700 bg-zinc-950 text-sky-500 focus:ring-sky-600"
            />
            <span>
              <span className="block font-medium text-zinc-200">
                {formatExecutionModeLabel("SOLD_SCOPE")}
              </span>
              <span className="block text-[11px] text-zinc-500 mt-0.5">
                Appears on the quote but doesn&rsquo;t create any crew work.
              </span>
            </span>
          </label>
        </div>

        {fields.defaultExecutionMode === "MANIFEST" ? (
          <div>
            <label className="block text-xs">
              <span className="font-medium text-zinc-400">Saved work template</span>
              <select
                required
                value={fields.defaultScopePacketId}
                onChange={(e) => patch({ defaultScopePacketId: e.target.value })}
                disabled={busy || packetOptions.length === 0}
                className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
              >
                <option value="">— Pick a saved work template —</option>
                {packetOptions.map((p) => {
                  const ver =
                    p.latestPublishedRevisionNumber == null
                      ? "no published version"
                      : `v${p.latestPublishedRevisionNumber}`;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.displayName} ({p.packetKey}) · {ver}
                    </option>
                  );
                })}
              </select>
            </label>
            {packetOptions.length === 0 ? (
              <p className="mt-2 text-[11px] text-rose-400/90">
                No saved work templates are available yet. Create one first under
                <Link href="/library/packets/new" className="ml-1 underline hover:text-rose-300">
                  Library &rarr; Packets
                </Link>
                .
              </p>
            ) : selectedPacket && selectedPacket.latestPublishedRevisionId == null ? (
              <p className="mt-2 rounded border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-300">
                Saved line can be saved, but it can&rsquo;t be used until the work template has a
                published version.
              </p>
            ) : selectedPacket ? (
              <p className="mt-2 text-[11px] text-emerald-400/90">
                Latest version: v{selectedPacket.latestPublishedRevisionNumber}.
              </p>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      {/* ─────── Submit ─────── */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitBlocked}
          className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saving…" : isEdit ? "Save changes" : "Create saved line item"}
        </button>
        <Link
          href={
            isEdit && presetId
              ? `/library/line-item-presets/${encodeURIComponent(presetId)}`
              : "/library/line-item-presets"
          }
          className="text-xs text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </Link>
      </div>

      {msg ? (
        <p
          className={`text-sm ${msg.kind === "ok" ? "text-emerald-400/90" : "text-rose-400/90"}`}
          role="status"
        >
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}
