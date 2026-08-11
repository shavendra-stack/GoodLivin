import Link from "next/link";
import { ArrowUpRight, UserRound, UsersRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Workspace controls</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">Manage your profile and the controls available to your role.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Link href="/profile">
          <Card className="h-full transition hover:-translate-y-0.5 hover:border-forest-200">
            <CardHeader>
              <UserRound className="h-6 w-6 text-forest-700" />
              <CardTitle className="mt-3">Your profile</CardTitle>
              <CardDescription>Update your full name and review your account scope.</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700">Edit profile <ArrowUpRight className="h-4 w-4" /></span>
            </CardContent>
          </Card>
        </Link>

        {user.roles.includes("director_admin") ? (
          <Link href="/settings/users">
            <Card className="h-full transition hover:-translate-y-0.5 hover:border-forest-200">
              <CardHeader>
                <UsersRound className="h-6 w-6 text-forest-700" />
                <CardTitle className="mt-3">User & role management</CardTitle>
                <CardDescription>Maintain team member names and assign the least-privilege role needed for each person.</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700">Open administration <ArrowUpRight className="h-4 w-4" /></span>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card>
            <CardHeader>
              <Badge tone="neutral">Restricted</Badge>
              <CardTitle className="mt-3">Administration</CardTitle>
              <CardDescription>Only Director / Admin users can manage people and role assignments.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
