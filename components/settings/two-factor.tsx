"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { recordMfaChange } from "@/lib/actions/security";

type Factor = { id: string; friendly_name?: string | null; created_at: string };
type Enrolment = { factorId: string; qr: string; secret: string };

/**
 * Two-factor sign-in with an authenticator app (TOTP), per user. Once
 * turned on, every sign-in asks for a 6-digit code as well as the password
 * (enforced in requireCurrentPractice, not just here).
 */
export function TwoFactor() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  }

  useEffect(() => {
    let cancelled = false;
    supabase.auth.mfa.listFactors().then(({ data }) => {
      if (!cancelled) setFactors((data?.totp ?? []) as Factor[]);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function start() {
    setBusy(true);
    setError(null);
    setMessage(null);
    // Clear any half-finished enrolment from an earlier attempt first.
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of all?.all ?? []) {
      if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      issuer: "TreatmentTrack",
    });
    setBusy(false);
    if (error || !data) {
      setError("Couldn't start two-factor set-up. Please try again.");
      return;
    }
    setEnrolment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolment) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolment.factorId, code: code.trim() });
    setBusy(false);
    if (error) {
      setError("That code didn't work. Check the time on your phone is set automatically, then try the newest code.");
      return;
    }
    await recordMfaChange("mfa_enrolled");
    setEnrolment(null);
    setCode("");
    setMessage("Two-factor sign-in is on. You'll be asked for a code each time you sign in.");
    await refresh();
    router.refresh();
  }

  async function remove(factorId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) {
      setError("Couldn't turn two-factor sign-in off. Sign out and back in with your code, then try again.");
      return;
    }
    await recordMfaChange("mfa_removed");
    setMessage("Two-factor sign-in is off.");
    await refresh();
    router.refresh();
  }

  if (factors === null) return <p className="text-sm text-ink-500">Checking…</p>;

  return (
    <div className="space-y-4 text-sm">
      {factors.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-ink-900">
            <ShieldCheck className="h-4 w-4 text-teal-600" aria-hidden />
            On for your login. Each sign-in asks for a code from your authenticator app.
          </p>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove(factors[0].id)}>
            Turn off
          </Button>
        </div>
      ) : enrolment ? (
        <form onSubmit={confirm} className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-ink-700">
            <li>Open an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
            <li>Scan this code, or type the key below into the app.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR as an SVG data URL */}
            <img src={enrolment.qr} alt="QR code for your authenticator app" width={168} height={168} className="rounded-lg border border-ink-900/10 bg-white p-2" />
            <p className="max-w-xs break-all font-mono text-xs text-ink-500">{enrolment.secret}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="totp-code" className="block font-medium text-ink-900">
                6-digit code
              </label>
              <input
                id="totp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="mt-1.5 w-36 rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 font-mono tracking-[0.3em] focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>
            <Button type="submit" disabled={busy || code.length !== 6}>
              {busy ? "Checking…" : "Turn on"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEnrolment(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-700">Off. Recommended for everyone who can see patient details.</p>
          <Button size="sm" disabled={busy} onClick={start}>
            Set up two-factor sign-in
          </Button>
        </div>
      )}
      {error && <p className="rounded-lg bg-clay-100 px-4 py-3 text-clay-700">{error}</p>}
      {message && <p className="rounded-lg bg-teal-50 px-4 py-3 text-teal-800">{message}</p>}
    </div>
  );
}
