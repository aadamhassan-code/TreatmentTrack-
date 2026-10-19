# Overnight build — 18/19 October 2026

Everything below is on PR #1 (branch `overnight/launch-prep`):
https://github.com/aadamhassan-code/TreatmentTrack-/pull/1
Nothing is live until the PR is merged; each commit is reviewable on its own.

## Done tonight

1. **Full audit** of main (including the CareStack import and the restyle) —
   architecture, RLS/consent model and webhook security are strong; the gaps
   were operational, and the items below close most of them.
2. **New visual identity** — the restyle had landed on the same clean-white/
   black/pastel ground as praxisdental.co.uk. Now: deep ledger-green, warm
   paper, gilt money highlights, Young Serif headlines; applied through the
   colour tokens, so site and app move together. Fonts are self-hosted in the
   repo (OFL), so builds never fetch Google Fonts.
3. **Security** — deny-by-default page protection in `proxy.ts` with a tested
   public allow-list; honeypot + length caps on the public lead form.
4. **Legal set** — `/privacy`, `/terms`, `/dpa` written from the code's real
   behaviour, linked from the footer. Needs company details + ICO number +
   review before a real practice signs up.
5. **PWA** — installable app: manifest, brand icons, conservative service
   worker (never caches patient data), offline page.
6. **Back office** — `/admin` (gated by `PLATFORM_ADMIN_EMAILS`): practices,
   value tracked/booked, failed messages, sync errors, leads.
7. **CI** — lint + 255 tests + production build on every PR; turn on branch
   protection for `main` requiring the `checks` job.
8. **Imports** — recognises more practice software exports (Aerona/iSmile/
   Pearl-style headings) and the import page explains what to export;
   R4 vendor corrected to Carestream in the README.
9. **Docs** — `docs/GO-LIVE.md` (exact env vars + steps for tomorrow's pilot,
   also saved in this project as `claude/go-live-checklist.md`), README
   updates, project conventions in `CLAUDE.md`.

## Verified

Lint clean · 255 tests passing · production build green (30 routes) ·
homepage/pricing/privacy reviewed at desktop and mobile widths.

## For Hamza & Aadam (can't be done from code)

- Merge PR #1 after review.
- Vercel env vars per `docs/GO-LIVE.md` (`DENTALLY_INTEGRATION_ENABLED`,
  `INTEGRATIONS_ENCRYPTION_KEY`, `PLATFORM_ADMIN_EMAILS`, Twilio…).
- Branch protection on `main` requiring CI.
- Company details + ICO registration on the legal pages; legal review.
- Error alerting (Sentry or similar).
- Submit the Dentally partner application (long queue): dentally.com → Partners.
- CareStack: live API needs their partner programme — the CSV import works today.
