import { cn } from "@/lib/utils";

const styles = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  sage: "bg-forest-50 text-forest-700 ring-forest-600/20",
} as const;

export type BadgeTone = keyof typeof styles;

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset", styles[tone], className)}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />{children}</span>;
}
