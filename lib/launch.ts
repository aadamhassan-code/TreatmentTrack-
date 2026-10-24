/**
 * Until billing and text messaging are switched on for real practices,
 * the site's main button invites practices to join as founding practices
 * (a contact form) instead of sending them to checkout. Set
 * NEXT_PUBLIC_SIGNUP_OPEN=true in Vercel to send them to sign-up again.
 */
export const SIGNUP_OPEN = process.env.NEXT_PUBLIC_SIGNUP_OPEN === "true";

export const FOUNDING_HREF = "/request-callback?topic=founding";

export const PRIMARY_CTA = SIGNUP_OPEN
  ? { href: "/signup", label: "Get started" }
  : { href: FOUNDING_HREF, label: "Become a founding practice" };
