"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, LogOut, User, Landmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { CompanySwitcher } from "@/components/company-switcher"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

const allNavigation = [
  { name: "ダッシュボード", href: "/dashboard" },
  { name: "資金繰り表", href: "/cashflow" },
  { name: "経費入力", href: "/expenses" },
  { name: "売上入力", href: "/sales" },
  { name: "原価支払", href: "/costs" },
  { name: "給与入力", href: "/salary" },
  { name: "借入管理", href: "/loans" },
  { name: "リース管理", href: "/leases" },
  { name: "会社一覧", href: "/master/companies" },
  { name: "銀行口座", href: "/master/accounts" },
  { name: "取引先", href: "/master/partners" },
  { name: "勘定科目", href: "/master/categories" },
]

export function AppHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  // Radix UI の DropdownMenu は内部で useId を使い SSR と client で異なる ID を生成するため、
  // hydration mismatch を避けるためクライアントマウント後にのみ描画する
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    window.location.href = "/login"
  }

  return (
    <>
      <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="lg:hidden flex items-center gap-2 font-bold">
          <Landmark className="h-5 w-5" />
          経理くん
        </div>
        <div className="lg:hidden ml-auto flex items-center gap-2">
          <CompanySwitcher />
        </div>
        <div className="hidden lg:block flex-1" />
        <ThemeToggle />
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>アカウント</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // SSR 用プレースホルダ（ID 競合回避）
          <Button variant="ghost" size="icon" suppressHydrationWarning>
            <User className="h-4 w-4" />
          </Button>
        )}
      </header>

      {mobileOpen && (
        <div className="lg:hidden border-b bg-background">
          <nav className="flex flex-col p-4 space-y-1">
            {allNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      )}
    </>
  )
}
