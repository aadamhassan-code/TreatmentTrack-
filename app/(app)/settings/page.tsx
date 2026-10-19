import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { IntegrationRow } from "@/components/settings/integration-status";
import { ChannelSettingsForm } from "@/components/settings/channel-settings-form";
import { TemplateEditor } from "@/components/settings/template-editor";
import { ScheduleEditor } from "@/components/settings/schedule-editor";
import { CaseBoardsEditor } from "@/components/settings/case-boards-editor";
import { TwoFactor } from "@/components/settings/two-factor";
import { RetentionSelect } from "@/components/settings/retention-select";
import { PercentField } from "@/components/settings/percent-field";
import type { CaseBoard, CaseStage } from "@/lib/cases";
import { DEFAULT_SEQUENCE_DAYS } from "@/lib/schedule";
import { DentallyConnection, type DentallyIntegrationInfo } from "@/components/settings/dentally-connection";
import { isDentallyIntegrationEnabled } from "@/lib/integrations/dentally";
import { requireCurrentPractice } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import { twilioSmsProvider } from "@/lib/messaging/twilio-sms";
import { whatsappProvider } from "@/lib/messaging/whatsapp";
import { emailProvider } from "@/lib/messaging/email";
import { isPlatformAdminEmail, parseAdminEmails } from "@/lib/admin";
import { setBoardLabCost } from "@/lib/actions/margins";
import { cn, formatDate } from "@/lib/utils";
import type { Settings, Channel, SequenceStep } from "@/lib/types";
import { isMissingSchema } from "@/lib/supabase/compat";

const TABS = [
  { id: "follow-up", label: "Follow-up" },
  { id: "software", label: "Practice software" },
  { id: "cases", label: "Cases board" },
  { id: "costs", label: "Costs & margins", ownerOnly: true },
  { id: "privacy", label: "Privacy & security" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const AUDIT_LABEL: Record<string, string> = {
  patient_exported: "Exported a patient's data",
  patient_erased: "Erased a patient",
  retention_erased: "Erased automatically (retention period)",
  mfa_enrolled: "Turned on two-factor sign-in",
  mfa_removed: "Turned off two-factor sign-in",
};

function Section({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl text-ink-900">{title}</h2>
      {intro && <p className="mt-1 max-w-[70ch] text-sm text-ink-500">{intro}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { practice, role } = await requireCurrentPractice();
  const readOnly = role !== "owner";
  const supabase = await createClient();
  const rawTab = (await searchParams).tab;
  const tabs = TABS.filter((t) => !("ownerOnly" in t) || role === "owner");
  const tab: TabId = tabs.some((t) => t.id === rawTab) ? (rawTab as TabId) : "follow-up";

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isPlatformAdmin = isPlatformAdminEmail(user?.email, parseAdminEmails(process.env.PLATFORM_ADMIN_EMAILS));

  const [{ data: settings }, { data: templates }, { data: dentally }, { data: boardRows }, { data: stageRows }] =
    await Promise.all([
      supabase.from("settings").select("*").eq("practice_id", practice.id).single(),
      supabase.from("message_templates").select("step, channel, body").eq("practice_id", practice.id),
      supabase
        .from("integrations")
        .select("account_label, region, last_synced_at, last_sync_error")
        .eq("practice_id", practice.id)
        .eq("provider", "dentally")
        .maybeSingle(),
      supabase
        .from("case_boards")
        .select("id, name, keywords, is_default, position, lab_cost_pct")
        .eq("practice_id", practice.id)
        .order("position"),
      supabase.from("case_stages").select("id, board_id, name, expected_days, position").eq("practice_id", practice.id).order("position"),
    ]);

  let boards = boardRows;
  const { error: boardError } = await supabase.from("case_boards").select("lab_cost_pct").limit(1);
  const marginsReady = !isMissingSchema(boardError);
  if (!marginsReady) {
    const { data } = await supabase
      .from("case_boards")
      .select("id, name, keywords, is_default, position")
      .eq("practice_id", practice.id)
      .order("position");
    boards = data as typeof boardRows;
  }
  const caseBoards: CaseBoard[] = (boards ?? []).map((b) => ({
    ...(b as Omit<CaseBoard, "stages">),
    stages: ((stageRows ?? []) as CaseStage[]).filter((s) => s.board_id === b.id),
  }));
  const sequenceDays: number[] = (settings as Settings | null)?.sequence_days ?? DEFAULT_SEQUENCE_DAYS;
  const templateEntries = (templates ?? []) as { step: SequenceStep; channel: Channel; body: string }[];

  const { data: audit } =
    tab === "privacy" && role === "owner"
      ? await supabase
          .from("audit_events")
          .select("id, action, actor_user_id, created_at, detail")
          .eq("practice_id", practice.id)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: [] };
  const { data: members } =
    tab === "privacy" && role === "owner"
      ? await supabase.from("practice_members").select("user_id, display_name").eq("practice_id", practice.id)
      : { data: [] };
  const memberName = new Map((members ?? []).map((m) => [m.user_id as string, (m.display_name as string | null) ?? null]));

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">{practice.name}</p>
        {readOnly && (
          <p className="mt-4 rounded-lg bg-ink-900/5 px-4 py-3 text-sm text-ink-700">
            You can see these settings, but only a practice owner can change them. Your own two-factor sign-in is
            under Privacy &amp; security.
          </p>
        )}
      </div>

      <nav aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-ink-900/10 px-1">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/settings?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium",
              tab === t.id ? "border-teal-700 text-teal-900" : "border-transparent text-ink-500 hover:text-ink-900"
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "follow-up" && (
        <>
          <Section title="Message delivery">
            <Card>
              <CardBody>
                <IntegrationRow
                  name="Text messages"
                  description="Follow-ups sent by SMS from your practice's number."
                  connected={twilioSmsProvider.isConfigured()}
                  hint={isPlatformAdmin ? "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER." : undefined}
                />
                <IntegrationRow
                  name="WhatsApp"
                  description="Follow-ups sent by WhatsApp, once an approved WhatsApp sender is set up."
                  connected={whatsappProvider.isConfigured()}
                  hint={isPlatformAdmin ? "Set TWILIO_WHATSAPP_FROM once a WhatsApp sender is approved." : undefined}
                />
                <IntegrationRow
                  name="Email"
                  description="Follow-ups sent by email."
                  connected={emailProvider.isConfigured()}
                  hint={isPlatformAdmin ? "Set RESEND_API_KEY and RESEND_FROM_EMAIL." : undefined}
                />
                {!isPlatformAdmin && (
                  <p className="pt-3 text-[13px] text-ink-500">
                    TreatmentTrack sets up delivery for you. If a channel shows as not set up, messages for it wait for
                    up to 7 days and then show as not sent. <Link href="/help" className="font-medium text-teal-700 underline">Contact support</Link> if you
                    need it switched on.
                  </p>
                )}
              </CardBody>
            </Card>
          </Section>

          <Section title="Channels">
            <Card>
              <CardBody>
                <ChannelSettingsForm
                  settings={settings as Settings}
                  whatsappConnected={whatsappProvider.isConfigured()}
                  readOnly={readOnly}
                />
              </CardBody>
            </Card>
          </Section>

          <Section title="Follow-up schedule" intro="How many messages each patient gets, and when.">
            <Card>
              <CardBody>
                <ScheduleEditor initialDays={sequenceDays} readOnly={readOnly} />
              </CardBody>
            </Card>
          </Section>

          <Section title="Message wording">
            <TemplateEditor templates={templateEntries} sequenceDays={sequenceDays} readOnly={readOnly} />
          </Section>
        </>
      )}

      {tab === "software" && (
        <Section
          title="Practice software"
          intro="Bring unbooked treatment plans in from the software you already use."
        >
          <Card>
            <CardBody className="space-y-6">
              <div>
                <p className="mb-2 text-sm font-semibold text-ink-900">Dentally</p>
                {isDentallyIntegrationEnabled() || dentally ? (
                  <DentallyConnection integration={(dentally as DentallyIntegrationInfo | null) ?? null} isOwner={!readOnly} />
                ) : (
                  <div className="space-y-2 text-sm text-ink-500">
                    <p>
                      <span className="mr-2 rounded-full bg-gold-200 px-2 py-0.5 text-xs font-medium text-gold-700">Coming soon</span>
                      A direct connection is on its way, so unbooked treatment plans come in by themselves and quotes are
                      marked Booked when the patient books in Dentally.
                    </p>
                    <p>
                      For now, export your outstanding treatment plans from Dentally as a spreadsheet and use{" "}
                      <Link href="/treatments/import" className="font-medium text-teal-700 underline">
                        Import spreadsheet
                      </Link>
                      .
                    </p>
                  </div>
                )}
              </div>
              <div className="border-t border-ink-900/6 pt-5">
                <p className="mb-1 text-sm font-semibold text-ink-900">CareStack</p>
                <p className="text-sm text-ink-500">
                  Run the <strong>Treatment Tracker</strong> report (System Menu, then Operational Reports) with{" "}
                  <strong>Scheduled Status</strong> set to <strong>Unscheduled</strong>, download it as CSV, and use{" "}
                  <Link href="/treatments/import" className="font-medium text-teal-700 underline">
                    Import spreadsheet
                  </Link>
                  . No editing needed.
                </p>
              </div>
              <div className="border-t border-ink-900/6 pt-5">
                <p className="mb-1 text-sm font-semibold text-ink-900">Software of Excellence (Exact) and R4</p>
                <p className="text-sm text-ink-500">
                  These don&rsquo;t offer a direct connection. Run your outstanding treatment plans report, export it to
                  Excel, save it as CSV, and use{" "}
                  <Link href="/treatments/import" className="font-medium text-teal-700 underline">
                    Import spreadsheet
                  </Link>
                  .
                </p>
              </div>
            </CardBody>
          </Card>
        </Section>
      )}

      {tab === "cases" && (
        <Section title="Cases board" intro="The stages each kind of treatment goes through once the patient has booked.">
          <Card>
            <CardBody>
              <CaseBoardsEditor
                boards={caseBoards}
                autoStart={(settings as Settings | null)?.cases_auto_start ?? true}
                readOnly={readOnly}
              />
            </CardBody>
          </Card>
        </Section>
      )}

      {tab === "costs" && role === "owner" && !marginsReady && (
        <p className="rounded-lg bg-gold-100 px-4 py-3 text-sm text-ink-900">
          Costs and margins are switched on with a quick database update. The TreatmentTrack team is applying it;
          this page will work as soon as it&rsquo;s done.
        </p>
      )}

      {tab === "costs" && role === "owner" && marginsReady && (
        <>
          <Section
            title="Lab and materials"
            intro="The typical lab and materials cost for each kind of treatment, as a percentage of the fee. Used for the estimated margins on Reports and Dentists. Kinds of treatment come from your Cases boards."
          >
            <Card>
              <CardBody className="divide-y divide-ink-900/6 p-0">
                {caseBoards.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{b.name}</p>
                      <p className="text-[13px] text-ink-500">
                        {b.is_default ? "Anything that matches no other board" : `Matches: ${b.keywords.join(", ") || "nothing yet"}`}
                      </p>
                    </div>
                    <PercentField
                      label={`Lab and materials for ${b.name}`}
                      initial={(b as CaseBoard & { lab_cost_pct?: number | null }).lab_cost_pct ?? null}
                      onSave={setBoardLabCost.bind(null, b.id)}
                    />
                  </div>
                ))}
              </CardBody>
            </Card>
          </Section>
          <Section title="Dentists' shares">
            <p className="text-sm text-ink-500">
              Each dentist&rsquo;s share of fees is set on the{" "}
              <Link href="/team" className="font-medium text-teal-700 underline">
                Team page
              </Link>
              . Estimated margin = fee, minus lab &amp; materials, minus the dentist&rsquo;s share of the rest. Only owners
              see costs and margins.
            </p>
          </Section>
        </>
      )}

      {tab === "privacy" && (
        <>
          <Section
            title="Two-factor sign-in"
            intro="Ask for a code from an authenticator app as well as your password. Strongly recommended for anyone who can see patient details. This setting is for your own login."
          >
            <Card>
              <CardBody>
                <TwoFactor />
              </CardBody>
            </Card>
          </Section>

          <Section
            title="Keeping patient data"
            intro="Patients with nothing open (no quote being followed up, no treatment in progress) are erased automatically once they've been inactive this long. A coded do-not-contact marker is kept so they're never messaged again."
          >
            <Card>
              <CardBody>
                <RetentionSelect
                  initial={(settings as Settings | null)?.retention_months ?? 24}
                  readOnly={readOnly}
                />
              </CardBody>
            </Card>
          </Section>

          <Section
            title="Patient requests"
            intro={
              <>
                To give a patient a copy of their data, or to erase it, open them from{" "}
                <Link href="/patients" className="font-medium text-teal-700 underline">
                  Patients
                </Link>{" "}
                and use Export or Erase. Owners and staff can do both.
              </>
            }
          >
            {null}
          </Section>

          {role === "owner" && (
            <Section title="Audit log" intro="Sensitive actions in this practice, newest first.">
              {(audit ?? []).length === 0 ? (
                <p className="rounded-xl border border-dashed border-ink-900/15 px-6 py-8 text-center text-sm text-ink-500">
                  Nothing recorded yet.
                </p>
              ) : (
                <ul className="divide-y divide-ink-900/6 rounded-xl border border-ink-900/8 bg-cream-0">
                  {(audit ?? []).map((a) => (
                    <li key={a.id} className="flex flex-wrap justify-between gap-x-6 gap-y-0.5 px-5 py-3 text-sm">
                      <span className="text-ink-900">{AUDIT_LABEL[a.action] ?? a.action}</span>
                      <span className="text-ink-500">
                        {a.actor_user_id ? (memberName.get(a.actor_user_id) ?? "A team member") : "TreatmentTrack"},{" "}
                        {formatDate(a.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
        </>
      )}
    </div>
  );
}
