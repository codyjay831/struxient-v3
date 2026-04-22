import type { AuditEventType } from "@prisma/client";

const TITLES: Partial<Record<AuditEventType, string>> = {
  CUSTOMER_NOTE_CREATED: "Customer note added",
  CUSTOMER_NOTE_UPDATED: "Customer note updated",
  CUSTOMER_NOTE_ARCHIVED: "Customer note archived",
  CUSTOMER_CONTACT_CREATED: "Contact person added",
  CUSTOMER_CONTACT_UPDATED: "Contact person updated",
  CUSTOMER_CONTACT_ARCHIVED: "Contact person archived",
  CUSTOMER_CONTACT_METHOD_CHANGED: "Contact method changed",
  CUSTOMER_DOCUMENT_UPLOADED: "Customer file uploaded",
  CUSTOMER_DOCUMENT_ARCHIVED: "Customer file archived",
  TENANT_OPERATIONAL_SETTINGS_UPDATED: "Tenant operational settings updated",
  TENANT_MEMBER_ROLE_UPDATED: "Team member role updated",
};

export function titleForCustomerAuditEventType(eventType: AuditEventType): string {
  return TITLES[eventType] ?? String(eventType).replace(/_/g, " ");
}

type Payload = Record<string, unknown> | null;

export function summaryForCustomerAuditPayload(eventType: AuditEventType, payload: Payload): string {
  if (!payload || typeof payload !== "object") return "—";
  switch (eventType) {
    case "CUSTOMER_NOTE_CREATED":
    case "CUSTOMER_NOTE_ARCHIVED":
      return typeof payload.noteId === "string" ? `Note ${payload.noteId.slice(0, 8)}…` : "Note activity";
    case "CUSTOMER_NOTE_UPDATED":
      if (payload.unarchived === true) return "Note restored from archive";
      return typeof payload.noteId === "string" ? `Note ${payload.noteId.slice(0, 8)}…` : "Note updated";
    case "CUSTOMER_CONTACT_CREATED":
    case "CUSTOMER_CONTACT_ARCHIVED":
      return typeof payload.contactId === "string" ? `Contact ${payload.contactId.slice(0, 8)}…` : "Contact activity";
    case "CUSTOMER_CONTACT_UPDATED":
      if (payload.unarchived === true) return "Contact restored from archive";
      return typeof payload.contactId === "string" ? `Contact ${payload.contactId.slice(0, 8)}…` : "Contact updated";
    case "CUSTOMER_CONTACT_METHOD_CHANGED": {
      const action = typeof payload.action === "string" ? payload.action : "changed";
      const typ = typeof payload.methodType === "string" ? payload.methodType : "method";
      return `${typ} · ${action}`;
    }
    case "CUSTOMER_DOCUMENT_UPLOADED":
      return typeof payload.fileName === "string" ? String(payload.fileName) : "File uploaded";
    case "CUSTOMER_DOCUMENT_ARCHIVED":
      return typeof payload.customerDocumentId === "string" ? `File ${payload.customerDocumentId.slice(0, 8)}…` : "File archived";
    case "TENANT_OPERATIONAL_SETTINGS_UPDATED":
      return "Tenant policy";
    case "TENANT_MEMBER_ROLE_UPDATED": {
      const from = typeof payload.from === "string" ? payload.from : "?";
      const to = typeof payload.to === "string" ? payload.to : "?";
      return `${from.replace(/_/g, " ").toLowerCase()} → ${to.replace(/_/g, " ").toLowerCase()}`;
    }
    default:
      return "—";
  }
}
