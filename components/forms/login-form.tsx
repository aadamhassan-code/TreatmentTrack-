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

export function LoginForm({ initialStep }: { initialStep?: "verify" } = {}) {
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
  // Two-factor: after the password, staff with an authenticator enter a code.
  const [needsCode, setNeedsCode] = useState(initialStep === "verify");
  const [code, setCode] = useState("");
  // Forgot password: send a reset link instead of signing in.
  const [resetting, setResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

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

    // Someone removed from every practice can still sign in, but has
    // nowhere to go — tell them why rather than bouncing back here.
    const { data: practiceId } = await supabase.rpc("current_practice_id");
    if (!practiceId) {
      await supabase.auth.signOut();
      setError(
        "Your login isn't linked to a practice at the moment. Ask your practice owner to invite you from their Team page."
      );
      setSubmitting(false);
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      setNeedsCode(true);
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.[0];
    if (!factor) {
      setError("Your session has expired. Please sign in again.");
      setNeedsCode(false);
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    if (error) {
      setError("That code didn't work. Use the newest code from your authenticator app.");
      setSubmitting(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setSubmitting(false);
    // Same message whether or not the email has an account, so the form
    // can't be used to find out who uses TreatmentTrack.
    if (error && error.message === "Failed to fetch") {
      setError("Couldn't reach the login service. Check your internet connection and try again.");
      return;
    }
    setResetSent(true);
  }

  if (mode === "loading") {
    return <div className="h-40" />;
  }

  if (mode === "set-password") {
    return (
      <div>
        <h1 className="font-display text-3xl text-ink-900">
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

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700";

  if (needsCode) {
    return (
      <div>
        <h1 className="font-display text-3xl text-ink-900">Enter your code</h1>
        <p className="mt-2 text-sm text-ink-500">
          Two-factor sign-in is on for your login. Enter the 6-digit code from your authenticator app.
        </p>
        <form onSubmit={handleVerifyCode} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink-900" htmlFor="code">
              6-digit code
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${inputClass} font-mono tracking-[0.3em]`}
            />
          </div>
          {error && <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{error}</p>}
          <Button type="submit" disabled={submitting || code.length !== 6} className="w-full" size="lg">
            {submitting ? "Checking…" : "Continue"}
          </Button>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              setNeedsCode(false);
              setCode("");
              setError(null);
            }}
            className="w-full text-center text-sm text-ink-500 hover:text-ink-900"
          >
            Use a different account
          </button>
        </form>
      </div>
    );
  }

  if (resetting) {
    return (
      <div>
        <h1 className="font-display text-3xl text-ink-900">Reset your password</h1>
        {resetSent ? (
          <p className="mt-4 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">
            If {email} has a TreatmentTrack login, a reset link is on its way. Open it on this device to choose a new
            password.
          </p>
        ) : (
          <form onSubmit={handleReset} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-ink-900" htmlFor="reset-email">
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            {error && <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full" size="lg">
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
        <button
          type="button"
          onClick={() => {
            setResetting(false);
            setResetSent(false);
            setError(null);
          }}
          className="mt-5 w-full text-center text-sm text-ink-500 hover:text-ink-900"
        >
          Back to log in
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-ink-900">Log in</h1>
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
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => {
              setResetting(true);
              setError(null);
            }}
            className="mt-2 text-sm text-teal-700 hover:text-teal-900"
          >
            Forgot password?
          </button>
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
