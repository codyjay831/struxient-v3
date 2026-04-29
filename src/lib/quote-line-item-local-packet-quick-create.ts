/**
 * Pure helpers for the inline "create task packet on this quote" action
 * inside the quote line-item form (Triangle Mode — UX bridge slice).
 *
 * Background: prior to this slice, an estimator who wanted to attach
 * quote-local field work to a line item had to scroll past the line
 * item editor, find the standalone `<QuoteLocalPacketEditor/>`, create a
 * packet there, then come back up and pick it from the dropdown. The
 * inline action lets them stay in the line-item form and trigger the
 * same `POST /api/quote-versions/[quoteVersionId]/local-packets` call
 * without leaving the form.
 *
 * This module is intentionally pure (no React, no Prisma, no fetch) so it
 * can be unit-tested without DOM or network. The scope editor handles the
 * actual fetch and `setState` plumbing.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md  (QuoteLocalPacket lifecycle)
 *   - docs/canon/04-quote-line-item-canon.md  (MANIFEST_SCOPE_PIN_XOR)
 *
 * Server-side discipline that this client helper mirrors:
 *   - `assertDisplayName` in src/lib/quote-local-packet-input.ts
 *     (max 200 chars, trimmed non-empty). The server is still
 *     authoritative; the client mirror is purely a pre-flight check so
 *     estimators see immediate feedback.
 */

/**
 * Mirror of `MAX_DISPLAY_NAME` in src/lib/quote-local-packet-input.ts.
 * Kept in sync by hand — exporting from the server-side parser would
 * drag a Prisma-bound module into the client bundle.
 */
const MAX_ONE_OFF_WORK_DISPLAY_NAME = 200;

export type ValidatedOneOffWorkDisplayName =
  | { ok: true; trimmed: string }
  | { ok: false; message: string };

/**
 * Validate the displayName an estimator typed into the inline
 * Inline create-task-packet form. Returns the trimmed value
 * when valid, otherwise a contractor-friendly error message suitable for
 * surfacing inline next to the input.
 *
 * Rules (must match `assertDisplayName` server-side):
 *   - Must be a non-empty string after trim.
 *   - Must be at most {@link MAX_ONE_OFF_WORK_DISPLAY_NAME} characters
 *     after trim.
 *
 * The function does not normalise case, punctuation, or whitespace
 * beyond `.trim()` — display names are free-form text the estimator
 * will see again on this same screen.
 */
/**
 * Display name for inline quick-create: uses the line title unless the user
 * opened customize and entered a non-empty override.
 */
export function resolveFieldWorkDisplayNameForQuickCreate(params: {
  lineTitleTrimmed: string;
  customizeOpen: boolean;
  customInputTrimmed: string;
}): string {
  if (params.lineTitleTrimmed.length === 0) return "";
  if (!params.customizeOpen) return params.lineTitleTrimmed;
  return params.customInputTrimmed.length > 0
    ? params.customInputTrimmed
    : params.lineTitleTrimmed;
}

export function validateOneOffWorkDisplayNameInput(
  raw: string,
): ValidatedOneOffWorkDisplayName {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      message:
        "Give this custom work on the quote a short name (e.g. 'Roof tear-off for this house').",
    };
  }
  if (trimmed.length > MAX_ONE_OFF_WORK_DISPLAY_NAME) {
    return {
      ok: false,
      message: `Name must be at most ${MAX_ONE_OFF_WORK_DISPLAY_NAME} characters.`,
    };
  }
  return { ok: true, trimmed };
}

/**
 * Minimal shape the picker reads from a quote-local packet — it only
 * needs `id` to be the option `value` and a `displayName` + `itemCount`
 * to render the option label. The full DTO has many more fields and is
 * still what the API returns; the helper accepts any superset.
 */
export type LocalPacketForPicker = {
  id: string;
  displayName: string;
  itemCount: number;
};

/**
 * Combine the canonical server-supplied list of quote-local packets with
 * any locally created (since last `router.refresh()`) packets, dedup-ing
 * by `id`. Server entries always win the dedup tie — they reflect canon
 * (e.g. if the user later renamed the packet via the standalone editor
 * within the same render). The freshly-created entries are appended so
 * a brand-new packet shows up at the bottom of the dropdown without
 * forcing a refresh that would close the in-progress line-item form.
 *
 * Order:
 *   - All entries from `serverList` in their original order (stable).
 *   - Then every entry from `locallyCreated` whose id is not already in
 *     `serverList`, in their original order (stable).
 *
 * This helper is pure: it does not mutate either input.
 */
export function mergeLocalPacketsForPicker<T extends LocalPacketForPicker>(
  serverList: ReadonlyArray<T>,
  locallyCreated: ReadonlyArray<T>,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of serverList) {
    if (!seen.has(p.id)) {
      out.push(p);
      seen.add(p.id);
    }
  }
  for (const p of locallyCreated) {
    if (!seen.has(p.id)) {
      out.push(p);
      seen.add(p.id);
    }
  }
  return out;
}
