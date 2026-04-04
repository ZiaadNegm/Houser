"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function SettingsToggle({
  endpoint,
  label,
  initialEnabled,
}: {
  endpoint: string;
  label: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  async function handleToggle(newValue: boolean) {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
      });
      if (!res.ok) {
        const body = await res.json();
        console.error("Toggle failed:", body.error);
        return;
      }
      setEnabled(newValue);
    } catch (err) {
      console.error("Toggle failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={loading}
      />
      <Label className="text-sm text-muted-foreground">{label}</Label>
    </div>
  );
}
