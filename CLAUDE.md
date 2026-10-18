@AGENTS.md

# Project notes

TreatmentTrack: follow-up of quoted-but-declined dental treatment for UK
practices (PECR/GDPR consent model), plus case tracking after booking.
README.md is the map; docs/GO-LIVE.md is the launch checklist.

Conventions that matter here:

- Consent and tenancy rules are enforced in Postgres (triggers + RLS),
  not just the app — change `supabase/migrations/` and the `tests/db`
  suite together, never the app layer alone.
- Migrations are append-only: add `0008_...sql`, never edit shipped ones.
- `proxy.ts` protects pages deny-by-default; add genuinely public paths
  to `PUBLIC_PREFIXES` and extend `tests/unit/proxy-public.test.ts`.
- Visual identity (Oct 2026): ledger green / warm paper / gilt / Young
  Serif display — all through the colour tokens in `app/globals.css`.
  Deliberately distinct from praxisdental.co.uk's white/black/pastel
  look; don't drift back to it.
- The service worker (`public/sw.js`) must never cache pages or API
  responses — patient data stays network-first.
- `/admin` is the team back office: service-role reads gated by
  `PLATFORM_ADMIN_EMAILS`, strictly read-only.
- CI (`.github/workflows/ci.yml`) runs lint + tests + build on every PR;
  keep `npm test` green.
