# TreatmentTrack

Follows up quoted-but-declined dental treatment plans (implants, crowns,
ortho, whitening) by SMS, WhatsApp and email until the patient books or
opts out — built for UK dental practices running Dentally or SOE, with a
consent model that matches PECR/GDPR rather than a generic "recall
reminders" toggle.

## Stack

Next.js (App Router, TypeScript) · Supabase (Postgres, Auth, RLS) · Stripe
Checkout · Twilio (SMS, with a WhatsApp Business API integration point) ·
Tailwind CSS · deployed to Vercel.

## Getting started

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in at least the Supabase
   values — everything else (Stripe, Twilio, WhatsApp, email) can be left
   blank and the app will show "not connected yet" states rather than
   crashing.
3. Create a Supabase project and run the migration in
   `supabase/migrations/0001_init.sql` against it (via the Supabase SQL
   editor, or `supabase db push` if you're using the CLI).
4. `npm run dev` and visit `http://localhost:3000`.

## Testing without Stripe

You don't need a Stripe account to try out the dashboard, Add Treatment,
Log Visit and Settings pages. Once step 3 above is done (Supabase project
created, migration applied, `.env.local` filled in with just the three
Supabase values), run:

```
npm run seed:dev
```

This creates a working practice and owner login directly in your Supabase
project — no Stripe Checkout, no invite email. It prints an email and
password you can use straight away at `/login`. Safe to re-run any time;
it reuses the same account instead of duplicating it. Real Stripe/Twilio
setup is only needed later for testing the actual paid-signup and
messaging flows end-to-end.

## Automated tests

```
npm test
```

Runs in a few seconds with nothing to set up. The database tests
(`tests/db/`) load the real migration into PGlite — an in-memory copy of
Postgres — and check the consent rules, STOP/opt-out handling and
row-level security (each practice only seeing its own data) against it.
The unit tests (`tests/unit/`) cover the send-time checks, opt-out
keywords and phone/link parsing.

## Pricing tiers

Three self-serve plans, each with its own Stripe price (monthly and
annual — see `.env.example`):

| Plan | Price | For |
| --- | --- | --- |
| Solo | £99/mo | An individual dentist |
| Practice | £199/mo | A single practice with a team |
| Multisite | £399/mo | Up to 5 practice locations |

Beyond 5 practices there's no self-serve checkout at all — `/pricing` and
the landing page point to `/request-callback`, a public lead form that
inserts into the `callback_requests` table (RLS allows anonymous insert
only; nobody can read them back except via the service-role key, e.g. from
the Supabase dashboard). Once a deal is agreed offline, provision that
practice by hand with `plan = 'enterprise'`.

## Billing flow

Signup never creates a usable account on its own — payment has to succeed
first:

1. `/signup` collects practice name, owner name and email for one of the
   three self-serve plans, then creates a Stripe Checkout Session
   (`/api/stripe/checkout`) and redirects there.
2. Stripe's `checkout.session.completed` webhook (`/api/stripe/webhook`) is
   the *only* place a `practices` row and its owner account get created —
   never the client-side redirect back to `/signup/success`.
3. The owner is invited by email (Supabase's `inviteUserByEmail`) and sets
   their password on `/login`, which finishes onboarding.

To test this locally, use the Stripe CLI:

```
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Automated sequence

Two cron routes, intended to be triggered by Vercel Cron (see
`vercel.json`) with `Authorization: Bearer $CRON_SECRET`:

- `/api/cron/send-sequence` — sends any due Day 3/7/14/30 steps, checking
  patient opt-out status again at send time (not just when scheduled).
- `/api/cron/future-intent` — converts "remind me in N months" treatments
  into an active sequence once their date arrives.

Inbound STOP replies are handled by `/api/webhooks/twilio/inbound`, which
should be set as the "A message comes in" webhook on your Twilio number.
Every request must carry a valid Twilio signature (checked against
`TWILIO_AUTH_TOKEN` and `NEXT_PUBLIC_SITE_URL`, or `TWILIO_WEBHOOK_URL` if
set). A STOP reply marks the patient opted out, appends a withdrawal to
their consent history and cancels every pending message, in one database
transaction (`record_patient_opt_out`).

## Compliance model

- Two consent categories are captured and stored separately, timestamped,
  and never mutated after the fact (`consents` is append-only — see the
  trigger in the migration): `quote_followup` (the PECR soft opt-in for a
  specific declined quote) and `cross_sell` (separate consent to be
  contacted about other treatment based on dental history).
- A database trigger on `treatments` refuses to create a treatment without
  a granted `quote_followup` consent on file — this isn't just a form
  validation.
- The cross-sell suggestion path in Log Visit (`lib/actions/visits.ts`)
  hard-blocks on missing `cross_sell` consent for that specific patient,
  regardless of the practice-wide cross-sell toggle in Settings.
- Every rendered message gets an opt-out appended automatically if the
  practice's own template doesn't already include one
  (`lib/messaging/provider.ts`).
