export type TreatmentStatus = "in_sequence" | "converted" | "lost" | "future_intent";

export type ConsentCategory = "quote_followup" | "cross_sell";

export type Channel = "sms" | "whatsapp" | "email";

export type SequenceStep = "day_3" | "day_7" | "day_14" | "day_30";

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
  created_at: string;
}

export interface Consent {
  id: string;
  practice_id: string;
  patient_id: string;
  category: ConsentCategory;
  granted: boolean;
  source_treatment_id: string | null;
  captured_by: string;
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
  lost_at: string | null;
  // joined
  patient?: Patient;
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
  updated_at: string;
}
