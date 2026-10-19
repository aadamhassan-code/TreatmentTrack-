# Overnight build — 19 October 2026 (second session)

Live at https://treatmenttrack.vercel.app — merged in PR #2 (homepage) and PR #3 (everything below).

## First thing this morning (5 minutes)

Run these two files in the **Supabase SQL editor**, in order (open the file on GitHub, copy it all, paste, press Run):

1. `supabase/migrations/0008_gdpr.sql`
2. `supabase/migrations/0009_margins.sql`

The live app already works without them (nothing breaks), but these switch on: patient erasure, automatic retention, the audit log, database-enforced two-factor sign-in, margins, and support-request tagging in the back office. Also set `PLATFORM_ADMIN_EMAILS` in Vercel if you haven't, to open `/admin`.

## What changed

**Homepage**: rebuilt, centred, its own identity (distinct from Praxis); security and compliance moved to a separate "Data & security" page; "Try it free" replaced by "Get started" (there's no free trial, so "free" was a misleading claim).

**UK GDPR**: right to erasure (with a do-not-contact marker), subject access export, automatic retention (2 years by default), audit log, two-factor sign-in enforced in the database, privacy-safe default text wording, accurate data-location wording (Twilio and Resend are US sub-processors under the UK-US data bridge), "Forgot password?".

**Practice insights**: Patients page (search, dentist filter, full record with every message and consent history), Dentists page (booking rate, revenue, days to book, pipeline, cases, estimated margin), Reports dentist filter, 12-month revenue chart and estimated margins.

**App cleanup**: grouped sidebar with one "Add a quote" button; dashboard with four headline figures, needs-attention strip, compact quotes table, and a card layout on phones; Settings split into tabs without developer jargon; Help & support page with a message form.

## Verified

278 automated tests (including database tests for erasure, retention, 2FA enforcement and pay-share privacy), lint, type-check, production build, GitHub CI, and a page-by-page check of the live app in Chrome on the test account.

## Still for you (can't be done from code)

- Run migrations 0008 and 0009 (above).
- Company name, number and ICO registration on the Privacy, Terms and DPA pages; quick legal review.
- ICO data protection fee for the company.
- Branch protection on `main` requiring the CI check.
- Error alerting (Sentry or similar).
- Dentally partner application.
- Set dentist shares (Team page) and lab costs (Settings → Costs & margins) to see margins.
