/**
 * Derives a unique QuoteLocalPacketItem.lineKey from a human task name.
 * Rules mirror {@link assertLineKey} in quote-local-packet-input.ts (pattern + max length).
 */

export const QUOTE_LOCAL_PACKET_ITEM_MAX_LINE_KEY = 80;

function isSlugChar(ch: string): boolean {
  return /^[a-z0-9_.:-]$/.test(ch);
}

function baseSlugFromTaskName(taskName: string): string {
  const raw = taskName.trim().toLowerCase();
  if (raw.length === 0) return "";
  const withHyphens = raw.replace(/\s+/g, "-");
  const chars: string[] = [];
  let prevHyphen = false;
  for (const ch of withHyphens) {
    if (isSlugChar(ch)) {
      chars.push(ch);
      prevHyphen = false;
    } else if (!prevHyphen && chars.length > 0) {
      chars.push("-");
      prevHyphen = true;
    }
  }
  let s = chars.join("").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (s.startsWith(".") || s.startsWith(":")) {
    s = s.replace(/^[.:]+/, "");
  }
  return s;
}

function truncateStem(stem: string, maxLen: number): string {
  if (stem.length <= maxLen) return stem;
  let out = stem.slice(0, maxLen).replace(/-+$/, "");
  if (out.length === 0) out = stem.slice(0, maxLen);
  return out;
}

function allocateUniqueKey(baseSlug: string, existing: ReadonlySet<string>): string {
  const maxLen = QUOTE_LOCAL_PACKET_ITEM_MAX_LINE_KEY;
  let stem = baseSlug.length > 0 ? baseSlug : "task";
  stem = truncateStem(stem, maxLen);

  const tryCandidate = (suffix: string): string => {
    const suffixLen = suffix.length;
    const room = Math.max(1, maxLen - suffixLen);
    let t = truncateStem(stem, room);
    if (t.length === 0) t = "t";
    return `${t}${suffix}`;
  };

  let candidate = tryCandidate("");
  if (!existing.has(candidate)) return candidate;

  for (let n = 2; n < 10_000; n++) {
    const suffix = `-${n}`;
    candidate = tryCandidate(suffix);
    if (!existing.has(candidate)) return candidate;
  }

  const fallback = `task-${Date.now()}`;
  return truncateStem(fallback, maxLen);
}

/**
 * @param taskName Human-readable task name (e.g. from "Task name" field).
 * @param existingLineKeys Keys already used on this packet (case-sensitive uniqueness per server).
 */
export function lineKeyFromTaskName(
  taskName: string,
  existingLineKeys: Iterable<string>,
): string {
  const existing = new Set(
    Array.from(existingLineKeys, (k) => k.trim()).filter((k) => k.length > 0),
  );
  const base = baseSlugFromTaskName(taskName);
  return allocateUniqueKey(base, existing);
}
