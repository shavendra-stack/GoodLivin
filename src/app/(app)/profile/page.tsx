import Link from "next/link";
import { ArrowLeft, Mail, ShieldCheck, Store } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { roleLabel } from "@/lib/roles";
import { FALLBACK_DISPLAY_NAME, initials } from "@/lib/utils";
import { updateOwnProfile } from "@/app/(app)/profile/actions";
import { AuditInfo } from "@/components/audit-info";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";

type ProfileSearchParams = Promise<{
  saved?: string;
  demo?: string;
  error?: string;
}>;

export default async function ProfilePage({ searchParams }: { searchParams: ProfileSearchParams }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const message = params.saved
    ? { text: "Your full name has been saved.", kind: "status" }
    : params.demo
      ? { text: "Demo mode is read-only; changes are previewed only.", kind: "status" }
      : params.error
        ? { text: "The full name could not be saved. Check the value and try again.", kind: "error" }
        : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700">
        <ArrowLeft className="h-4 w-4" />
        Back to settings
      </Link>

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Account</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">Your profile</h1>
        <p className="mt-2 text-sm text-slate-500">Your account identity and access scope.</p>
      </div>

      {message ? (
        <div
          className={message.kind === "error" ? "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" : "rounded-xl border border-forest-100 bg-forest-50 px-4 py-3 text-sm text-forest-800"}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-forest-100 font-display text-xl font-bold text-forest-800">
              {initials(user.displayName)}
            </div>
            <div>
              <CardTitle>{user.displayName}</CardTitle>
              <CardDescription>{user.isDemo ? "Demo workspace account" : "GoodLivin team member"}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form action={updateOwnProfile} className="space-y-4">
            <div>
              <label htmlFor="profile-full-name" className="text-sm font-semibold text-ink">
                Full name
              </label>
              <Input
                id="profile-full-name"
                name="fullName"
                maxLength={160}
                defaultValue={user.displayName === FALLBACK_DISPLAY_NAME ? "" : user.displayName}
                placeholder="Your full name"
                className="mt-2"
              />
              <p className="mt-2 text-xs text-slate-500">This name appears in greetings, navigation, audit context and team administration.</p>
            </div>
            <div className="flex justify-end">
              <SubmitButton pendingLabel="Saving profile…">Save profile</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>Your email remains separate from your editable full name.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-charcoal-700">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <Mail className="h-4 w-4" />
              Email
            </div>
            <p className="mt-2 break-all text-sm font-semibold text-ink">{user.email}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-charcoal-700">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              Primary role
            </div>
            <p className="mt-2 text-sm font-semibold text-ink">{roleLabel(user.roles[0])}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2 dark:bg-charcoal-700">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <Store className="h-4 w-4" />
              Retailer scope
            </div>
            <p className="mt-2 text-sm font-semibold text-ink">{user.retailerId ?? "GoodLivin-wide access"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access roles</CardTitle>
          <CardDescription>Permissions are enforced in the app and at the database layer.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {user.roles.length ? user.roles.map((role) => <Badge key={role} tone="sage">{roleLabel(role)}</Badge>) : <Badge tone="warning">No role assigned</Badge>}
        </CardContent>
      </Card>

      <AuditInfo actor={user.displayName} reason="Profile details are sourced from the authenticated session." />
    </div>
  );
}
