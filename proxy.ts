import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// See lib/supabase/client.ts — same placeholder fallback rationale.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

/**
 * Pages anyone may see signed out. Everything else redirects to /login.
 * Deny-by-default: a new app section is protected without having to
 * remember to add it here (the old allow-list missed /cases).
 *
 * /api is excluded from the redirect because every API route enforces its
 * own auth (Stripe/Twilio signatures, cron bearer secret, Supabase
 * session) and redirecting an API request to an HTML login page would
 * break webhooks. Server pages also still check auth themselves via
 * requireCurrentPractice() — this proxy is defence in depth, not the only
 * gate.
 */
const PUBLIC_PREFIXES = [
  "/pricing",
  "/request-callback",
  "/privacy",
  "/terms",
  "/dpa",
  "/login",
  "/signup",
  "/approve", // patient-facing approval links, authenticated by token
  "/api",
  "/offline.html",
];

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
