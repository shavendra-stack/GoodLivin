import Link from "next/link";
import { Bell, Save, Settings2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { alertTypeLabel, getAlertWorkspace } from "@/lib/alerts";
import { ROLE_CODES, ROLE_LABELS } from "@/lib/roles";
import { saveAlertRule } from "@/app/(app)/notifications/actions";
import { EmptyState, FormField, InlineMessage } from "@/components/master-data-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type SearchParams = Promise<{ saved?: string; error?: string; demo?: string }>;

const tabs = [
  { href: "/notifications", label: "Alert centre" },
  { href: "/notifications/rules", label: "Alert rules" },
  { href: "/notifications/automation", label: "Automation history" },
  { href: "/notifications/approvals", label: "Approval inbox" },
] as const;

function AlertTabs() {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-2xl border border-forest-100/80 bg-white p-1 shadow-soft dark:bg-charcoal-800">
      {tabs.map((tab) => <Link key={tab.href} href={tab.href} className={tab.href === "/notifications/rules" ? "whitespace-nowrap rounded-xl bg-forest-700 px-3 py-2 text-sm font-semibold text-white" : "whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-forest-50 hover:text-forest-800 dark:hover:bg-charcoal-700"}>{tab.label}</Link>)}
    </div>
  );
}

export default async function AlertRulesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const workspace = await getAlertWorkspace(user, { status: "all" });
  const canManageRules = user.roles.some((role) => ["director_admin", "inventory_manager", "sales_manager"].includes(role));
  const notice = params.error ? <InlineMessage kind="error">{decodeURIComponent(params.error)}</InlineMessage>
    : params.demo ? <InlineMessage kind="info">Demo mode is read-only; this screen is a preview.</InlineMessage>
      : params.saved ? <InlineMessage>{decodeURIComponent(params.saved)}</InlineMessage>
        : null;

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Stage 8 · Alert settings</p>
        <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-bold tracking-tight text-ink"><Settings2 className="h-8 w-8 text-forest-700" />Alert rules</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Tune launch-safe defaults for stock thresholds, expiry windows, retailer reporting, supplier delivery reminders and payment reminders. Existing data and ledger records are never changed by these settings.</p>
      </div>

      <AlertTabs />
      {notice}
      {workspace.error ? <InlineMessage kind="error">{workspace.error}</InlineMessage> : null}
      {!canManageRules ? <InlineMessage kind="info">Your role can view alert rules, but only Director/Admin and permitted managers can change them.</InlineMessage> : null}

      {workspace.rules.length === 0 ? (
        <EmptyState title="No alert rules found" description="Run the Stage 8 migration in Supabase to create the default alert rules." />
      ) : (
        <div className="grid gap-4">
          {workspace.rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={rule.enabled ? "success" : "neutral"}>{rule.enabled ? "Enabled" : "Disabled"}</Badge>
                    <Badge tone={rule.priority === "critical" ? "danger" : rule.priority === "high" ? "warning" : "info"}>{rule.priority}</Badge>
                    <Badge tone="sage">{alertTypeLabel(rule.alertType)}</Badge>
                  </div>
                  <CardTitle className="mt-3">{rule.name}</CardTitle>
                  <CardDescription className="mt-2">{rule.description ?? rule.ruleCode}</CardDescription>
                </div>
                <p className="text-xs text-slate-400">Rule code: {rule.ruleCode}</p>
              </CardHeader>
              <CardContent>
                <form action={saveAlertRule} className="grid gap-4 lg:grid-cols-4">
                  <input type="hidden" name="id" value={rule.id} />
                  <label className="flex items-center gap-2 rounded-2xl border border-slate-100 p-3 text-sm font-semibold text-ink dark:border-charcoal-700">
                    <input name="enabled" type="checkbox" defaultChecked={rule.enabled} className="h-4 w-4 rounded border-slate-300 text-forest-700" disabled={!canManageRules} />
                    Enabled
                  </label>
                  <FormField label="Priority">
                    <Select name="priority" defaultValue={rule.priority} disabled={!canManageRules}>
                      <option value="informational">Informational</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </Select>
                  </FormField>
                  <FormField label="Minimum stock">
                    <Input name="minimumStockLevel" type="number" min="0" step="1" defaultValue={rule.minimumStockLevel ?? ""} disabled={!canManageRules} />
                  </FormField>
                  <FormField label="Target stock">
                    <Input name="targetStockLevel" type="number" min="0" step="1" defaultValue={rule.targetStockLevel ?? ""} disabled={!canManageRules} />
                  </FormField>
                  <FormField label="Reorder point">
                    <Input name="reorderPoint" type="number" min="0" step="1" defaultValue={rule.reorderPoint ?? ""} disabled={!canManageRules} />
                  </FormField>
                  <FormField label="Expiry warning days">
                    <Input name="expiryWarningDays" type="number" min="0" step="1" defaultValue={rule.expiryWarningDays ?? ""} disabled={!canManageRules} />
                  </FormField>
                  <FormField label="Minimum shelf life days">
                    <Input name="minimumShelfLifeDays" type="number" min="0" step="1" defaultValue={rule.minimumShelfLifeDays ?? ""} disabled={!canManageRules} />
                  </FormField>
                  <FormField label="Retailer report overdue days">
                    <Input name="retailerSalesReportOverdueDays" type="number" min="0" step="1" defaultValue={rule.retailerSalesReportOverdueDays ?? ""} disabled={!canManageRules} />
                  </FormField>
                  <FormField label="Supplier reminder days">
                    <Input name="supplierOrderReminderDays" type="number" min="0" step="1" defaultValue={rule.supplierOrderReminderDays ?? ""} disabled={!canManageRules} />
                  </FormField>
                  <FormField label="PO payment reminder days">
                    <Input name="purchaseOrderPaymentReminderDays" type="number" min="0" step="1" defaultValue={rule.purchaseOrderPaymentReminderDays ?? ""} disabled={!canManageRules} />
                  </FormField>
                  <div className="space-y-2 lg:col-span-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Recipient roles</p>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {ROLE_CODES.filter((role) => role !== "retailer_user").map((role) => (
                        <label key={role} className="flex items-center gap-2 rounded-xl border border-slate-100 p-3 text-sm text-ink dark:border-charcoal-700">
                          <input name="recipientRoles" type="checkbox" value={role} defaultChecked={rule.recipientRoles.includes(role)} disabled={!canManageRules} className="h-4 w-4 rounded border-slate-300 text-forest-700" />
                          {ROLE_LABELS[role]}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end lg:col-span-4">
                    <Button type="submit" disabled={!canManageRules}><Save className="h-4 w-4" />Save rule</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-forest-700" />Safe defaults</CardTitle>
          <CardDescription>Rules can be rerun from the migration safely. Existing customized rules are not overwritten by rerunning the Stage 8 SQL.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
