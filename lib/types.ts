/** "converted" is shown to staff as "Booked". */
export type TreatmentStatus = "in_sequence" | "converted" | "declined" | "lost" | "future_intent";

/** The ways a quote can be closed from the dashboard. */
export type TreatmentOutcome = "converted" | "declined" | "lost";

export const OPEN_STATUSES: readonly TreatmentStatus[] = ["in_sequence", "future_intent"];

export type ConsentCategory = "quote_followup" | "cross_sell";

export type Channel = "sms" | "whatsapp" | "email";

/** Message number in the practice's follow-up schedule (1–6). */
export type SequenceStep = 1 | 2 | 3 | 4 | 5 | 6;

export type VisitType = "hygiene" | "extraction" | "other";

/** Self-serve checkout tiers. "enterprise" is provisioned manually after a
 *  callback (see callback_requests) and is never offered through Stripe
 *  Checkout — it exists here only so `practices.plan` can record it. */
export type Plan = "solo" | "practice" | "multisite" | "enterprise";

/** The subset of Plan actually sold through Stripe Checkout. */
export type CheckoutPlan = Exclude<Plan, "enterprise">;

export type BillingInterval = "monthly" | "annual";

export interface Patient {
  id: string;
  practice_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  opted_out_at: string | null;
  /** Set when the patient was erased (details removed, do-not-contact marker kept). */
  erased_at?: string | null;
  created_at: string;
}

export interface Consent {
  id: string;
  practice_id: string;
  patient_id: string;
  category: ConsentCategory;
  granted: boolean;
  /** "staff" = recorded by a staff member; "patient_reply" = e.g. the patient replied STOP. */
  source: "staff" | "patient_reply";
  captured_by: string | null;
  captured_at: string;
  notes: string | null;
}

export interface Treatment {
  id: string;
  practice_id: string;
  patient_id: string;
  treatment_type: string;
  value_pence: number;
  status: TreatmentStatus;
  quote_followup_consent_id: string | null;
  future_intent_remind_at: string | null;
  created_at: string;
  updated_at: string;
  converted_at: string | null;
  declined_at: string | null;
  lost_at: string | null;
  /** The date the patient was quoted (can be before it was entered, e.g. imports). */
  quoted_on: string;
  source: "manual" | "csv_import" | "dentally";
  external_id: string | null;
  dentist_user_id: string | null;
  // joined
  patient?: Patient;
  sequence_steps?: { status: string; error: string | null; scheduled_for?: string }[];
}

export interface MessageTemplate {
  id: string;
  practice_id: string;
  step: SequenceStep;
  channel: Channel;
  body: string;
  updated_at: string;
}

export interface Settings {
  practice_id: string;
  cross_sell_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  /** Days after the quote for each follow-up message, e.g. [3, 7, 14, 30]. */
  sequence_days: number[];
  /** Booked quotes go on the Cases board automatically. */
  cases_auto_start: boolean;
  /** Inactive patients are erased automatically after this many months. */
  retention_months: number;
  updated_at: string;
}
