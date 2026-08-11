import { assignRole } from "@/app/(app)/settings/users/actions";
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from "@/lib/roles";
import { Button } from "@/components/ui/button";

export function RoleAssignmentForm({ userId, currentRole }: { userId: string; currentRole: RoleCode | null }) {
  return <form action={assignRole} className="flex flex-wrap items-center justify-end gap-2"><input type="hidden" name="userId" value={userId} /><label className="sr-only" htmlFor={`role-${userId}`}>Assign role</label><select id={`role-${userId}`} name="roleCode" defaultValue={currentRole ?? ""} required className="h-9 max-w-full rounded-lg border bg-white px-2.5 text-xs font-medium text-ink outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-100"><option value="" disabled>Select role</option>{ROLE_CODES.map((code) => <option key={code} value={code}>{ROLE_LABELS[code]}</option>)}</select><Button size="sm" type="submit">Save</Button></form>;
}
