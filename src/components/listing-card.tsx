"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Home, Ban } from "lucide-react";
import { listingUrl, listingImageUrl } from "@/lib/domain/types";
import type { ListingWithScore } from "@/lib/domain/types";
import { toast } from "sonner";

export function ListingCard({
  listing,
  hasScores,
  isBlocked,
}: {
  listing: ListingWithScore;
  hasScores: boolean;
  isBlocked?: boolean;
}) {
  const [blocked, setBlocked] = useState(isBlocked ?? false);
  const [loading, setLoading] = useState(false);
  const imgSrc = listingImageUrl(listing.imageUrl ?? "", 400, 250);

  async function handleBlock(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (blocked || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "id",
          value: listing.id,
          label: listing.address,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to block");
      }
      const entry = await res.json();
      setBlocked(true);

      toast("Listing blocked", {
        description: listing.address,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await fetch("/api/blacklist", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entryId: entry.id }),
              });
              setBlocked(false);
            } catch {
              toast.error("Failed to undo block");
            }
          },
        },
        duration: 5000,
      });
    } catch {
      toast.error("Failed to block listing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <a
      href={listingUrl(listing.id)}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-xl border overflow-hidden hover:shadow-md transition-all"
    >
      <div className="relative">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={listing.address}
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="aspect-video w-full bg-muted flex items-center justify-center">
            <Home className="h-10 w-10 text-muted-foreground" />
          </div>
        )}

        {/* Status badges — top right */}
        {listing.hasApplied && (
          <Badge variant="default" className="absolute top-2 right-2">
            Applied
          </Badge>
        )}
        {!listing.hasApplied && listing.imageUrl && (
          <Badge variant="warning" className="absolute top-2 right-2">
            In Progress
          </Badge>
        )}

        {/* Block button — top left */}
        {blocked ? (
          <Badge variant="secondary" className="absolute top-2 left-2">
            Blocked
          </Badge>
        ) : (
          <button
            onClick={handleBlock}
            disabled={loading}
            className="absolute top-2 left-2 rounded-full bg-background/80 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
            title="Block this listing"
          >
            <Ban className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="p-3 space-y-1">
        <span className="font-medium text-sm line-clamp-1">
          {listing.address}{listing.neighborhood ? `, ${listing.neighborhood}` : ""}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>&euro;{listing.rentNet}/month</span>
          <span>{listing.rooms} rooms</span>
          <span>Rank #{listing.position}</span>
          {hasScores && listing.score != null && (
            <span>Score {listing.score}</span>
          )}
        </div>
      </div>
    </a>
  );
}
