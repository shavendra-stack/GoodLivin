"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightLeft, BarChart3, Bell, Boxes, CalendarClock, ChevronRight, ClipboardCheck, ClipboardList, ClipboardPenLine, Factory, FileBarChart, History, LayoutDashboard, LogOut, Menu, PackageCheck, PackageSearch, PanelLeftClose, PanelLeftOpen, RotateCcw, Settings, ShieldCheck, ShoppingBag, ShoppingCart, Store, Truck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { type CurrentUser } from "@/lib/auth";
import { cn, initials } from "@/lib/utils";
import { roleLabel, type RoleCode } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = { label: string; href: string; icon: LucideIcon; roles?: RoleCode[] };
const operationsRoles: RoleCode[] = ["director_admin", "inventory_manager", "warehouse_staff", "finance_team", "sales_manager", "auditor_read_only"];
const procurementRoles: RoleCode[] = ["director_admin", "inventory_manager", "warehouse_staff", "finance_team", "sales_manager", "auditor_read_only"];
const reportingRoles: RoleCode[] = ["director_admin", "inventory_manager", "warehouse_staff", "finance_team", "sales_manager", "auditor_read_only"];

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Products", href: "/products", icon: PackageSearch },
  { label: "Batches & Expiry", href: "/batches", icon: Boxes, roles: operationsRoles },
  { label: "Live Inventory", href: "/inventory", icon: ClipboardCheck, roles: ["director_admin", "inventory_manager", "warehouse_staff", "retailer_user", "auditor_read_only"] },
  { label: "Receiving", href: "/receiving", icon: PackageCheck, roles: ["director_admin", "inventory_manager", "warehouse_staff", "finance_team", "auditor_read_only"] },
  { label: "Transfers", href: "/transfers", icon: ArrowRightLeft, roles: ["director_admin", "inventory_manager", "warehouse_staff", "auditor_read_only"] },
  { label: "Adjustments", href: "/adjustments", icon: ClipboardPenLine, roles: ["director_admin", "inventory_manager", "warehouse_staff", "auditor_read_only"] },
  { label: "Movement History", href: "/movements", icon: History, roles: operationsRoles },
  { label: "Sales & Orders", href: "/sales", icon: ShoppingCart, roles: ["director_admin", "inventory_manager", "warehouse_staff", "finance_team", "sales_manager", "auditor_read_only"] },
  { label: "Returns & Refunds", href: "/returns", icon: RotateCcw, roles: ["director_admin", "inventory_manager", "warehouse_staff", "auditor_read_only"] },
  { label: "Sell-through", href: "/sell-through", icon: BarChart3, roles: ["director_admin", "inventory_manager", "finance_team", "sales_manager", "auditor_read_only"] },
  { label: "Retailers", href: "/retailers", icon: Store, roles: ["director_admin", "sales_manager", "retailer_user", "auditor_read_only"] },
  { label: "Free-Product Requests", href: "/free-product-requests", icon: ShoppingBag, roles: ["director_admin", "sales_manager", "retailer_user", "auditor_read_only"] },
  { label: "Replenishment", href: "/replenishment", icon: ChevronRight, roles: ["director_admin", "inventory_manager", "sales_manager", "retailer_user", "auditor_read_only"] },
  { label: "Purchase Orders", href: "/purchase-orders", icon: ClipboardList, roles: procurementRoles },
  { label: "Inbound Stock", href: "/inbound", icon: CalendarClock, roles: procurementRoles },
  { label: "Suppliers", href: "/products/suppliers", icon: Truck, roles: procurementRoles },
  { label: "Production", href: "/production", icon: Factory, roles: ["director_admin", "auditor_read_only"] },
  { label: "Stock Counts", href: "/stock-counts", icon: ClipboardCheck, roles: ["director_admin", "inventory_manager", "warehouse_staff", "retailer_user", "auditor_read_only"] },
  { label: "Reports", href: "/reports", icon: FileBarChart, roles: reportingRoles },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

function isActive(pathname: string, href: string) { return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`)); }

function Sidebar({ user, collapsed, onNavigate, onToggle }: { user: CurrentUser; collapsed?: boolean; onNavigate?: () => void; onToggle?: () => void }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => !item.roles || item.roles.some((role) => user.roles.includes(role)));
  return <aside className={cn("flex h-full w-full flex-col border-r border-forest-100/80 bg-white/90 px-3 py-4 backdrop-blur-xl dark:bg-charcoal-800/95", collapsed ? "items-center" : "")}>
    <div className={cn("flex w-full items-center gap-3 px-2", collapsed ? "justify-center" : "justify-between")}><Link href="/dashboard" onClick={onNavigate} className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-forest-700 font-display text-lg font-bold text-white shadow-md shadow-forest-900/15">G</div>{!collapsed ? <div className="min-w-0"><p className="truncate font-display text-lg font-bold tracking-tight text-ink">GoodLivin</p><p className="truncate text-[9px] font-bold uppercase tracking-[0.22em] text-forest-500">Inventory workspace</p></div> : null}</Link>{onToggle ? <button type="button" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="hidden rounded-lg p-2 text-slate-400 transition hover:bg-forest-50 hover:text-forest-700 xl:block">{collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}</button> : null}</div>
    <div className={cn("mt-7 flex-1 space-y-1 overflow-y-auto", collapsed ? "w-full" : "w-full")}><p className={cn("mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400", collapsed ? "sr-only" : "")}>Workspace</p>{visibleItems.map((item) => { const active = isActive(pathname, item.href); const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={onNavigate} title={collapsed ? item.label : undefined} className={cn("group flex items-center rounded-xl py-2.5 text-sm font-semibold transition-all duration-200", collapsed ? "justify-center px-2" : "gap-3 px-3", active ? "bg-forest-700 text-white shadow-sm shadow-forest-900/15" : "text-slate-600 hover:bg-forest-50 hover:text-forest-800 dark:text-slate-300 dark:hover:bg-charcoal-700 dark:hover:text-white")}><Icon className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-[18px] w-[18px]")} /><span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>{active && !collapsed ? <ChevronRight className="ml-auto h-4 w-4 opacity-70" /> : null}</Link>; })}{user.roles.includes("director_admin") ? <div className="pt-6"><p className={cn("mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400", collapsed ? "sr-only" : "")}>Administration</p><Link href="/settings/users" onClick={onNavigate} title={collapsed ? "User management" : undefined} className={cn("group flex items-center rounded-xl py-2.5 text-sm font-semibold transition-all", collapsed ? "justify-center px-2" : "gap-3 px-3", pathname.startsWith("/settings/users") ? "bg-forest-700 text-white" : "text-slate-600 hover:bg-forest-50 hover:text-forest-800 dark:text-slate-300 dark:hover:bg-charcoal-700 dark:hover:text-white")}><Users className="h-[18px] w-[18px] shrink-0" /><span className={collapsed ? "sr-only" : "truncate"}>User management</span></Link><Link href="/settings/roles" onClick={onNavigate} title={collapsed ? "Role management" : undefined} className={cn("group mt-1 flex items-center rounded-xl py-2.5 text-sm font-semibold transition-all", collapsed ? "justify-center px-2" : "gap-3 px-3", pathname.startsWith("/settings/roles") ? "bg-forest-700 text-white" : "text-slate-600 hover:bg-forest-50 hover:text-forest-800 dark:text-slate-300 dark:hover:bg-charcoal-700 dark:hover:text-white")}><ShieldCheck className="h-[18px] w-[18px] shrink-0" /><span className={collapsed ? "sr-only" : "truncate"}>Role management</span></Link></div> : null}</div>
    <div className={cn("w-full rounded-2xl bg-forest-50 p-3 dark:bg-charcoal-700", collapsed ? "flex justify-center" : "")}><div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "")}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-200 text-xs font-bold text-forest-800">{initials(user.displayName)}</div>{!collapsed ? <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{user.displayName}</p><p className="truncate text-xs text-slate-500">{roleLabel(user.roles[0])}</p></div> : null}</div>{!collapsed ? <Badge className="mt-3" tone={user.isDemo ? "warning" : "success"}>{user.isDemo ? "Demo workspace" : "Secure session"}</Badge> : null}</div>
  </aside>;
}

const mobileItems = navItems.filter((item) => ["/dashboard", "/sales", "/inventory", "/notifications"].includes(item.href));

export function AppShell({ user, unreadAlertCount = 0, children }: { user: CurrentUser; unreadAlertCount?: number; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const currentItem = navItems.find((item) => isActive(pathname, item.href));
  const visibleMobileItems = mobileItems.filter((item) => !item.roles || item.roles.some((role) => user.roles.includes(role)));

  async function signOut() { const supabase = createBrowserSupabaseClient(); if (supabase) await supabase.auth.signOut(); router.push("/login"); router.refresh(); }

  return <div className="min-h-screen bg-canvas"><div className={cn("hidden transition-[width] duration-200 lg:fixed lg:inset-y-0 lg:flex", collapsed ? "lg:w-[84px]" : "lg:w-[272px]")}><Sidebar user={user} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} /></div>{mobileOpen ? <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}><div className="h-full w-[292px] max-w-[86vw]" onClick={(event) => event.stopPropagation()}><Sidebar user={user} onNavigate={() => setMobileOpen(false)} /></div></div> : null}<div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[84px]" : "lg:pl-[272px]")}><header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-forest-100/80 bg-canvas/90 px-4 backdrop-blur-xl sm:px-7 lg:px-8"><div className="flex min-w-0 items-center gap-3"><Button className="lg:hidden" variant="ghost" size="sm" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button><div className="min-w-0"><p className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-forest-600 sm:block">GoodLivin · Operations hub</p><h2 className="truncate font-display text-lg font-bold tracking-tight text-ink sm:mt-1 sm:text-xl">{currentItem?.label ?? "Operations hub"}</h2></div></div><div className="flex items-center gap-1 sm:gap-2"><ThemeToggle /><Link href="/notifications" className="relative rounded-xl p-2.5 text-slate-500 transition hover:bg-white hover:text-forest-700 dark:hover:bg-charcoal-700" aria-label={unreadAlertCount > 0 ? `${unreadAlertCount} unread alerts` : "Notifications"}><Bell className="h-[18px] w-[18px]" />{unreadAlertCount > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">{unreadAlertCount > 99 ? "99+" : unreadAlertCount}</span> : <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-slate-300" />}</Link><div className="mx-1 hidden h-7 w-px bg-forest-100 sm:block" /><div className="hidden items-center gap-2 sm:flex"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-100 text-xs font-bold text-forest-800">{initials(user.displayName)}</div><span className="max-w-[150px] truncate text-sm font-semibold text-ink">{user.displayName}</span></div><Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={signOut}><LogOut className="h-4 w-4" />Sign out</Button><Button variant="ghost" size="sm" className="sm:hidden" aria-label="Sign out" onClick={signOut}><LogOut className="h-4 w-4" /></Button></div></header><main className="mx-auto min-h-[calc(100vh-72px)] max-w-[1640px] px-4 py-5 pb-24 sm:px-7 sm:py-7 lg:px-8 lg:pb-10">{children}</main><nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-4 rounded-2xl border border-forest-100/80 bg-white/95 p-1.5 shadow-lift backdrop-blur-xl dark:bg-charcoal-800/95 lg:hidden">{visibleMobileItems.map((item) => { const Icon = item.icon; const active = isActive(pathname, item.href); const showCount = item.href === "/notifications" && unreadAlertCount > 0; return <Link key={item.href} href={item.href} className={cn("relative flex min-w-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold transition", active ? "bg-forest-700 text-white shadow-sm" : "text-slate-500 hover:bg-forest-50 hover:text-forest-800 dark:text-slate-300 dark:hover:bg-charcoal-700")}><Icon className="h-4 w-4" />{showCount ? <span className="absolute right-3 top-1 h-2 w-2 rounded-full bg-amber-500" /> : null}<span className="max-w-full truncate">{item.label === "Batches & Expiry" ? "Batches" : item.label}</span></Link>; })}</nav></div></div>;
}
