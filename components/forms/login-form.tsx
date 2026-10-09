"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { parseAuthHash } from "@/lib/auth-hash";

const subscribeToHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};
const readHash = () => window.location.hash;

export function LoginForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Invite and password-reset links carry login tokens in the URL hash.
  // Our browser client uses the PKCE flow, which deliberately ignores that
  // style of link, so we read the tokens ourselves and start the session.
  // useSyncExternalStore reads the hash only in the browser (the server
  // render sees ""), which keeps server and browser HTML in agreement.
  const hash = useSyncExternalStore(subscribeToHash, readHash, () => "");
  const authHash = useMemo(() => parseAuthHash(hash), [hash]);

  // null = not tried yet; "ok" = session started; otherwise an error message.
  const [linkResult, setLinkResult] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mode: "loading" | "set-password" | "sign-in" =
    linkResult === "ok"
      ? "set-password"
      : authHash?.kind === "tokens" && linkResult === null
        ? "loading"
        : "sign-in";

  const linkError =
    linkResult && linkResult !== "ok"
      ? `That link has expired or was already used: ${linkResult}`
      : authHash?.kind === "error"
        ? `That link didn't work: ${authHash.error}. Ask for a new invite or reset your password.`
        : null;

  useEffect(() => {
    if (authHash?.kind !== "tokens") return;
    let canceled = false;
    supabase.auth
      .setSession({ access_token: authHash.accessToken, refresh_token: authHash.refreshToken })
      .then(({ error }) => {
        if (canceled) return;
        // Don't leave the tokens sitting in the address bar / history.
        window.history.replaceState(null, "", window.location.pathname);
        setLinkResult(error ? error.message : "ok");
      });
    return () => {
      canceled = true;
    };
  }, [authHash, supabase]);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.message === "Failed to fetch"
          ? "Couldn't reach the login service. Check your internet connection and try again."
          : error.message
      );
      setSubmitting(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (mode === "loading") {
    return <div className="h-40" />;
  }

  if (mode === "set-password") {
    return (
      <div>
        <h1 className="font-display text-3xl font-medium text-ink-900">
          Set your password
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          Payment&rsquo;s confirmed — choose a password to finish setting up
          your account.
        </p>
        <form onSubmit={handleSetPassword} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink-900" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{error}</p>
          )}
          <Button type="submit" disabled={submitting} className="w-full" size="lg">
            {submitting ? "Saving…" : "Save password and continue"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-medium text-ink-900">Log in</h1>
      <p className="mt-2 text-sm text-ink-500">
        Each practice only ever sees its own patients and treatments.
      </p>
      <form onSubmit={handleSignIn} className="mt-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink-900" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-900" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>
        {(error ?? linkError) && (
          <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">
            {error ?? linkError}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="w-full" size="lg">
          {submitting ? "Signing in…" : "Log in"}
        </Button>
      </form>
    </div>
  );
}
