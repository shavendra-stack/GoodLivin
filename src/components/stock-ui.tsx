"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, ShieldAlert } from "lucide-react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";

export const movementTypeLabels: Record<string, string> = {
  receipt: "Receipt", transfer: "Transfer", adjustment_in: "Adjustment in", adjustment_out: "Adjustment out", return: "Return", damage: "Damage", wastage: "Wastage", issue: "Issue",
};

export const adjustmentTypeLabels: Record<string, string> = {
  physical_count: "Physical count correction", damaged_stock: "Damaged stock", expired_stock: "Expired stock", sample_influencer_stock: "Samples / influencer stock", promotional_event: "Promotional / event usage", return: "Return", other: "Other authorized correction",
};

export function OperationNotice({ error, saved, detail }: { error?: string; saved?: string; detail?: string | null }) {
  const errors: Record<string, string> = {
    duplicate: "That reference number is already in use.", validation: "Check the required fields, quantity, cost and reason.", insufficient: "There is not enough stock at the selected source location.", "shelf-life": "The selected batch does not meet the retailer agreement minimum shelf-life requirement.", fefo: "The selected batch is not the nearest eligible FEFO batch. Add an override reason to continue.", reference: "The selected product, SKU, batch, location or supplier is archived, expired or not related.", "not-authorized": "Your role cannot perform this stock operation.", "not-configured": "The live database connection is not configured.", database: "The live stock-receiving database is not ready. Apply the Stage 4 migration, then reload the page.", server: "The stock operation could not be completed.",
  };
  const savedMessages: Record<string, string> = { receipt: "Stock received and the immutable ledger was updated.", transfer: "Transfer draft created and audit recorded.", dispatched: "Transfer dispatched; source stock has decreased.", received: "Transfer received; destination stock is now available.", cancelled: "The draft was cancelled without changing stock.", adjustment: "Adjustment saved and its approval state was recorded.", approved: "Adjustment approved and posted to the immutable ledger." };
  const displayError = error === "server" && /could not find|schema cache|does not exist/i.test(detail ?? "") ? "database" : error;
  if (displayError) return <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{errors[displayError] ?? "The request could not be completed."}{detail && (displayError === "server" || displayError === "database") ? <span className="mt-1 block text-xs text-red-700">{detail}</span> : null}</span></div>;
  if (saved) return <div className="flex items-start gap-2.5 rounded-xl border border-forest-100 bg-forest-50 px-4 py-3 text-sm text-forest-800" role="status"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{savedMessages[saved] ?? "Saved and audit recorded."}</div>;
  return null;
}

export function OperationStatus({ status }: { status: string }) {
  const tone = status === "posted" || status === "received" ? "success" : status === "pending" || status === "draft" ? "warning" : status === "cancelled" ? "neutral" : "info";
  return <Badge tone={tone}>{status.replaceAll("_", " ")}</Badge>;
}

export function SubmitOperationButton({ children, pendingLabel = "Processing…", ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <Button {...props} type="submit" disabled={pending || props.disabled}>{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{pending ? pendingLabel : children}</Button>;
}

export function ConfirmAction({ action, id, label, confirm, variant = "secondary" }: { action: (formData: FormData) => void | Promise<void>; id: string; label: string; confirm: string; variant?: ButtonProps["variant"] }) {
  return <form action={action} onSubmit={(event) => { if (!window.confirm(confirm)) event.preventDefault(); }}><input type="hidden" name="id" value={id} /><SubmitOperationButton size="sm" variant={variant}>{label}</SubmitOperationButton></form>;
}

export function ConfirmReasonAction({ action, id, label, confirm, placeholder = "FEFO override reason", variant = "secondary" }: { action: (formData: FormData) => void | Promise<void>; id: string; label: string; confirm: string; placeholder?: string; variant?: ButtonProps["variant"] }) {
  return <form action={action} className="flex flex-wrap items-center justify-end gap-2" onSubmit={(event) => { if (!window.confirm(confirm)) event.preventDefault(); }}><input type="hidden" name="id" value={id} /><input name="overrideReason" className="h-9 min-w-[170px] rounded-xl border bg-white px-2.5 text-xs text-ink outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-100" placeholder={placeholder} /><SubmitOperationButton size="sm" variant={variant}>{label}</SubmitOperationButton></form>;
}

export function SecurityNote({ children }: { children: React.ReactNode }) {
  return <div className={cn("flex items-start gap-2.5 rounded-2xl border border-sage-200 bg-sage-50/70 p-4 text-sm text-forest-900")}><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-forest-700" />{children}</div>;
}
