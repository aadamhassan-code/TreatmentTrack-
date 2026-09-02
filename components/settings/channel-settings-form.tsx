"use client";

import { useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { updateChannelSettings } from "@/lib/actions/settings";
import type { Settings } from "@/lib/types";

export function ChannelSettingsForm({
  settings,
  whatsappConnected,
}: {
  settings: Settings;
  whatsappConnected: boolean;
}) {
  const [sms, setSms] = useState(settings.sms_enabled);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp_enabled);
  const [email, setEmail] = useState(settings.email_enabled);
  const [crossSell, setCrossSell] = useState(settings.cross_sell_enabled);

  return (
    <form action={updateChannelSettings} className="space-y-4">
      <Toggle checked={sms} onChange={setSms} label="SMS follow-up" />
      <input type="hidden" name="sms_enabled" value={sms ? "on" : ""} />

      <Toggle
        checked={whatsapp}
        onChange={setWhatsapp}
        label="WhatsApp follow-up"
        description={
          whatsappConnected
            ? undefined
            : "WhatsApp Business API isn't connected yet — you can enable this now and messages will start once it's wired up."
        }
      />
      <input type="hidden" name="whatsapp_enabled" value={whatsapp ? "on" : ""} />

      <Toggle checked={email} onChange={setEmail} label="Email follow-up" />
      <input type="hidden" name="email_enabled" value={email ? "on" : ""} />

      <div className="pt-2">
        <Toggle
          checked={crossSell}
          onChange={setCrossSell}
          label="Cross-sell suggestions from Log Visit (practice-wide)"
          description="This only turns the feature on for the practice. Individual suggestions still require that specific patient's cross-sell consent — this switch can never override that."
        />
        <input type="hidden" name="cross_sell_enabled" value={crossSell ? "on" : ""} />
      </div>

      <Button type="submit" size="sm">
        Save channel settings
      </Button>
    </form>
  );
}
