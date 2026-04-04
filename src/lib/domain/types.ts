export type RunStatus = "queued" | "running" | "success" | "failed";
export type TriggerType = "manual" | "cron";

export interface ActionRecord {
  listing_id: string;
  address: string;
  action: string;
  status: string;
  error?: string;
}

export interface StepLogEntry {
  step: string;
  status: "success" | "failed" | "skipped";
  ts: string;
  error?: string;
  detail?: {
    listings_fetched?: number;
    listings_scored?: { id: string; address: string; score: number; reason: string }[];
    actions?: ActionRecord[];
    to_apply?: number;
    to_revoke?: number;
    to_replace?: number;
    dry_run?: boolean;
    verify_discrepancies?: number;
  };
}

export interface AutomationRun {
  id: string;
  user_id: string;
  status: RunStatus;
  trigger_type: TriggerType;
  started_at: string;
  completed_at: string | null;
  listings_found: number;
  actions_taken: number;
  error_message: string | null;
  result_data: ListingWithScore[] | null;
  step_log: StepLogEntry[] | null;
  created_at: string;
}

// Mirror of edge function WoningNetListing so frontend doesn't import from supabase/functions
export interface WoningNetListing {
  id: string;
  address: string;
  neighborhood: string;
  position: number;
  rooms: number;
  rentNet: string;
  contractType: string;
  propertyType: string;
  deadline: string;
  hasApplied: boolean;
  canRevoke: boolean;
  imageUrl: string;
}

export function listingImageUrl(rawUrl: string, width = 400, height = 300): string {
  if (!rawUrl) return "";
  return rawUrl.replace("/upload/", `/upload/q_auto/f_auto/c_fill,w_${width},h_${height}/`);
}

export const STEP_LABELS: Record<string, string> = {
  credentials_check: "Credentials check",
  login: "Login",
  fetch_listings: "Fetch listings",
  load_settings: "Load settings",
  score_listings: "Score listings",
  decide: "Decide actions",
  execute: "Execute actions",
  verify: "Verify results",
};

const WONINGNET_BASE = "https://almere.mijndak.nl";

export function listingUrl(listingId: string): string {
  return `${WONINGNET_BASE}/HuisDetails?PublicatieId=${listingId}`;
}

export function statusVariant(status: string) {
  switch (status) {
    case "success":
      return "success" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export function capitalizeStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export interface UserPreferences {
  maxRent: number | null;
  minRooms: number | null;
  preferredNeighborhoods: string[];
  preferredContractType: string | null;
  preferredPropertyTypes: string[];
  maxPosition: number | null;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  maxRent: null,
  minRooms: null,
  preferredNeighborhoods: [],
  preferredContractType: null,
  preferredPropertyTypes: [],
  maxPosition: null,
};

export interface ScoredListing extends WoningNetListing {
  score: number;
  matchReasons: string[];
}

/** Listing with optional scoring fields — used when result_data may or may not have scores. */
export type ListingWithScore = WoningNetListing & { score?: number; matchReasons?: string[] };

/** Sort by score descending (if available), otherwise by position ascending. */
export function sortListings(listings: ListingWithScore[]): ListingWithScore[] {
  return [...listings].sort((a, b) => {
    if (a.score != null && b.score != null) return b.score - a.score;
    return a.position - b.position;
  });
}
