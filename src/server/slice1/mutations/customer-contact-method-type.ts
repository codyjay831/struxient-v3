import type { CustomerContactMethodType } from "@prisma/client";
import { InvariantViolationError } from "../errors";

export function parseCustomerContactMethodType(raw: unknown): CustomerContactMethodType {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new InvariantViolationError(
      "CUSTOMER_CONTACT_METHOD_VALUE_INVALID",
      "Method type must be a non-empty string.",
      {},
    );
  }
  const v = raw.trim() as CustomerContactMethodType;
  const allowed: CustomerContactMethodType[] = ["EMAIL", "PHONE", "MOBILE", "OTHER"];
  if (!allowed.includes(v)) {
    throw new InvariantViolationError(
      "CUSTOMER_CONTACT_METHOD_VALUE_INVALID",
      "Method type must be one of EMAIL, PHONE, MOBILE, OTHER.",
      { type: raw },
    );
  }
  return v;
}
