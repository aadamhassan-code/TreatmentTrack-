"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  connectDentally,
  disconnectDentally,
  syncDentallyNow,
  type IntegrationActionResult,
} from "@/lib/actions/integrations";
import { formatDate } from "@/lib/utils";

export interface DentallyIntegrationInfo {
  account_label: string | null;
  region: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

function Feedback({ result }: { result: IntegrationActionResult | null }) {
  if (result?.error) return <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{result.error}</p>;
  if (result?.message) return <p className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">{result.message}</p>;
  return null;
}

function syncedAt(iso: string) {
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));
  return `${formatDate(iso)} at ${time}`;
}

export function DentallyConnection({
  integration,
  isOwner,
}: {
  integration: DentallyIntegrationInfo | null;
  isOwner: boolean;
}) {
  const [result, setResult] = useState<IntegrationActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<IntegrationActionResult>) {
    setResult(null);
    startTransition(async () => setResult(await action()));
  }

  if (integration) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium text-ink-900">
              Connected{integration.account_label ? ` as ${integration.account_label}` : ""}
              {integration.region === "sandbox" && <span className="ml-2 text-xs text-ink-500">(sandbox)</span>}
            </p>
            <p className="mt-0.5 text-ink-500">
              {integration.last_synced_at ? `Last synced ${syncedAt(integration.last_synced_at)}` : "Not synced yet"}
              {" · "}syncs automatically every morning
            </p>
            {integration.last_sync_error && (
              <p className="mt-1 text-clay-700">Last sync problem: {integration.last_sync_error}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(syncDentallyNow)}>
              {pending ? "Working…" : "Sync now"}
            </Button>
            {isOwner && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (confirm("Disconnect Dentally? The stored API key will be deleted.")) run(disconnectDentally);
                }}
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-ink-500">
          Unbooked private treatment plans appear under{" "}
          <Link href="/treatments/dentally" className="font-medium text-teal-700 underline">
            From Dentally
          </Link>{" "}
          for you to review. When a followed-up plan is booked into the Dentally diary, it&rsquo;s marked Booked here
          and its messages stop.
        </p>
        <Feedback result={result} />
      </div>
    );
  }

  if (!isOwner) {
    return <p className="text-sm text-ink-500">Not connected. A practice owner can connect Dentally here.</p>;
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        run(() => connectDentally(data));
      }}
    >
      <p className="text-sm text-ink-500">
        Connect Dentally to bring in unbooked treatment plans automatically and mark quotes Booked when the patient is
        booked into your diary. In Dentally, create a <strong>personal API token</strong> with permission to read{" "}
        <strong>patients</strong>, <strong>treatments</strong> and <strong>user</strong> details, then paste it below.
        If you can&rsquo;t see the option, Dentally support can switch on API access for your account.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input
          name="apiKey"
          type="password"
          autoComplete="off"
          required
          placeholder="Paste your Dentally API token"
          aria-label="Dentally API token"
          className="w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
        />
        <select
          name="region"
          defaultValue="uk"
          aria-label="Dentally account"
          className="rounded-lg border border-ink-900/15 bg-cream-0 px-3 py-2.5 text-sm"
        >
          <option value="uk">Dentally (UK)</option>
          <option value="sandbox">Dentally sandbox (testing)</option>
        </select>
        <Button type="submit" disabled={pending}>
          {pending ? "Connecting…" : "Connect"}
        </Button>
      </div>
      <p className="text-xs text-ink-500">
        The token is encrypted before it&rsquo;s stored and is never shown again, even to owners. TreatmentTrack only
        reads from Dentally — it never changes anything there.
      </p>
      <Feedback result={result} />
    </form>
  );
}
