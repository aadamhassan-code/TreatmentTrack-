import "server-only";
import type { MessageProvider, SendMessageInput, SendMessageResult } from "./provider";

/**
 * Email integration point. Uses Resend's HTTP API directly (no SDK
 * dependency) so wiring up a real account is just setting RESEND_API_KEY
 * and RESEND_FROM_EMAIL — no code changes required.
 */
export const emailProvider: MessageProvider = {
  isConfigured() {
    return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
  },

  async send({ to, body }: SendMessageInput): Promise<SendMessageResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: "Email sending is not connected yet." };
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to,
          subject: "About your treatment quote",
          text: body,
        }),
      });

      if (!res.ok) {
        return { ok: false, error: `Email provider returned ${res.status}` };
      }

      const data = (await res.json()) as { id?: string };
      return { ok: true, providerMessageId: data.id };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
};
