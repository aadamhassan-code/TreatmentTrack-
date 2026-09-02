"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const isInviteFlow = useMemo(() => {
    if (typeof window === "undefined") return false;
    const hash = window.location.hash;
    return hash.includes("type=invite") || hash.includes("type=recovery");
  }, []);

  const [mode, setMode] = useState<"loading" | "set-password" | "sign-in">(() =>
    isInviteFlow ? "loading" : "sign-in"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isInviteFlow) return;
    // supabase-js detects the token in the URL hash on load and sets the
    // session; once that's done we ask for a password instead of signing
    // in with one.
    const timeout = setTimeout(() => setMode("set-password"), 300);
    return () => clearTimeout(timeout);
  }, [isInviteFlow]);

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
      setError(error.message);
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
        {error && (
          <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{error}</p>
        )}
        <Button type="submit" disabled={submitting} className="w-full" size="lg">
          {submitting ? "Signing in…" : "Log in"}
        </Button>
      </form>
    </div>
  );
}
