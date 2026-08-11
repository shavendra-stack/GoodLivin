import { ShieldCheck } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export function AuditInfo({ actor = "System", timestamp, reason }: { actor?: string; timestamp?: string | null; reason?: string | null }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-forest-100 bg-forest-50/60 p-4 text-xs text-forest-800 shadow-sm">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">Audit information</p>
        <p className="mt-0.5 text-forest-700/80">{actor} {timestamp ? `· ${formatDateTime(timestamp)}` : ""}</p>
        {reason ? <p className="mt-1 text-forest-700/80">Reason: {reason}</p> : null}
      </div>
    </div>
  );
}
