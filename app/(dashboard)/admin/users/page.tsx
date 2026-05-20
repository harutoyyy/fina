"use client"

// ============================================================
// ユーザー管理画面 (Phase 3)
// 出典: docs/admin_and_auth_design.md §10.2.1
// ============================================================

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  listUsers,
  deactivateUser,
  reactivateUser,
  getCompaniesForAdmin,
  type UserListItem,
} from "@/app/actions/user-management"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Search, UserCog, MailPlus } from "lucide-react"

type ScopeFilter = "ALL" | "SUPER_ADMIN" | "COMPANY_ADMIN" | "OPERATOR" | "VIEWER"
type AuthFilter = "ALL" | "LOCAL" | "PWDX_OIDC"
type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE"

const scopeRoleLabels: Record<string, string> = {
  SUPER_ADMIN: "システム管理者",
  COMPANY_ADMIN: "会社管理者",
  OPERATOR: "経理担当",
  VIEWER: "閲覧者",
}

const authProviderLabels: Record<string, string> = {
  LOCAL: "fina",
  PWDX_OIDC: "PWDX",
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [companies, setCompanies] = useState<
    Array<{ id: string; name: string; shortName: string | null }>
  >([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState("")

  // フィルタ
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("ALL")
  const [authFilter, setAuthFilter] = useState<AuthFilter>("ALL")
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("ACTIVE")
  const [companyFilter, setCompanyFilter] = useState<string>("ALL")
  const [search, setSearch] = useState("")

  const loadData = async () => {
    setLoading(true)
    setError("")
    try {
      const [usersData, companiesData] = await Promise.all([
        listUsers({
          scopeRole: scopeFilter,
          authProvider: authFilter,
          isActive: activeFilter,
          search: search || undefined,
          companyId: companyFilter !== "ALL" ? companyFilter : undefined,
        }),
        getCompaniesForAdmin(),
      ])
      setUsers(usersData)
      setCompanies(companiesData)
    } catch (e) {
      setError(e instanceof Error ? e.message : "読込みに失敗しました")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeFilter, authFilter, activeFilter, companyFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadData()
  }

  const handleDeactivate = async (u: UserListItem) => {
    if (!confirm(`「${u.displayName}」を無効化しますか？`)) return
    setBusyId(u.id)
    setError("")
    try {
      await deactivateUser(u.id)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : "無効化に失敗しました")
    } finally {
      setBusyId(null)
    }
  }

  const handleReactivate = async (u: UserListItem) => {
    setBusyId(u.id)
    setError("")
    try {
      await reactivateUser(u.id)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : "有効化に失敗しました")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ユーザー管理</h1>
          <p className="text-muted-foreground">所属会社のユーザーを管理します</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/invitations">
              <MailPlus className="mr-2 h-4 w-4" />
              招待状一覧
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/users/new">
              <Plus className="mr-2 h-4 w-4" />
              ユーザー招待
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3 mb-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">会社</label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.shortName || c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">スコープ</label>
              <Select
                value={scopeFilter}
                onValueChange={(v) => setScopeFilter(v as ScopeFilter)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  <SelectItem value="SUPER_ADMIN">{scopeRoleLabels.SUPER_ADMIN}</SelectItem>
                  <SelectItem value="COMPANY_ADMIN">{scopeRoleLabels.COMPANY_ADMIN}</SelectItem>
                  <SelectItem value="OPERATOR">{scopeRoleLabels.OPERATOR}</SelectItem>
                  <SelectItem value="VIEWER">{scopeRoleLabels.VIEWER}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">認証</label>
              <Select
                value={authFilter}
                onValueChange={(v) => setAuthFilter(v as AuthFilter)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  <SelectItem value="LOCAL">fina</SelectItem>
                  <SelectItem value="PWDX_OIDC">PWDX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">状態</label>
              <Select
                value={activeFilter}
                onValueChange={(v) => setActiveFilter(v as ActiveFilter)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  <SelectItem value="ACTIVE">有効</SelectItem>
                  <SelectItem value="INACTIVE">無効</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-48">
              <label className="text-xs text-muted-foreground">検索 (名前 / メアド)</label>
              <div className="flex gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="名前 または メールアドレス"
                />
                <Button type="submit" variant="outline" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              該当するユーザーがいません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名前</TableHead>
                  <TableHead>識別子</TableHead>
                  <TableHead>認証</TableHead>
                  <TableHead>会社</TableHead>
                  <TableHead>スコープ</TableHead>
                  <TableHead>テンプレ</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>最終ログイン</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.displayName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.authProvider === "LOCAL"
                        ? u.email ?? "-"
                        : u.externalSub
                          ? `sub: ${u.externalSub.slice(0, 8)}...`
                          : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {authProviderLabels[u.authProvider] ?? u.authProvider}
                      </Badge>
                    </TableCell>
                    <TableCell>{u.primaryCompanyName ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {scopeRoleLabels[u.scopeRole] ?? u.scopeRole}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{u.templateName ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "default" : "secondary"}>
                        {u.isActive ? "有効" : "無効"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleString("ja-JP", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button asChild variant="ghost" size="icon" title="編集">
                          <Link href={`/admin/users/${u.id}`}>
                            <UserCog className="h-4 w-4" />
                          </Link>
                        </Button>
                        {u.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(u)}
                            disabled={busyId === u.id}
                          >
                            {busyId === u.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "無効化"
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReactivate(u)}
                            disabled={busyId === u.id}
                          >
                            {busyId === u.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "有効化"
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
