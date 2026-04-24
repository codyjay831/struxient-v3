"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLibraryPacketComposeHintWorkflowVersionId } from "@/components/catalog-packets/library-packet-compose-hint-workflow-provider";
import { TargetNodePicker } from "@/components/quote-scope/target-node-picker";

function readStringFromJson(json: unknown, key: string): string {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return "";
  const v = (json as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

type Props = {
  scopePacketId: string;
  scopePacketRevisionId: string;
  packetTaskLineId: string;
  lineKind: "EMBEDDED" | "LIBRARY";
  initialTargetNodeKey: string;
  initialTierCode: string | null;
  /** EMBEDDED authoring only; ignored for LIBRARY. */
  embeddedPayloadJson?: unknown;
};

export function EditPacketTaskLineForm({
  scopePacketId,
  scopePacketRevisionId,
  packetTaskLineId,
  lineKind,
  initialTargetNodeKey,
  initialTierCode,
  embeddedPayloadJson,
}: Props) {
  const router = useRouter();
  const hintWorkflowVersionId = useLibraryPacketComposeHintWorkflowVersionId();
  const [open, setOpen] = useState(false);
  const [targetNodeKey, setTargetNodeKey] = useState(initialTargetNodeKey);
  const [tierCode, setTierCode] = useState(initialTierCode ?? "");
  const [title, setTitle] = useState(() =>
    lineKind === "EMBEDDED" ? readStringFromJson(embeddedPayloadJson, "title") : "",
  );
  const [taskKind, setTaskKind] = useState(() =>
    lineKind === "EMBEDDED" ? readStringFromJson(embeddedPayloadJson, "taskKind") : "",
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        targetNodeKey: targetNodeKey.trim(),
        tierCode: tierCode.trim(),
      };
      if (lineKind === "EMBEDDED") {
        body.title = title.trim();
        body.taskKind = taskKind.trim();
      }

      const res = await fetch(
        `/api/scope-packets/${encodeURIComponent(scopePacketId)}/revisions/${encodeURIComponent(scopePacketRevisionId)}/task-lines/${encodeURIComponent(packetTaskLineId)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setMsg({ kind: "err", text: j.error?.message ?? `HTTP ${res.status}` });
        return;
      }
      const nextTarget = targetNodeKey.trim();
      const nextTier = tierCode.trim();
      setTargetNodeKey(nextTarget);
      setTierCode(nextTier);
      if (lineKind === "EMBEDDED") {
        setTitle(title.trim());
        setTaskKind(taskKind.trim());
      }
      setMsg({ kind: "ok", text: "Saved." });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-zinc-800/80 pt-3">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setMsg(null);
        }}
        className="text-[11px] font-medium text-sky-400/95 hover:text-sky-300"
      >
        {open ? "Cancel edit" : "Edit fields"}
      </button>
      {open ? (
        <form onSubmit={(ev) => void onSubmit(ev)} className="mt-2 space-y-2 rounded border border-zinc-800 bg-zinc-950/50 p-3">
          <div>
            <span className="block text-[10px] font-medium text-zinc-500">targetNodeKey</span>
            <div className="mt-0.5">
              <TargetNodePicker
                workflowVersionIdForNodeKeys={hintWorkflowVersionId}
                value={targetNodeKey}
                disabled={busy}
                onChange={setTargetNodeKey}
                copyVariant="catalogLibraryHint"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-zinc-500">tierCode (optional, empty clears)</label>
            <input
              value={tierCode}
              onChange={(e) => setTierCode(e.target.value)}
              disabled={busy}
              className="mt-0.5 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
            />
          </div>
          {lineKind === "EMBEDDED" ? (
            <>
              <div>
                <label className="block text-[10px] font-medium text-zinc-500">Title (embedded)</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={busy}
                  className="mt-0.5 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-zinc-500">taskKind (optional, empty clears)</label>
                <input
                  value={taskKind}
                  onChange={(e) => setTaskKind(e.target.value)}
                  disabled={busy}
                  className="mt-0.5 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
                />
              </div>
            </>
          ) : null}
          <button
            type="submit"
            disabled={busy || !targetNodeKey.trim() || (lineKind === "EMBEDDED" && !title.trim())}
            className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          {msg ? (
            <p className={`text-[11px] ${msg.kind === "ok" ? "text-emerald-400/90" : "text-rose-400/90"}`}>{msg.text}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
