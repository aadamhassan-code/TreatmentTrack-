export interface SendMessageInput {
  to: string;
  body: string;
}

export interface SendMessageResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface MessageProvider {
  /** Whether real credentials are present — drives "not connected yet" UI. */
  isConfigured(): boolean;
  send(input: SendMessageInput): Promise<SendMessageResult>;
}

/**
 * Appends a compliant opt-out instruction if the rendered template didn't
 * already include one. Templates are edited by practice staff in Settings,
 * so this is a last line of defence, not the only one, for "every outbound
 * message must include an opt-out."
 */
export function ensureOptOutText(body: string, channel: "sms" | "whatsapp" | "email"): string {
  const alreadyHasOptOut = /stop|unsubscribe|opt.?out/i.test(body);
  if (alreadyHasOptOut) return body;

  if (channel === "email") {
    return `${body}\n\nNo longer want these reminders? Reply to this email with "unsubscribe" and we'll stop.`;
  }
  return `${body} Reply STOP to opt out.`;
}
