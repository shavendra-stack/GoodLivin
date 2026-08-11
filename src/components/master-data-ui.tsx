"use client";

import Link from "next/link";
import { Archive, CheckCircle2, CircleAlert, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ServerAction = (formData: FormData) => void | Promise<void>;

export function FilterBar({ action = "", query = "", status = "active", statusOptions = true, children }: { action?: string; query?: string; status?: string; statusOptions?: boolean; children?: React.ReactNode }) {
  return <form action={action} method="get" className="flex flex-col gap-3 rounded-[1.35rem] border border-forest-100/80 bg-white p-4 shadow-soft sm:flex-row sm:flex-wrap sm:items-center"><div className="relative min-w-0 flex-1 sm:min-w-[240px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input name="q" defaultValue={query} placeholder="Search by name, code or contact" className="pl-9" /></div>{statusOptions ? <Select name="status" defaultValue={status} className="sm:w-40"><option value="active">Active only</option><option value="archived">Archived only</option><option value="all">All statuses</option></Select> : null}{children}<Button type="submit" variant="secondary" size="sm">Apply filters</Button>{query || status !== "active" ? <Link href={action || "?"} className="inline-flex h-10 items-center justify-center gap-1 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-ink"><X className="h-4 w-4" />Clear</Link> : null}</form>;
}

export function InlineMessage({ kind = "success", children }: { kind?: "success" | "error" | "info"; children: React.ReactNode }) {
  const styles = { success: "border-forest-100 bg-forest-50 text-forest-800", error: "border-red-100 bg-red-50 text-red-800", info: "border-sky-100 bg-sky-50 text-sky-800" } as const;
  const Icon = kind === "error" ? CircleAlert : CheckCircle2;
  return <div className={cn("flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm shadow-sm", styles[kind])} role={kind === "error" ? "alert" : "status"}><Icon className="mt-0.5 h-4 w-4 shrink-0" />{children}</div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-[1.35rem] border border-dashed border-forest-200 bg-white px-6 py-14 text-center shadow-soft"><Archive className="mx-auto h-8 w-8 text-slate-300" /><h2 className="mt-4 font-display text-lg font-bold text-ink">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p></div>;
}

export function ArchiveButton({ action, id, label = "Archive", recordLabel = "this record", hiddenFields }: { action: ServerAction; id: string; label?: string; recordLabel?: string; hiddenFields?: Record<string, string> }) {
  return <form action={action} onSubmit={(event) => { if (!window.confirm(`Archive ${recordLabel}? It will remain available for history and can no longer be edited as active master data.`)) event.preventDefault(); }}><input type="hidden" name="id" value={id} />{Object.entries(hiddenFields ?? {}).map(([name, value]) => <input type="hidden" name={name} value={value} key={name} />)}<Button type="submit" variant="secondary" size="sm">{label}</Button></form>;
}

export function FormField({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return <label className="block space-y-2"><span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}{required ? <span className="text-red-600"> *</span> : null}</span>{children}{hint ? <span className="block text-xs leading-5 text-slate-400">{hint}</span> : null}</label>;
}
