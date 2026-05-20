"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Hammer,
  Users,
  UserCog,
  Landmark,
  Building2,
  CreditCard,
  Handshake,
  FolderTree,
  Repeat,
  BookOpen,
  Settings,
  CalendarCheck,
  TableProperties,
  Building,
  MinusCircle,
  Inbox,
  Banknote,
  Factory,
  ScrollText,
  Wallet,
  Layers,
  GitMerge,
  Tag,
  Plug,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { getCurrentUserProfile } from "@/app/actions/user-profile"
import type { ScopeRole } from "@/lib/auth-server"

const navigation = [
  { name: "ダッシュボード", href: "/dashboard", icon: LayoutDashboard },
  { name: "資金繰り表", href: "/cashflow-table", icon: TableProperties },
]

const inputNavigation = [
  { name: "経費入力", href: "/expenses", icon: Receipt },
  { name: "売上入力", href: "/sales", icon: TrendingUp },
  { name: "原価支払", href: "/costs", icon: Hammer },
  { name: "給与入力", href: "/salary", icon: Users },
  { name: "グループ間入力", href: "/inter-group", icon: GitMerge },
]

const managementNavigation = [
  { name: "現金引出", href: "/cash-withdrawal", icon: Banknote },
  { name: "借入管理", href: "/loans", icon: Landmark },
  { name: "リース管理", href: "/leases", icon: Repeat },
  { name: "納税予定表", href: "/tax-schedule", icon: ScrollText },
  { name: "カード明細", href: "/card-statements", icon: Wallet },
  { name: "定期支払", href: "/recurring", icon: BookOpen },
]

// Phase 3 / 4 / 5: COMPANY_ADMIN+ 専用の管理セクション項目
// SUPER_ADMIN / COMPANY_ADMIN のときのみ表示する
const managementAdminNavigation: Array<{
  name: string
  href: string
  icon: React.ElementType
}> = [
  // Phase 3: ユーザー管理
  { name: "ユーザー", href: "/admin/users", icon: Users },
  // Phase 3: 招待状一覧
  { name: "招待状", href: "/admin/invitations", icon: Inbox },
  // Phase 4: 監査ログ
  { name: "監査ログ", href: "/admin/audit", icon: ScrollText },
  // Phase 4: 月締め状況
  { name: "月締め状況", href: "/admin/month-close", icon: CalendarCheck },
  // Phase 5: PWDX 連携
  { name: "PWDX 連携", href: "/admin/pwdx", icon: Plug },
]

// Phase 2: SUPER_ADMIN 専用のシステム管理セクション
// TODO: ScopeRole = SUPER_ADMIN のときだけ表示する条件分岐を追加 (現在は無条件表示)
const systemAdminNavigation = [
  { name: "申請一覧", href: "/admin/system/applications", icon: Inbox },
]

const masterNavigation = [
  { name: "会社一覧", href: "/master/companies", icon: Building2 },
  { name: "会社グループ", href: "/master/company-groups", icon: Layers },
  { name: "銀行口座", href: "/master/accounts", icon: CreditCard },
  { name: "業種", href: "/master/industries", icon: Factory },
  { name: "売上項目", href: "/master/sales-items", icon: Tag },
  { name: "取引先", href: "/master/partners", icon: Handshake },
  { name: "給与グループ", href: "/master/payroll-groups", icon: UserCog },
  { name: "勘定科目", href: "/master/categories", icon: FolderTree },
  { name: "控除カテゴリ", href: "/master/deduction-categories", icon: MinusCircle },
  { name: "設定", href: "/master/settings", icon: Settings },
]

function NavItem({ item, pathname }: { item: { name: string; href: string; icon: React.ElementType }; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.name}
    </Link>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const [scopeRole, setScopeRole] = useState<ScopeRole | null>(null)

  useEffect(() => {
    let cancelled = false
    getCurrentUserProfile()
      .then((p) => {
        if (!cancelled) setScopeRole(p?.scopeRole ?? null)
      })
      .catch(() => {
        if (!cancelled) setScopeRole(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const isCompanyAdminPlus =
    scopeRole === "SUPER_ADMIN" || scopeRole === "COMPANY_ADMIN"

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
          <Landmark className="h-5 w-5" />
          経理くん
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => (
          <NavItem key={item.href} item={item} pathname={pathname} />
        ))}
        <Separator className="my-3" />
        <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">入力</p>
        {inputNavigation.map((item) => (
          <NavItem key={item.href} item={item} pathname={pathname} />
        ))}
        <Separator className="my-3" />
        <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">管理</p>
        {managementNavigation.map((item) => (
          <NavItem key={item.href} item={item} pathname={pathname} />
        ))}
        {isCompanyAdminPlus &&
          managementAdminNavigation.map((item) => (
            <NavItem key={item.href} item={item} pathname={pathname} />
          ))}
        <Separator className="my-3" />
        <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">マスタ</p>
        {masterNavigation.map((item) => (
          <NavItem key={item.href} item={item} pathname={pathname} />
        ))}
        <Separator className="my-3" />
        <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">システム管理</p>
        {systemAdminNavigation.map((item) => (
          <NavItem key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    </aside>
  )
}
