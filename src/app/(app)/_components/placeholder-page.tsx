import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PlaceholderPage({ title, description, nextStage = "Stage 2" }: { title: string; description: string; nextStage?: string }) {
  return <div className="mx-auto flex min-h-[calc(100vh-170px)] max-w-3xl items-center justify-center"><Card className="w-full overflow-hidden"><CardContent className="p-8 sm:p-12"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-700"><Construction className="h-7 w-7" /></div><Badge className="mt-7" tone="info">Secure route</Badge><h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink">{title}</h1><p className="mt-4 max-w-xl text-base leading-7 text-slate-500">{description}</p><div className="mt-8 rounded-2xl border border-dashed border-forest-200 bg-forest-50/60 p-5"><p className="text-sm font-semibold text-forest-900">Roadmap · {nextStage}</p><p className="mt-1 text-sm leading-6 text-forest-800/80">This route is protected and ready for its approved workflow. Current actions remain intentionally unavailable.</p></div><Link href="/dashboard" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-forest-700 hover:text-forest-900"><ArrowLeft className="h-4 w-4" />Back to dashboard <ArrowUpRight className="ml-1 h-4 w-4" /></Link></CardContent></Card></div>;
}
