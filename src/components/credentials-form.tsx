"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function CredentialsForm({
  initialStatus,
}: {
  initialStatus: { configured: boolean; updatedAt?: string };
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save");
      }
      setSaved(true);
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save credentials. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle>WoningNet Credentials</CardTitle>
          {(saved || initialStatus.configured) && (
            <Badge variant="outline" className="text-xs">
              Configured
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {initialStatus.configured && !saved
            ? `Last updated ${new Date(initialStatus.updatedAt!).toLocaleDateString()}. Enter new values below to update.`
            : saved
              ? "Credentials saved. Enter new values below to update."
              : "Enter your WoningNet login details so the automation can sign in on your behalf."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wn-email">Email</Label>
            <Input
              id="wn-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSaved(false);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wn-password">Password</Label>
            <Input
              id="wn-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setSaved(false);
              }}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving || !email || !password}>
            {saving ? "Saving..." : "Save Credentials"}
          </Button>
          {saved && <span className="text-sm text-muted-foreground">Saved</span>}
        </div>
      </CardContent>
    </Card>
  );
}
