import { inviteUser } from "@/app/(app)/settings/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteUserForm() {
  return <form action={inviteUser} className="flex flex-col gap-2 sm:flex-row sm:items-center"><label className="sr-only" htmlFor="invite-email">User email</label><Input id="invite-email" name="email" type="email" required placeholder="new.user@goodlivin.lk" className="sm:w-64" /><Button type="submit">Send invite</Button></form>;
}
