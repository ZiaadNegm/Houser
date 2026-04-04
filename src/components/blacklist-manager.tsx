"use client";

import { useState, useMemo } from "react";
import type { WoningNetListing } from "@/lib/domain/types";
import type { BlacklistEntry } from "@/lib/repositories/blacklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const MAX_ENTRIES = 50;

export function BlacklistManager({
  initialEntries,
  listings,
}: {
  initialEntries: BlacklistEntry[];
  listings: WoningNetListing[];
}) {
  const [entries, setEntries] = useState<BlacklistEntry[]>(initialEntries);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    const blockedIds = new Set(entries.filter((e) => e.type === "id").map((e) => e.value));
    return listings
      .filter((l) => !blockedIds.has(l.id) && l.address.toLowerCase().includes(q))
      .slice(0, 5);
  }, [query, listings, entries]);

  async function addEntry(type: "id" | "street", value: string, label: string) {
    setLoading(value);
    try {
      const res = await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value, label }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add");
      }
      const entry = await res.json();
      setEntries((prev) => [entry, ...prev]);
      setQuery("");
      setShowSuggestions(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add entry");
    } finally {
      setLoading(null);
    }
  }

  async function removeEntry(entryId: string) {
    setLoading(entryId);
    try {
      const res = await fetch("/api/blacklist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      if (!res.ok) throw new Error("Failed to remove");
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch {
      toast.error("Failed to remove entry");
    } finally {
      setLoading(null);
    }
  }

  function handleSelectListing(listing: WoningNetListing) {
    addEntry("id", listing.id, listing.address);
  }

  function handleSubmitStreet() {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      toast.error("Street name must be at least 3 characters");
      return;
    }
    addEntry("street", trimmed, trimmed);
  }

  const atLimit = entries.length >= MAX_ENTRIES;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blocked Listings</CardTitle>
        <p className="text-sm text-muted-foreground">
          Blocked listings are excluded from automated actions. {entries.length} / {MAX_ENTRIES} entries used.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search / Add input */}
        <div className="relative">
          <div className="flex gap-2">
            <Input
              placeholder="Search by address or enter a street name..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions.length === 0 && query.trim().length >= 3) {
                  handleSubmitStreet();
                }
              }}
              disabled={atLimit}
            />
            <Button
              onClick={handleSubmitStreet}
              disabled={atLimit || query.trim().length < 3 || loading !== null}
              variant="outline"
            >
              Add street
            </Button>
          </div>

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
              {suggestions.map((listing) => (
                <button
                  key={listing.id}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                  onClick={() => handleSelectListing(listing)}
                  disabled={loading !== null}
                >
                  <span className="flex-1 truncate">{listing.address}</span>
                  <span className="shrink-0 text-xs text-muted-foreground font-mono">{listing.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {atLimit && (
          <p className="text-sm text-destructive">Blacklist limit reached ({MAX_ENTRIES} entries).</p>
        )}

        {/* Entries table */}
        {entries.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Badge variant={entry.type === "id" ? "default" : "secondary"}>
                      {entry.type === "id" ? "Listing" : "Street"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{entry.value}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entry.label || "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeEntry(entry.id)}
                      disabled={loading === entry.id}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No blocked listings.</p>
        )}
      </CardContent>
    </Card>
  );
}
