"use client";

import { useState, useTransition } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { updateChannelSettings } from "@/lib/actions/settings";
import type { Settings } from "@/lib/types";

export function ChannelSettingsForm({
  settings,
  whatsappConnected,
  readOnly = false,
}: {
  settings: Settings;
  whatsappConnected: boolean;
  readOnly?: boolean;
}) {
  const [sms, setSms] = useState(settings.sms_enabled);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp_enabled);
  const [email, setEmail] = useState(settings.email_enabled);
  const [crossSell, setCrossSell] = useState(settings.cross_sell_enabled);
  const [saving, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSaved(false);
    startTransition(async () => {
      await updateChannelSettings(formData);
      setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Toggle
        disabled={readOnly}
        checked={sms}
        onChange={setSms}
        label="SMS follow-up"
      />
      <input type="hidden" name="sms_enabled" value={sms ? "on" : ""} />

      <Toggle
        disabled={readOnly}
        checked={whatsapp}
        onChange={setWhatsapp}
        label="WhatsApp follow-up"
        description={
          whatsappConnected
            ? undefined
            : "WhatsApp Business API isn't connected yet — you can enable this now and messages will start once it's wired up."
        }
      />
      <input
        type="hidden"
        name="whatsapp_enabled"
        value={whatsapp ? "on" : ""}
      />

      <Toggle
        disabled={readOnly}
        checked={email}
        onChange={setEmail}
        label="Email follow-up"
      />
      <input type="hidden" name="email_enabled" value={email ? "on" : ""} />

      <div className="pt-2">
        <Toggle
          disabled={readOnly}
          checked={crossSell}
          onChange={setCrossSell}
          label="Cross-sell suggestions from Log Visit (practice-wide)"
          description="This only turns the feature on for the practice. Individual suggestions still require that specific patient's cross-sell consent — this switch can never override that."
        />
        <input
          type="hidden"
          name="cross_sell_enabled"
          value={crossSell ? "on" : ""}
        />
      </div>

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Save channel settings"}
          </Button>
          {saved && !saving && (
            <span className="text-sm text-teal-700">Saved</span>
          )}
        </div>
      )}
    </form>
  );
}
