import { Card, CardBody } from "@/components/ui/card";
import { IntegrationRow } from "@/components/settings/integration-status";
import { ChannelSettingsForm } from "@/components/settings/channel-settings-form";
import { TemplateEditor } from "@/components/settings/template-editor";
import { ScheduleEditor } from "@/components/settings/schedule-editor";
import { CaseBoardsEditor } from "@/components/settings/case-boards-editor";
import type { CaseBoard, CaseStage } from "@/lib/cases";
import { DEFAULT_SEQUENCE_DAYS } from "@/lib/schedule";
import { DentallyConnection, type DentallyIntegrationInfo } from "@/components/settings/dentally-connection";
import { isDentallyIntegrationEnabled } from "@/lib/integrations/dentally";
import { requireCurrentPractice } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import { twilioSmsProvider } from "@/lib/messaging/twilio-sms";
import { whatsappProvider } from "@/lib/messaging/whatsapp";
import { emailProvider } from "@/lib/messaging/email";
import { isStripeConfigured } from "@/lib/stripe";
import type { Settings, Channel, SequenceStep } from "@/lib/types";

export default async function SettingsPage() {
  const { practice, role } = await requireCurrentPractice();
  const readOnly = role !== "owner";
  const supabase = await createClient();

  const [{ data: settings }, { data: templates }, { data: dentally }, { data: boardRows }, { data: stageRows }] = await Promise.all([
    supabase.from("settings").select("*").eq("practice_id", practice.id).single(),
    supabase
      .from("message_templates")
      .select("step, channel, body")
      .eq("practice_id", practice.id),
    supabase
      .from("integrations")
      .select("account_label, region, last_synced_at, last_sync_error")
      .eq("practice_id", practice.id)
      .eq("provider", "dentally")
      .maybeSingle(),
    supabase.from("case_boards").select("id, name, keywords, is_default, position").eq("practice_id", practice.id).order("position"),
    supabase.from("case_stages").select("id, board_id, name, expected_days, position").eq("practice_id", practice.id).order("position"),
  ]);

  const caseBoards: CaseBoard[] = (boardRows ?? []).map((b) => ({
    ...(b as Omit<CaseBoard, "stages">),
    stages: ((stageRows ?? []) as CaseStage[]).filter((s) => s.board_id === b.id),
  }));

  const sequenceDays: number[] = (settings as Settings | null)?.sequence_days ?? DEFAULT_SEQUENCE_DAYS;

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
        {readOnly && (
          <p className="mt-4 rounded-lg bg-ink-900/5 px-4 py-3 text-sm text-ink-700">
            You can see these settings, but only a practice owner can change them.
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-medium text-ink-900">
          Integrations
        </h2>
        <Card>
          <CardBody>
            <IntegrationRow
              name="Twilio (SMS)"
              description="Sends your follow-up messages by text."
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
        <h2 className="mb-3 font-display text-xl font-medium text-ink-900">Practice software</h2>
        <Card>
          <CardBody className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-900">Dentally</p>
              {isDentallyIntegrationEnabled() || dentally ? (
                <DentallyConnection
                  integration={(dentally as DentallyIntegrationInfo | null) ?? null}
                  isOwner={!readOnly}
                />
              ) : (
                <div className="space-y-2 text-sm text-ink-500">
                  <p>
                    <span className="mr-2 rounded-full bg-gold-200 px-2 py-0.5 text-xs font-medium text-gold-700">
                      Coming soon
                    </span>
                    We&rsquo;re applying to become an approved Dentally partner. Once approved, you&rsquo;ll be able to
                    connect Dentally here so unbooked treatment plans come in automatically and quotes are marked
                    Booked when the patient books.
                  </p>
                  <p>
                    Until then, export your outstanding treatment plans from Dentally as a spreadsheet (CSV) and use{" "}
                    <a href="/treatments/import" className="font-medium text-teal-700 underline">
                      Import CSV
                    </a>
                    , then mark quotes Booked from the dashboard when patients book.
                  </p>
                </div>
              )}
            </div>
            <div className="border-t border-ink-900/6 pt-5">
              <p className="mb-1 text-sm font-semibold text-ink-900">CareStack</p>
              <p className="text-sm text-ink-500">
                In CareStack, run the <strong>Treatment Tracker</strong> report (System Menu → Operational Reports)
                with <strong>Scheduled Status</strong> set to <strong>Unscheduled</strong>, download it as CSV, and use{" "}
                <a href="/treatments/import" className="font-medium text-teal-700 underline">
                  Import CSV
                </a>{" "}
                — no editing needed. Step-by-step instructions are on the import page.
              </p>
            </div>
            <div className="border-t border-ink-900/6 pt-5">
              <p className="mb-1 text-sm font-semibold text-ink-900">Software of Excellence (Exact / R4)</p>
              <p className="text-sm text-ink-500">
                SOE doesn&rsquo;t offer a way for other software to connect directly. Instead, run your outstanding
                treatment plans report in Exact, export it to Excel, save it as CSV, and use{" "}
                <a href="/treatments/import" className="font-medium text-teal-700 underline">
                  Import CSV
                </a>
                . Mark quotes Booked from the dashboard when patients book.
              </p>
            </div>
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
              readOnly={readOnly}
            />
          </CardBody>
        </Card>
      </section>

      <section>
        <h2 className="mb-1 font-display text-xl font-medium text-ink-900">Follow-up schedule</h2>
        <p className="mb-3 text-sm text-ink-500">How many messages each patient gets, and when.</p>
        <Card>
          <CardBody>
            <ScheduleEditor initialDays={sequenceDays} readOnly={readOnly} />
          </CardBody>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-medium text-ink-900">
          Message templates
        </h2>
        <TemplateEditor templates={templateEntries} sequenceDays={sequenceDays} readOnly={readOnly} />
      </section>

      <section>
        <h2 className="mb-1 font-display text-xl font-medium text-ink-900">Cases board</h2>
        <p className="mb-3 text-sm text-ink-500">
          The stages each kind of treatment goes through once the patient has booked.
        </p>
        <Card>
          <CardBody>
            <CaseBoardsEditor
              boards={caseBoards}
              autoStart={(settings as Settings | null)?.cases_auto_start ?? true}
              readOnly={readOnly}
            />
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
