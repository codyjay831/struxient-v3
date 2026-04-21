import { MockCommsProvider } from "./mock-comms-provider";
import type { CommsProvider } from "./comms-provider";

let instance: CommsProvider | null = null;

/**
 * Returns the configured comms provider.
 * For this pass, we only support a Mock provider.
 */
export function getCommsProvider(): CommsProvider {
  if (instance) return instance;

  // In the future, we would check env vars here to choose Postmark, Twilio, etc.
  instance = new MockCommsProvider();
  
  return instance;
}
