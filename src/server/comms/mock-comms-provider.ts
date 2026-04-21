import type { CommsProvider, CommsSendResult } from "./comms-provider";

/**
 * A mock provider that logs to console for local development.
 */
export class MockCommsProvider implements CommsProvider {
  async sendEmail(params: {
    to: string;
    subject: string;
    body: string;
    html?: string;
  }): Promise<CommsSendResult> {
    console.log("--- [MOCK EMAIL SEND] ---");
    console.log(`To: ${params.to}`);
    console.log(`Subject: ${params.subject}`);
    console.log(`Body: ${params.body}`);
    console.log("--------------------------");

    return {
      ok: true,
      externalId: `mock-email-${Math.random().toString(36).substring(7)}`,
      response: { status: "mocked" }
    };
  }

  async sendSms(params: {
    to: string;
    message: string;
  }): Promise<CommsSendResult> {
    console.log("--- [MOCK SMS SEND] ---");
    console.log(`To: ${params.to}`);
    console.log(`Message: ${params.message}`);
    console.log("------------------------");

    return {
      ok: true,
      externalId: `mock-sms-${Math.random().toString(36).substring(7)}`,
      response: { status: "mocked" }
    };
  }
}
