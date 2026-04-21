export type CommsSendResult = 
  | { ok: true; externalId: string; response?: any }
  | { ok: false; error: string; response?: any };

export interface CommsProvider {
  sendEmail(params: {
    to: string;
    subject: string;
    body: string;
    html?: string;
  }): Promise<CommsSendResult>;

  sendSms(params: {
    to: string;
    message: string;
  }): Promise<CommsSendResult>;
}
