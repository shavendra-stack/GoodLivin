import { updateUserFullName } from "@/app/(app)/profile/actions";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function UserFullNameForm({ userId, fullName }: { userId: string; fullName: string }) {
  return (
    <form action={updateUserFullName} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`full-name-${userId}`}>
        Full name
      </label>
      <Input
        id={`full-name-${userId}`}
        name="fullName"
        maxLength={160}
        defaultValue={fullName === "Team member" ? "" : fullName}
        placeholder="Full name"
        className="h-9 min-w-[180px] sm:w-52"
      />
      <SubmitButton size="sm" pendingLabel="Saving…">
        Save name
      </SubmitButton>
    </form>
  );
}
