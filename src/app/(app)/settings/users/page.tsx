import Link from "next/link";
import { ArrowLeft, Info, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getAdminUsers } from "@/lib/data";
import { roleLabel } from "@/lib/roles";
import { formatDate } from "@/lib/utils";
import { DataTable } from "@/components/data-table";
import { InviteUserForm } from "@/components/invite-user-form";
import { RoleAssignmentForm } from "@/components/role-assignment-form";
import { UserFullNameForm } from "@/components/user-full-name-form";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function UserManagementPage({ searchParams }: { searchParams: Promise<{ updated?: string; nameUpdated?: string; invited?: string; demo?: string; error?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;

  if (!user.roles.includes("director_admin")) {
    return (
      <div className="mx-auto max-w-xl pt-12">
        <Card>
          <CardContent className="p-8 text-center">
            <Badge tone="danger">Restricted</Badge>
            <h1 className="mt-4 font-display text-2xl font-bold text-ink">Administrator access required</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">User management is reserved for Director / Admin users.</p>
            <Link className="mt-6 inline-flex text-sm font-semibold text-forest-700" href="/settings">Back to settings</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const users = await getAdminUsers();
  const message = params.nameUpdated
    ? "Full name saved."
    : params.updated
      ? "Role assignment saved."
      : params.invited
        ? "Invitation sent. The user will appear after accepting the invite."
        : params.demo
          ? "Demo mode is read-only; changes are previewed only."
          : params.error
            ? "The request could not be completed. Check the value, Supabase configuration and audit logs."
            : null;

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link href="/settings" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-forest-700">
            <ArrowLeft className="h-4 w-4" />
            Back to settings
          </Link>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Administration</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">User management</h1>
          <p className="mt-2 text-sm text-slate-500">Invite team members, maintain their full names and assign a single least-privilege role.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-forest-100 bg-white p-1.5 dark:bg-charcoal-800">
          <UserPlus className="ml-2 h-4 w-4 text-forest-700" />
          <InviteUserForm />
        </div>
      </div>

      {message ? (
        <div className="flex items-start gap-3 rounded-xl border border-forest-100 bg-forest-50 px-4 py-3 text-sm text-forest-800" role="status">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </div>
      ) : null}

      <div className="hidden xl:block">
        <DataTable
          rows={users}
          rowKey={(row) => row.id}
          columns={[
          {
            key: "user",
            header: "User",
            render: (row) => (
              <div>
                <p className="font-semibold">{row.displayName}</p>
                <p className="mt-1 text-xs text-slate-500">{row.email}</p>
              </div>
            ),
          },
          {
            key: "fullName",
            header: "Edit full name",
            render: (row) => <UserFullNameForm userId={row.id} fullName={row.displayName} />,
          },
          {
            key: "role",
            header: "Current role",
            render: (row) => row.role ? <StatusBadge status={roleLabel(row.role)} /> : <Badge tone="warning">Unassigned</Badge>,
          },
          {
            key: "scope",
            header: "Scope",
            render: (row) => <span className="text-slate-500">{row.retailerId ? "Assigned retailer" : "GoodLivin-wide"}</span>,
          },
          {
            key: "created",
            header: "Created",
            render: (row) => <span className="text-slate-500">{formatDate(row.createdAt)}</span>,
          },
          {
            key: "actions",
            header: "Assign role",
            className: "text-right",
            render: (row) => <RoleAssignmentForm userId={row.id} currentRole={row.role} />,
          },
          ]}
        />
      </div>

      <div className="space-y-3 xl:hidden">
        {users.map((row) => (
          <Card key={row.id}>
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="font-semibold text-ink">{row.displayName}</p>
                <p className="mt-1 break-all text-xs text-slate-500">{row.email}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Full name</p>
                <UserFullNameForm userId={row.id} fullName={row.displayName} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Current role</p>
                {row.role ? <StatusBadge status={roleLabel(row.role)} /> : <Badge tone="warning">Unassigned</Badge>}
                <RoleAssignmentForm userId={row.id} currentRole={row.role} />
              </div>
              <div className="grid gap-3 border-t border-forest-100 pt-3 text-sm sm:grid-cols-2">
                <div><p className="text-xs text-slate-500">Scope</p><p className="mt-1 text-ink">{row.retailerId ? "Assigned retailer" : "GoodLivin-wide"}</p></div>
                <div><p className="text-xs text-slate-500">Created</p><p className="mt-1 text-ink">{formatDate(row.createdAt)}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Full-name and role changes are protected by database RLS and the <code className="rounded bg-slate-100 px-1">set_user_role</code> security-definer function. Every change is audited.
      </p>
    </div>
  );
}
