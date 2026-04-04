import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListingCard } from "@/components/listing-card";
import type { ListingWithScore } from "@/lib/domain/types";

export function ListingsTable({
  listings,
  title,
  subtitle,
  blockedIds,
}: {
  listings: ListingWithScore[];
  title: string;
  subtitle: string;
  blockedIds?: Set<string>;
}) {
  if (listings.length === 0) return null;

  const hasScores = listings.some((l) => l.score != null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              hasScores={hasScores}
              isBlocked={blockedIds?.has(listing.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
