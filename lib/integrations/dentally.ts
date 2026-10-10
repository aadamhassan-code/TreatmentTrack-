/**
 * Minimal client for the Dentally API (https://developer.dentally.co).
 * Authenticated with an API key (Bearer token) created by the practice in
 * Dentally. Rate limit is 3,600 requests per hour per user.
 */
export type DentallyRegion = "uk" | "sandbox";

/**
 * Dentally only gives API access to approved partners (and is moving them
 * to its NexGen API with OAuth2). Until TreatmentTrack is approved, the
 * connection stays switched off in production and Settings says "coming
 * soon"; set DENTALLY_INTEGRATION_ENABLED=true to use it (e.g. in Dentally's
 * sandbox, or locally against a mock).
 */
export function isDentallyIntegrationEnabled(): boolean {
  return process.env.DENTALLY_INTEGRATION_ENABLED === "true";
}

const BASE_URLS: Record<DentallyRegion, string> = {
  uk: "https://api.dentally.co/v1",
  sandbox: "https://api.sandbox.dentally.co/v1",
};

const MAX_PAGES = 40;
const PER_PAGE = 100;

export interface DentallyPractitioner {
  id: number | string;
  active: boolean;
  user: { email: string | null; first_name: string | null; last_name: string | null; title: string | null } | null;
}

export interface DentallyTreatmentPlan {
  id: number | string;
  practitioner_id: number | string | null;
  completed: boolean;
  created_at: string;
  start_date: string | null;
  nickname: string | null;
  patient_id: number | string;
  private_treatment_value: string | null;
  updated_at: string;
}

export interface DentallyTreatmentPlanItem {
  id: number | string;
  completed: boolean;
  nomenclature: string | null;
  patient_nomenclature: string | null;
  price: string | null;
  treatment_appointment_id: number | string | null;
  treatment_plan_id: number | string;
}

export interface DentallyPatient {
  id: number | string;
  active: boolean;
  first_name: string | null;
  last_name: string | null;
  mobile_phone: string | null;
  email_address: string | null;
  marketing: boolean | number | null;
  use_sms: boolean | null;
  use_email: boolean | null;
}

export class DentallyError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/** The calls the sync needs — a real client, or a fake in tests. */
export interface DentallyApi {
  getUser(): Promise<{ email: string | null; first_name: string | null; last_name: string | null }>;
  listTreatmentPlans(params: { updated_since?: string; completed?: boolean }): Promise<DentallyTreatmentPlan[]>;
  listTreatmentPlanItems(params: { treatment_plan_id?: string; updated_after?: string }): Promise<DentallyTreatmentPlanItem[]>;
  getPatient(id: string): Promise<DentallyPatient>;
  listPractitioners(): Promise<DentallyPractitioner[]>;
}

export function createDentallyClient(apiKey: string, region: DentallyRegion = "uk"): DentallyApi {
  // DENTALLY_API_BASE_URL lets local development point at a mock Dentally.
  // Ignored in production so a stray setting can't redirect real API keys.
  const override = process.env.NODE_ENV !== "production" ? process.env.DENTALLY_API_BASE_URL : undefined;
  const base = override || BASE_URLS[region];

  async function get<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        // Dentally rejects requests without a User-Agent.
        "User-Agent": "TreatmentTrack/1.0",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      let message = `Dentally returned ${res.status}`;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        if (body.error?.message) message = body.error.message;
      } catch {
        // not JSON
      }
      throw new DentallyError(message, res.status);
    }
    return (await res.json()) as T;
  }

  async function list<T>(path: string, key: string, params: Record<string, string | number | boolean | undefined>) {
    const all: T[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const body = await get<Record<string, unknown> & { meta?: { total?: number } }>(path, {
        ...params,
        page,
        per_page: PER_PAGE,
      });
      const items = (body[key] as T[] | undefined) ?? [];
      all.push(...items);
      const total = body.meta?.total;
      if (items.length < PER_PAGE || (total != null && all.length >= total)) break;
    }
    return all;
  }

  return {
    async getUser() {
      const { user } = await get<{ user: { email: string | null; first_name: string | null; last_name: string | null } }>(
        "/user"
      );
      return user;
    },
    listTreatmentPlans: (params) => list<DentallyTreatmentPlan>("/treatment_plans", "treatment_plans", params),
    listTreatmentPlanItems: (params) =>
      list<DentallyTreatmentPlanItem>("/treatment_plan_items", "treatment_plan_items", params),
    listPractitioners: () => list<DentallyPractitioner>("/practitioners", "practitioners", {}),
    async getPatient(id) {
      const { patient } = await get<{ patient: DentallyPatient }>(`/patients/${encodeURIComponent(id)}`);
      return patient;
    },
  };
}
