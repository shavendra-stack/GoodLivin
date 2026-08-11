import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const FALLBACK_DISPLAY_NAME = "Team member";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeZone: "Asia/Colombo",
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  }).format(new Date(value));
}

export function formatLkr(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function displayNameFromProfile(
  profileName: string | null | undefined,
  email: string | null | undefined,
  metadataName?: string | null,
) {
  const candidate = profileName?.trim();
  const emailLocalPart = email?.split("@")[0]?.trim();
  if (candidate && candidate !== "GoodLivin user" && candidate.toLowerCase() !== emailLocalPart?.toLowerCase()) {
    return candidate;
  }

  return metadataName?.trim() || FALLBACK_DISPLAY_NAME;
}

export function firstName(name: string) {
  const normalized = name.trim();
  if (!normalized || normalized === FALLBACK_DISPLAY_NAME) return FALLBACK_DISPLAY_NAME;
  return normalized.split(/\s+/)[0];
}
