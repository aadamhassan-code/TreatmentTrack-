import "server-only";
import twilio from "twilio";
import type { MessageProvider, SendMessageInput, SendMessageResult } from "./provider";

export const twilioSmsProvider: MessageProvider = {
  isConfigured() {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_NUMBER
    );
  },

  async send({ to, body }: SendMessageInput): Promise<SendMessageResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: "Twilio SMS is not connected yet." };
    }

    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      const message = await client.messages.create({
        to,
        from: process.env.TWILIO_FROM_NUMBER!,
        body,
      });
      return { ok: true, providerMessageId: message.sid };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
};
