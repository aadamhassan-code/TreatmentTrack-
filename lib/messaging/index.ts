import "server-only";
import type { Channel } from "@/lib/types";
import type { MessageProvider } from "./provider";
import { twilioSmsProvider } from "./twilio-sms";
import { whatsappProvider } from "./whatsapp";
import { emailProvider } from "./email";

export { ensureOptOutText } from "./provider";
export type { MessageProvider, SendMessageInput, SendMessageResult } from "./provider";

const providers: Record<Channel, MessageProvider> = {
  sms: twilioSmsProvider,
  whatsapp: whatsappProvider,
  email: emailProvider,
};

export function getProvider(channel: Channel): MessageProvider {
  return providers[channel];
}
