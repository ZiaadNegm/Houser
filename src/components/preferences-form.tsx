"use client";

import { useState } from "react";
import type { UserPreferences } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PreferencesForm({
  initialPreferences,
}: {
  initialPreferences: UserPreferences;
}) {
  const [prefs, setPrefs] = useState(initialPreferences);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
    } catch {
      setError("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure scoring preferences. Listings matching your preferences will rank higher.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="maxRent">Max Rent (EUR)</Label>
            <Input
              id="maxRent"
              type="number"
              placeholder="No limit"
              value={prefs.maxRent ?? ""}
              onChange={(e) =>
                updateField("maxRent", e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="minRooms">Min Rooms</Label>
            <Input
              id="minRooms"
              type="number"
              placeholder="No minimum"
              value={prefs.minRooms ?? ""}
              onChange={(e) =>
                updateField("minRooms", e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxPosition">Max Position</Label>
            <Input
              id="maxPosition"
              type="number"
              placeholder="No limit"
              value={prefs.maxPosition ?? ""}
              onChange={(e) =>
                updateField("maxPosition", e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contractType">Preferred Contract Type</Label>
            <Input
              id="contractType"
              placeholder="e.g. Onbepaalde tijd"
              value={prefs.preferredContractType ?? ""}
              onChange={(e) =>
                updateField("preferredContractType", e.target.value || null)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="neighborhoods">Preferred Neighborhoods</Label>
            <Input
              id="neighborhoods"
              placeholder="Comma-separated, e.g. Centrum, Oost"
              value={(prefs.preferredNeighborhoods ?? []).join(", ")}
              onChange={(e) =>
                updateField(
                  "preferredNeighborhoods",
                  e.target.value
                    ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                    : []
                )
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertyTypes">Preferred Property Types</Label>
            <Input
              id="propertyTypes"
              placeholder="Comma-separated, e.g. Etagewoning"
              value={(prefs.preferredPropertyTypes ?? []).join(", ")}
              onChange={(e) =>
                updateField(
                  "preferredPropertyTypes",
                  e.target.value
                    ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                    : []
                )
              }
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
          {saved && <span className="text-sm text-muted-foreground">Saved</span>}
        </div>
      </CardContent>
    </Card>
  );
}
