import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getUnreadAlertCount } from "@/lib/alerts";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const unreadAlertCount = await getUnreadAlertCount(user);
  return <AppShell user={user} unreadAlertCount={unreadAlertCount}>{children}</AppShell>;
}
