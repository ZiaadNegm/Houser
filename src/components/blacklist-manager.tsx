"use client";

import { useState } from "react";
import type { WoningNetListing } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function BlacklistManager({
  initialBlacklist,
  listings,
}: {
  initialBlacklist: string[];
  listings: WoningNetListing[];
}) {
  const [blacklist, setBlacklist] = useState<string[]>(initialBlacklist);
  const [newId, setNewId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listingMap = new Map(listings.map((l) => [l.id, l]));

  async function handleAdd(listingId: string) {
    if (!listingId) return;
    setLoading(listingId);
    setError(null);
    try {
      const res = await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      if (!res.ok) throw new Error("Failed to add");
      const updated = await res.json();
      setBlacklist(updated);
      setNewId("");
    } catch {
      setError("Failed to add listing to blacklist.");
    } finally {
      setLoading(null);
    }
  }

  async function handleRemove(listingId: string) {
    setLoading(listingId);
    setError(null);
    try {
      const res = await fetch("/api/blacklist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      if (!res.ok) throw new Error("Failed to remove");
      const updated = await res.json();
      setBlacklist(updated);
    } catch {
      setError("Failed to remove listing from blacklist.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blacklist</CardTitle>
        <p className="text-sm text-muted-foreground">
          Blacklisted listings are excluded from automated actions and scoring.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="Listing ID"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd(newId)}
          />
          <Button
            onClick={() => handleAdd(newId)}
            disabled={!newId || loading === newId}
          >
            Add
          </Button>
        </div>

        {blacklist.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Listing ID</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {blacklist.map((id) => {
                const listing = listingMap.get(id);
                return (
                  <TableRow key={id}>
                    <TableCell className="font-mono text-sm">{id}</TableCell>
                    <TableCell>{listing?.address ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemove(id)}
                        disabled={loading === id}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No blacklisted listings.</p>
        )}
      </CardContent>
    </Card>
  );
}
