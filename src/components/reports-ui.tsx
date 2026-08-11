import Link from "next/link";
import { ArrowUpRight, Download, FileBarChart, LockKeyhole, type LucideIcon } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { REPORT_ROW_LIMIT, REPORT_TIME_ZONE, type ReportAccess, type ReportFilters, type ReportKind } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const reportLinks: Array<{ href: string; kind: ReportKind; title: string; description: string }> = [
  { href: "/reports/inventory", kind: "inventory", title: "Inventory reports", description: "Live balances, locations, conditions, batch expiry and movement history." },
  { href: "/reports/sales", kind: "sales", title: "Sales reports", description: "Completed sales, refunds, channel mix, product velocity and trend." },
  { href: "/reports/retailers", kind: "retailers", title: "Retailer performance", description: "Branch holdings, sell-through, sales rate and replenishment suggestions." },
  { href: "/reports/purchasing", kind: "purchasing", title: "Purchasing & supplier", description: "Purchase orders, incoming stock, receipt variance and payment milestones." },
  { href: "/reports/valuation", kind: "valuation", title: "Stock valuation", description: "On-hand value by SKU, location, batch and stock condition." },
  { href: "/reports/expiry", kind: "expiry", title: "Expiry & wastage", description: "Expiry windows, damaged/quarantined/rejected stock and FEFO risks." },
  { href: "/reports/traceability", kind: "traceability", title: "Batch traceability", description: "Follow a batch through receiving, balances, transfers, sales and returns." },
];

export function ReportPageHeader({
  eyebrow,
  title,
  description,
  icon: Icon = FileBarChart,
  generatedAt,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  generatedAt?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">{eyebrow}</p>
        <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-bold tracking-tight text-ink">
          <Icon className="h-8 w-8 text-forest-700" />
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
        {generatedAt ? <p className="mt-2 text-xs text-slate-400">Generated {formatDateTime(generatedAt)} · Timezone {REPORT_TIME_ZONE}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function MetricCard({ label, value, detail, tone = "default" }: { label: string; value: React.ReactNode; detail?: React.ReactNode; tone?: "default" | "success" | "warning" | "danger" | "info" }) {
  const toneClass = {
    default: "text-ink",
    success: "text-forest-800",
    warning: "text-amber-700",
    danger: "text-red-700",
    info: "text-sky-700",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-slate-500">{label}</p>
        <p className={cn("mt-2 min-w-0 break-words font-display text-2xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere] 2xl:text-3xl", toneClass)}>{value}</p>
        {detail ? <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

export function AccessDenied({ title = "Report restricted", description }: { title?: string; description: string }) {
  return (
    <Card className="border-amber-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-amber-700" />{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export function CalculationNote({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-forest-100 bg-forest-50/60 p-4 text-sm leading-6 text-forest-800">{children}</div>;
}

export function ExportLink({ kind, filters, enabled }: { kind: ReportKind; filters: ReportFilters; enabled: boolean }) {
  if (!enabled) {
    return <Button type="button" variant="secondary" disabled><Download className="h-4 w-4" />Export restricted</Button>;
  }
  const params = new URLSearchParams();
  params.set("type", kind);
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "all") params.set(key, value);
  });
  return <Link href={`/reports/export?${params.toString()}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 transition hover:bg-forest-50"><Download className="h-4 w-4" />Export CSV</Link>;
}

export function ReportNav({ access }: { access: ReportAccess }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reportLinks.map((link) => {
        const allowed = access[link.kind];
        return (
          <Link key={link.href} href={allowed ? link.href : "/reports"} className={cn("group rounded-[1.35rem] border bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift", allowed ? "border-forest-100/80 hover:border-forest-200" : "border-slate-100 opacity-70")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold text-ink">{link.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{link.description}</p>
              </div>
              {allowed ? <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-forest-700" /> : <LockKeyhole className="h-4 w-4 text-slate-300" />}
            </div>
            <Badge tone={allowed ? "success" : "neutral"} className="mt-4">{allowed ? "Available" : "Restricted"}</Badge>
          </Link>
        );
      })}
    </div>
  );
}

export function SimpleBarList({ rows, valueLabel = "units", maxRows = 6 }: { rows: Array<{ id: string; label: string; value: number; detail?: string }>; valueLabel?: string; maxRows?: number }) {
  const visible = rows.slice(0, maxRows);
  const max = Math.max(...visible.map((row) => row.value), 1);
  return (
    <div className="space-y-3">
      {visible.length === 0 ? <p className="text-sm text-slate-500">No report rows yet.</p> : visible.map((row) => (
        <div key={row.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{row.label}</p>
              {row.detail ? <p className="truncate text-xs text-slate-500">{row.detail}</p> : null}
            </div>
            <p className="shrink-0 font-semibold text-forest-700">{row.value.toLocaleString()} {valueLabel}</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-forest-50">
            <div className="h-full rounded-full bg-forest-600" style={{ width: `${Math.max(4, Math.min(100, (row.value / max) * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportLimitNote() {
  return <p className="text-xs leading-5 text-slate-400">Large reports are safely limited to the latest {REPORT_ROW_LIMIT.toLocaleString()} rows per source table in this stage.</p>;
}
