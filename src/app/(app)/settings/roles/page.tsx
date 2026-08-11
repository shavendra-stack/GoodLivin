import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getRoleSummaries } from "@/lib/data";
import { ROLE_LABELS } from "@/lib/roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function RoleManagementPage() {
  const user = await requireUser();
  if (!user.roles.includes("director_admin")) return <div className="mx-auto max-w-xl pt-12"><Card><CardContent className="p-8 text-center"><Badge tone="danger">Restricted</Badge><h1 className="mt-4 font-display text-2xl font-bold text-ink">Administrator access required</h1><p className="mt-2 text-sm leading-6 text-slate-500">Role management is reserved for Director / Admin users.</p><Link className="mt-6 inline-flex text-sm font-semibold text-forest-700" href="/settings">Back to settings</Link></CardContent></Card></div>;
  const roles = await getRoleSummaries();
  return <div className="space-y-7"><div><Link href="/settings/users" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-forest-700"><ArrowLeft className="h-4 w-4" />Back to users</Link><p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Administration</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">Role management</h1><p className="mt-2 text-sm text-slate-500">A reference view of the access model used by GoodLivin.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{roles.map((role) => <Card key={role.code}><CardHeader><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-50 text-forest-700"><ShieldCheck className="h-5 w-5" /></div><Badge tone={role.userCount ? "sage" : "neutral"}>{role.userCount} users</Badge></div><CardTitle className="mt-3">{role.label || ROLE_LABELS[role.code]}</CardTitle><CardDescription>{role.description}</CardDescription></CardHeader><CardContent><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Role code</p><code className="mt-2 inline-block rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">{role.code}</code></CardContent></Card>)}</div><div className="rounded-2xl border border-forest-100 bg-forest-50/60 p-5 text-sm leading-6 text-forest-800"><strong>Least privilege by default.</strong> Permissions are stored as database records and checked through RLS policies, so navigation visibility is only a usability aid—not a security boundary.</div></div>;
}
