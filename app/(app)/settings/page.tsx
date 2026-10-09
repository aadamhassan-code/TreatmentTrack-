import { Card, CardBody } from "@/components/ui/card";
import { IntegrationRow } from "@/components/settings/integration-status";
import { ChannelSettingsForm } from "@/components/settings/channel-settings-form";
import { TemplateEditor } from "@/components/settings/template-editor";
import { requireCurrentPractice } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import { twilioSmsProvider } from "@/lib/messaging/twilio-sms";
import { whatsappProvider } from "@/lib/messaging/whatsapp";
import { emailProvider } from "@/lib/messaging/email";
import { isStripeConfigured } from "@/lib/stripe";
import type { Settings, Channel, SequenceStep } from "@/lib/types";

export default async function SettingsPage() {
  const { practice } = await requireCurrentPractice();
  const supabase = await createClient();

  const [{ data: settings }, { data: templates }] = await Promise.all([
    supabase.from("settings").select("*").eq("practice_id", practice.id).single(),
    supabase
      .from("message_templates")
      .select("step, channel, body")
      .eq("practice_id", practice.id),
  ]);

  const templateEntries = (templates ?? []) as {
    step: SequenceStep;
    channel: Channel;
    body: string;
  }[];

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">{practice.name}</p>
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-medium text-ink-900">
          Integrations
        </h2>
        <Card>
          <CardBody>
            <IntegrationRow
              name="Twilio (SMS)"
              description="Sends the Day 3/7/14/30 SMS sequence."
              connected={twilioSmsProvider.isConfigured()}
              hint="Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER."
            />
            <IntegrationRow
              name="WhatsApp Business API"
              description="Sends the sequence over WhatsApp instead of, or alongside, SMS."
              connected={whatsappProvider.isConfigured()}
              hint="Set TWILIO_WHATSAPP_FROM once you have an approved WhatsApp sender."
            />
            <IntegrationRow
              name="Email"
              description="Sends the sequence by email."
              connected={emailProvider.isConfigured()}
              hint="Set RESEND_API_KEY and RESEND_FROM_EMAIL."
            />
            <IntegrationRow
              name="Stripe billing"
              description="Handles your subscription and plan changes."
              connected={isStripeConfigured()}
              hint="Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and the six price IDs (three plans × monthly/annual)."
            />
          </CardBody>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-medium text-ink-900">
          Channels &amp; cross-sell
        </h2>
        <Card>
          <CardBody>
            <ChannelSettingsForm
              settings={settings as Settings}
              whatsappConnected={whatsappProvider.isConfigured()}
            />
          </CardBody>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-medium text-ink-900">
          Message templates
        </h2>
        <TemplateEditor templates={templateEntries} />
      </section>
    </div>
  );
}
