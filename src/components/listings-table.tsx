import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDeadline } from "@/lib/utils";
import { listingUrl, listingImageUrl } from "@/lib/domain/types";
import type { ListingWithScore } from "@/lib/domain/types";

function AppliedListingCard({ listing, hasScores }: { listing: ListingWithScore; hasScores: boolean }) {
  const imgSrc = listingImageUrl(listing.imageUrl ?? "", 400, 250);

  return (
    <a
      href={listingUrl(listing.id)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-4 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
    >
      {imgSrc && (
        <img
          src={imgSrc}
          alt={listing.address}
          className="h-24 w-36 rounded-md object-cover shrink-0"
        />
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{listing.address}</span>
          <Badge variant="default">Applied</Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {hasScores && listing.score != null && <span>Score {listing.score}</span>}
          <span>Position #{listing.position}</span>
          <span>{listing.rooms} rooms</span>
          <span>{listing.rentNet}</span>
          <span>til {formatDeadline(listing.deadline)}</span>
        </div>
        <p className="text-xs text-muted-foreground">{listing.owner}</p>
      </div>
    </a>
  );
}

export function ListingsTable({
  listings,
  title,
  subtitle,
}: {
  listings: ListingWithScore[];
  title: string;
  subtitle: string;
}) {
  if (listings.length === 0) return null;

  const hasScores = listings.some((l) => l.score != null);
  const colCount = hasScores ? 7 : 6;
  const applied = listings.filter((l) => l.hasApplied);
  const others = listings.filter((l) => !l.hasApplied);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Applied listings — card layout with images */}
        {applied.length > 0 && (
          <div className="space-y-2">
            {applied.map((listing) => (
              <AppliedListingCard key={listing.id} listing={listing} hasScores={hasScores} />
            ))}
          </div>
        )}

        {/* Other listings — compact table */}
        {others.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                {hasScores && <TableHead className="text-right">Score</TableHead>}
                <TableHead className="text-right">Position</TableHead>
                <TableHead className="text-right">Rooms</TableHead>
                <TableHead className="text-right">Rent</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {others.map((listing) => (
                <TableRow key={listing.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell colSpan={colCount} className="p-0">
                    <a
                      href={listingUrl(listing.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`grid items-center px-4 py-2 text-sm ${hasScores ? "grid-cols-7" : "grid-cols-6"}`}
                    >
                      <span className="font-medium">{listing.address}</span>
                      {hasScores && <span className="text-right">{listing.score ?? "—"}</span>}
                      <span className="text-right">{listing.position}</span>
                      <span className="text-right">{listing.rooms}</span>
                      <span className="text-right">&euro;{listing.rentNet}</span>
                      <span className="pl-4">{formatDeadline(listing.deadline)}</span>
                      <span />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
