import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const TZ = "Europe/Amsterdam";

export function formatRunDate(isoString: string): { day: string; date: string; time: string } {
  const d = new Date(isoString);
  const day = d.toLocaleDateString("en-US", { weekday: "long", timeZone: TZ });
  const dd = d.toLocaleDateString("en-US", { day: "2-digit", timeZone: TZ }).padStart(2, "0");
  const mm = d.toLocaleDateString("en-US", { month: "2-digit", timeZone: TZ }).padStart(2, "0");
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
  return { day, date: `${dd}-${mm}`, time };
}

export function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "—";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (isNaN(ms) || ms < 0) return "—";
  const seconds = Math.round(ms / 1000);
  return `${seconds}s`;
}

export function formatDeadline(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: TZ });
  return `${day} ${month}`;
}

export function formatRelativeTime(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
