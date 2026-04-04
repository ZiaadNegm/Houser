"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function AutoApplyStatus({
  automationEnabled,
  dryRunEnabled,
}: {
  automationEnabled: boolean;
  dryRunEnabled: boolean;
}) {
  const router = useRouter();
  const [autoOn, setAutoOn] = useState(automationEnabled);
  const [dryRun, setDryRun] = useState(dryRunEnabled);
  const [autoLoading, setAutoLoading] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  async function toggleAutomation(newValue: boolean) {
    setAutoLoading(true);
    try {
      const res = await fetch("/api/toggle-automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
      });
      if (!res.ok) {
        const body = await res.json();
        console.error("Toggle failed:", body.error);
        return;
      }
      setAutoOn(newValue);
    } catch (err) {
      console.error("Toggle failed:", err);
    } finally {
      setAutoLoading(false);
    }
  }

  async function toggleDryRun(newValue: boolean) {
    setDryRunLoading(true);
    try {
      const res = await fetch("/api/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
      });
      if (!res.ok) {
        const body = await res.json();
        console.error("Toggle failed:", body.error);
        return;
      }
      setDryRun(newValue);
    } catch (err) {
      console.error("Toggle failed:", err);
    } finally {
      setDryRunLoading(false);
    }
  }

  async function handleTriggerRun() {
    setTriggerLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/trigger-run", { method: "POST" });
      if (res.status === 409) {
        setMessage("A run is already in progress");
        return;
      }
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to trigger run");
      }
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setTriggerLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Auto-Apply</CardTitle>
        <Badge variant={autoOn ? "success" : "secondary"}>
          {autoOn ? "Running" : "Paused"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {autoOn
            ? "Auto-apply is active. Runs are scheduled automatically."
            : "Auto-apply is paused."}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoOn}
              onCheckedChange={toggleAutomation}
              disabled={autoLoading}
            />
            <Label className="text-sm">Automation</Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={dryRun}
              onCheckedChange={toggleDryRun}
              disabled={dryRunLoading}
            />
            <Label className="text-sm text-muted-foreground">Dry run</Label>
          </div>
        </div>

        <Button
          onClick={handleTriggerRun}
          disabled={triggerLoading}
          className="w-full"
          variant="default"
        >
          {triggerLoading ? "Triggering..." : "Trigger Manual Run"}
        </Button>

        {message && (
          <p className="text-sm text-yellow-600">{message}</p>
        )}
      </CardContent>
    </Card>
  );
}
