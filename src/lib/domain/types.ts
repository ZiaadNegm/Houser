export type RunStatus = "queued" | "running" | "success" | "failed";
export type TriggerType = "manual" | "cron";

export interface StepLogEntry {
  step: string;
  status: "success" | "failed" | "skipped";
  ts: string;
  error?: string;
  detail?: {
    listings_fetched?: number;
    listings_scored?: { id: string; address: string; score: number; reason: string }[];
    listings_applied?: { id: string; address: string; result: string; reason: string }[];
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
  result_data: WoningNetListing[] | null;
  step_log: StepLogEntry[] | null;
  created_at: string;
}

// Mirror of edge function WoningNetListing so frontend doesn't import from supabase/functions
export interface WoningNetListing {
  id: string;
  address: string;
  neighborhood: string;
  postcode: string;
  position: number;
  rooms: number;
  rentNet: string;
  energyLabel: string;
  contractType: string;
  propertyType: string;
  deadline: string;
  hasApplied: boolean;
  canRevoke: boolean;
  totalApplicants: number;
  owner: string;
}

export const STEP_LABELS: Record<string, string> = {
  credentials_check: "Credentials check",
  login: "Login",
  fetch_listings: "Fetch listings",
  score_listings: "Score listings",
  apply: "Apply",
};

export function statusVariant(status: string) {
  switch (status) {
    case "success":
      return "default" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
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
