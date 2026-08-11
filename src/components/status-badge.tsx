import { Badge, type BadgeTone } from "@/components/ui/badge";

const toneByStatus: Record<string, BadgeTone> = {
  active: "success",
  approved: "success",
  posted: "success",
  healthy: "success",
  pending: "warning",
  acknowledged: "info",
  snoozed: "neutral",
  resolved: "success",
  succeeded: "success",
  failed: "danger",
  partial: "warning",
  running: "info",
  draft: "neutral",
  planned: "info",
  review: "warning",
  expiring: "warning",
  informational: "info",
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "danger",
  archived: "neutral",
  rejected: "danger",
  blocked: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = toneByStatus[status.toLowerCase()] ?? "neutral";
  return <Badge tone={tone}>{status.replaceAll("_", " ")}</Badge>;
}
