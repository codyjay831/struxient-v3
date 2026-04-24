/**
 * Stable dropdown label for optional compose-hint workflow selection on
 * office library packet DRAFT authoring (Epic 15 + 16).
 */
export function formatLibraryPacketComposeHintWorkflowLabel(row: {
  templateDisplayName: string;
  templateKey: string;
  versionNumber: number;
}): string {
  return `${row.templateDisplayName} · v${String(row.versionNumber)} · ${row.templateKey}`;
}
