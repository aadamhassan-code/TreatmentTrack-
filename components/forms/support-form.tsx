"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { sendSupportRequest, type SupportResult } from "@/lib/actions/support";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-ink-900/15 bg-cream-0 px-3.5 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700";

export function SupportForm() {
  const [result, setResult] = useState<SupportResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.success) {
    return (
      <Card>
        <CardBody className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden />
          <div>
            <p className="font-medium text-ink-900">Message sent</p>
            <p className="mt-1 text-sm text-ink-500">We&rsquo;ll reply to your login email, usually within one working day.</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setResult(null);
        startTransition(async () => setResult(await sendSupportRequest(data)));
      }}
    >
      <Card>
        <CardBody className="space-y-4">
          <div>
            <label htmlFor="support-message" className="block text-sm font-medium text-ink-900">
              How can we help?
            </label>
            <textarea id="support-message" name="message" required rows={5} maxLength={2000} className={inputClass} />
          </div>
          <div>
            <label htmlFor="support-phone" className="block text-sm font-medium text-ink-900">
              Phone <span className="font-normal text-ink-500">(optional, if you&rsquo;d like a call)</span>
            </label>
            <input id="support-phone" name="phone" type="tel" maxLength={50} className={`${inputClass} max-w-xs`} />
          </div>
          {result?.error && <p className="rounded-lg bg-clay-100 px-4 py-3 text-sm text-clay-700">{result.error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send message"}
          </Button>
        </CardBody>
      </Card>
    </form>
  );
}
