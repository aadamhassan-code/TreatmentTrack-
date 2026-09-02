import "server-only";
import twilio from "twilio";
import type { MessageProvider, SendMessageInput, SendMessageResult } from "./provider";

/**
 * WhatsApp Business API integration point.
 *
 * Not connected out of the box. Twilio's WhatsApp channel is the easiest
 * path to a real WhatsApp Business API sender — once you have an approved
 * WhatsApp sender number, set TWILIO_WHATSAPP_FROM (e.g. "whatsapp:+441234567890")
 * alongside the existing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN and this
 * provider activates automatically. No other code needs to change.
 */
export const whatsappProvider: MessageProvider = {
  isConfigured() {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_WHATSAPP_FROM
    );
  },

  async send({ to, body }: SendMessageInput): Promise<SendMessageResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        error:
          "WhatsApp Business API is not connected yet. Set TWILIO_WHATSAPP_FROM to activate this channel.",
      };
    }

    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      const message = await client.messages.create({
        to: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
        from: process.env.TWILIO_WHATSAPP_FROM!,
        body,
      });
      return { ok: true, providerMessageId: message.sid };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
};
