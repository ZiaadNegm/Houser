// Session state carried through a single automation run.
// Built up during init + login, passed to every subsequent request.
export interface WoningNetSession {
  nr1Cookie: string; // HttpOnly encrypted identity cookie (nr1Users)
  nr2Cookie: string; // Readable cookie containing CSRF + user metadata (nr2Users)
  csrfToken: string; // Extracted `crf` field from nr2Cookie
  moduleVersion: string; // Global version token from /moduleservices/moduleversioninfo
}

// Normalized listing parsed from PublicatieLijst.List[].
// Only fields needed for display and Phase 2 scoring/decisions.
export interface WoningNetListing {
  id: string; // PublicatieLijst.List[].Id — used for apply/revoke
  address: string; // Formatted: "Straatnaam Huisnummer, Woonplaats"
  neighborhood: string; // Adres.Wijk
  postcode: string; // Adres.Postcode
  position: number; // parseInt(VoorlopigePositie) — primary ranking signal
  rooms: number; // Eenheid.AantalKamers
  rentNet: string; // Eenheid.NettoHuur
  energyLabel: string; // Eenheid.EnergieLabel
  contractType: string; // ContractVorm ("Onbepaalde tijd", etc.)
  propertyType: string; // Eenheid.DetailSoort ("Etagewoning", etc.)
  deadline: string; // EinddatumTijd (ISO 8601)
  hasApplied: boolean; // HeeftGereageerd — idempotency check for Phase 2
  canRevoke: boolean; // IsIntrekkenReactieToegestaan — needed for Phase 2 revoke
  totalApplicants: number; // parseInt(AantalReactiesOpPublicatie)
  owner: string; // Eenheid.Eigenaar (housing corporation)
  imageUrl: string; // Foto_Locatie — full Cloudinary URL for listing photo
}

// Result of a single fetch-and-parse operation.
export interface FetchListingsResult {
  listings: WoningNetListing[];
  rawCount: number;
}
