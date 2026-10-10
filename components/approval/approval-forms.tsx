"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { requestOwnerApproval, approvePractice, type ApprovalRequestResult } from "@/lib/actions/approval";

const inputClass =
  "w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700";

export function ApprovalRequestForm() {
  const [result, setResult] = useState<ApprovalRequestResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setResult(null);
          setCopied(false);
          startTransition(async () => setResult(await requestOwnerApproval(data)));
        }}
      >
        <label className="block text-sm font-medium text-ink-900" htmlFor="ownerEmail">
          Practice owner&rsquo;s email
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input id="ownerEmail" name="ownerEmail" type="email" required className={inputClass} placeholder="owner@practice.co.uk" />
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Get approval link"}
          </Button>
        </div>
      </form>

      {result?.error && <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{result.error}</p>}
      {result?.link && (
        <div className="space-y-2 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-900">
          <p>
            {result.emailed
              ? "We've emailed the practice owner. You can also send them this link yourself:"
              : "Send this link to the practice owner (by email or message). It works once:"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-cream-0 px-2 py-1 text-xs">{result.link}</code>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(result.link!);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ApproveForm({ token, practiceName }: { token: string; practiceName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <p className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">
        Thank you — approved. Follow-up messages for these patients will now go out in {practiceName}&rsquo;s name.
        You can close this page.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const res = await approvePractice(token, data);
          if (res.ok) setDone(true);
          else setError(res.error ?? "Something went wrong.");
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-ink-900" htmlFor="name">
            Your name
          </label>
          <input id="name" name="name" required className={`mt-1.5 ${inputClass}`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-900" htmlFor="email">
            Your email
          </label>
          <input id="email" name="email" type="email" required className={`mt-1.5 ${inputClass}`} />
        </div>
      </div>
      <label className="flex items-start gap-3 text-sm text-ink-700">
        <input type="checkbox" name="confirm" required className="mt-0.5 h-4 w-4 accent-teal-700" />
        <span>
          I&rsquo;m the owner of {practiceName}, or authorised to agree on its behalf, and I approve follow-up messages
          being sent in the practice&rsquo;s name as described above.
        </span>
      </label>
      {error && <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Approving…" : "Approve"}
      </Button>
    </form>
  );
}
