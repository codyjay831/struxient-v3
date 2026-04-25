/**
 * Display helpers for raw workflow node ids in the authoring UI.
 *
 * `targetNodeKey` is the stable compose binding (a string node id from a
 * WorkflowVersion snapshot) and is what's persisted on QuoteLocalPacketItem
 * and PacketTaskLine. We never rewrite or normalize the persisted id; we
 * only present a friendlier label alongside the raw id when the snapshot
 * itself does not carry a `displayName` / `label` / `name`.
 *
 * The cleaning is intentionally conservative and idempotent — if an id
 * already looks human-readable (contains whitespace and any uppercase),
 * it is returned as-is so we never collide two visibly distinct ids onto
 * the same label. Callers should always render the raw id alongside the
 * humanized label so technical operators can verify the binding.
 */

const SEPARATORS = /[-_]+/g;
const COLLAPSE_WS = /\s+/g;

/**
 * Convert a kebab/snake/dot/space node id into a sentence-cased label.
 *
 *   "install-rooftop-unit"  -> "Install rooftop unit"
 *   "INSPECT_ATTIC"         -> "Inspect attic"
 *   "node-1"                -> "Node 1"
 *   "Already Cased"         -> "Already Cased"   (idempotent)
 *   "  trim me  "           -> "Trim me"
 *   ""                      -> ""
 */
export function humanizeWorkflowNodeId(id: string): string {
  const trimmed = id.trim();
  if (trimmed === "") return "";
  if (/\s/.test(trimmed) && /[A-Z]/.test(trimmed)) {
    return trimmed;
  }
  const collapsed = trimmed.replace(SEPARATORS, " ").replace(COLLAPSE_WS, " ").trim().toLowerCase();
  if (collapsed === "") return trimmed;
  return collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
}
