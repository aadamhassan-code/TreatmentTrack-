# Go-live checklist

Everything needed to put TreatmentTrack in front of a real practice.
Worked through top to bottom, this takes about 30 minutes.

## 1. Database

- [ ] Supabase project exists (London region) and **all** migrations in
      `supabase/migrations/` have been run **in order** (0001 → 0009).
      Re-running one that's already applied fails loudly — that's fine.
- [ ] **New on 19 Oct:** run `0008_gdpr.sql` then `0009_margins.sql` in the
      Supabase SQL editor (paste each file, press Run). Until then the app
      works but erasure, retention, the audit log, database-enforced
      two-factor, margins and support-request tagging stay switched off.

## 2. Vercel environment variables (Production)

Required for the app to run at all:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | From Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page — server-only secret |
| `NEXT_PUBLIC_SITE_URL` | `https://treatmenttrack.vercel.app` (or the real domain) |
| `CRON_SECRET` | Any long random string; Vercel Cron sends it automatically |

Required before the pilot practice connects and messages flow:

| Variable | Notes |
| --- | --- |
| `INTEGRATIONS_ENCRYPTION_KEY` | 32 random bytes base64: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — never change once practices have connected |
| `DENTALLY_INTEGRATION_ENABLED` | `true` to show the Dentally connect card in Settings |
| `PLATFORM_ADMIN_EMAILS` | Hamza's and Aadam's sign-in emails, comma-separated → unlocks `/admin` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | A UK number; without these, sends are held up to 7 days then marked failed |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Email channel; optional for an SMS-only pilot |

Required for self-serve paid signups (not needed to hand-provision a pilot):

| Variable | Notes |
| --- | --- |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Webhook endpoint: `/api/stripe/webhook` |
| `STRIPE_PRICE_*` | The six price IDs (3 plans × monthly/annual) |

## 3. Twilio webhook

- [ ] On the Twilio number: "A message comes in" →
      `https://<site>/api/webhooks/twilio/inbound` (POST). STOP replies
      must reach this or opt-outs won't be recorded.

## 4. Connecting the pilot practice to Dentally

1. In the practice's Dentally: **Settings → Developer Settings** →
   create a **read-only** API token with patient and treatment-plan read
   access.
2. In TreatmentTrack: **Settings → Connect Dentally** → paste the token.
   The first sync runs immediately; plans land on the **From Dentally**
   page for staff review.
3. Staff tick the opt-out confirmation per plan before any follow-up
   starts. Nothing is messaged without that.

No Dentally partner approval is needed for a practice using its own
token. The partner application (for the NexGen API and scale) should be
submitted in parallel: https://www.dentally.com/en-gb/partners

## 5. Before real patients are messaged

- [ ] Add the company's registered name/number and ICO registration to
      `/privacy`, `/terms`, `/dpa`, and have them reviewed.
- [ ] Sign (or at least send) the DPA with the pilot practice — the
      `/dpa` page is the basis.
- [ ] Check the four seeded SMS/email templates read right for this
      practice (Settings → Templates).
- [ ] Send a test: add yourself as a patient with your own mobile,
      confirm the opt-out line appears, reply STOP, confirm the patient
      shows as opted out and pending messages are cancelled.

## 6. Watch it run

- [ ] `/admin` (as a `PLATFORM_ADMIN_EMAILS` account): sync errors,
      failed messages, sales leads and in-app support requests surface here.
- [ ] Vercel → Crons should also show `/api/cron/retention` (03:15).
- [ ] Vercel → Crons: three jobs should show green daily runs
      (07:00 future-intent, 07:30 integrations-sync, 08:00 send-sequence).
- [ ] Recommended next: connect Sentry (or similar) for error alerting —
      currently failures only reach Vercel logs and `/admin`.
