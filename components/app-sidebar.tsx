"use client"

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
  FileText,
  Building2,
  CreditCard,
  Handshake,
  FolderTree,
  Repeat,
  BookOpen,
  Settings,
  CalendarCheck,
  TableProperties,
  ArrowRightLeft,
  Building,
  MinusCircle,
  Inbox,
  Banknote,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CompanySwitcher } from "@/components/company-switcher"
import { Separator } from "@/components/ui/separator"

const navigation = [
  { name: "ダッシュボード", href: "/dashboard", icon: LayoutDashboard },
  { name: "資金繰り表", href: "/cashflow-table", icon: TableProperties },
  { name: "資金移動", href: "/cashflow", icon: ArrowRightLeft },
]

const inputNavigation = [
  { name: "経費入力", href: "/expenses", icon: Receipt },
  { name: "経費確定BOX", href: "/expense-box", icon: Inbox },
  { name: "売上入力", href: "/sales", icon: TrendingUp },
  { name: "原価支払", href: "/costs", icon: Hammer },
  { name: "給与入力", href: "/salary", icon: Users },
]

const managementNavigation = [
  { name: "現金引出", href: "/cash-withdrawal", icon: Banknote },
  { name: "借入管理", href: "/loans", icon: Landmark },
  { name: "リース管理", href: "/leases", icon: Repeat },
  { name: "定期テンプレート", href: "/recurring", icon: BookOpen },
  { name: "月次処理", href: "/monthly-close", icon: CalendarCheck },
]

const masterNavigation = [
  { name: "会社一覧", href: "/master/companies", icon: Building2 },
  { name: "銀行口座", href: "/master/accounts", icon: CreditCard },
  { name: "銀行・支店", href: "/master/banks", icon: Building },
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

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
          <Landmark className="h-5 w-5" />
          経理くん
        </Link>
      </div>
      <div className="p-4">
        <CompanySwitcher />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
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
        <Separator className="my-3" />
        <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">マスタ</p>
        {masterNavigation.map((item) => (
          <NavItem key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    </aside>
  )
}
