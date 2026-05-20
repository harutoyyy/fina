"use client"

// ============================================================
// 招待状一覧画面 (Phase 3)
// 出典: docs/admin_and_auth_design.md §10.2.2
// ============================================================

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  listInvitations,
  resendInvitation,
  revokeInvitation,
  type InvitationListItem,
} from "@/app/actions/user-invitations"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Send, X, Plus, Users } from "lucide-react"
import type { InvitationStatus } from "@prisma/client"

const statusLabels: Record<InvitationStatus, string> = {
  PENDING: "承認待ち",
  ACCEPTED: "承認済",
  REJECTED: "却下",
  EXPIRED: "失効",
  REVOKED: "取消",
}

const statusVariant: Record<
  InvitationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING: "default",
  ACCEPTED: "secondary",
  REJECTED: "destructive",
  EXPIRED: "outline",
  REVOKED: "outline",
}

const scopeRoleLabels: Record<string, string> = {
  COMPANY_ADMIN: "会社管理者",
  OPERATOR: "経理担当",
  VIEWER: "閲覧者",
}

const authProviderLabels: Record<string, string> = {
  LOCAL: "fina",
  PWDX_OIDC: "PWDX",
}

export default function AdminInvitationsPage() {
  const [items, setItems] = useState<InvitationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<InvitationStatus | "ALL">(
    "PENDING",
  )

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await listInvitations({ status: statusFilter })
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "読込みに失敗しました")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const handleResend = async (inv: InvitationListItem) => {
    if (
      !confirm(
        `${inv.email ?? inv.displayName} 宛に招待状を再送し、初期パスワードを再発行します。よろしいですか？`,
      )
    ) {
      return
    }
    setBusyId(inv.id)
    setError("")
    setInfo("")
    try {
      await resendInvitation(inv.id)
      setInfo(`${inv.email ?? inv.displayName} に再送しました`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "再送に失敗しました")
    } finally {
      setBusyId(null)
    }
  }

  const handleRevoke = async (inv: InvitationListItem) => {
    if (!confirm(`「${inv.displayName}」宛の招待を取消しますか？`)) return
    setBusyId(inv.id)
    setError("")
    setInfo("")
    try {
      await revokeInvitation(inv.id)
      setInfo(`「${inv.displayName}」宛の招待を取消しました`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "取消に失敗しました")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">招待状一覧</h1>
          <p className="text-muted-foreground">未承認・失効の招待状を管理します</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/users">
              <Users className="mr-2 h-4 w-4" />
              ユーザー一覧
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
      {info && (
        <div className="rounded-md bg-emerald-50 dark:bg-emerald-950 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {info}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-3 mb-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">状態</label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as InvitationStatus | "ALL")}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  <SelectItem value="PENDING">{statusLabels.PENDING}</SelectItem>
                  <SelectItem value="ACCEPTED">{statusLabels.ACCEPTED}</SelectItem>
                  <SelectItem value="EXPIRED">{statusLabels.EXPIRED}</SelectItem>
                  <SelectItem value="REVOKED">{statusLabels.REVOKED}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              該当する招待状がありません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>招待先</TableHead>
                  <TableHead>表示名</TableHead>
                  <TableHead>認証</TableHead>
                  <TableHead>会社</TableHead>
                  <TableHead>スコープ</TableHead>
                  <TableHead>テンプレ</TableHead>
                  <TableHead>招待日</TableHead>
                  <TableHead>有効期限</TableHead>
                  <TableHead>招待者</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">
                      {inv.authProvider === "LOCAL"
                        ? inv.email ?? "-"
                        : inv.externalUserId
                          ? `u_${inv.externalUserId}`
                          : inv.externalSub
                            ? `sub:${inv.externalSub.slice(0, 12)}...`
                            : "-"}
                    </TableCell>
                    <TableCell>{inv.displayName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {authProviderLabels[inv.authProvider] ?? inv.authProvider}
                      </Badge>
                    </TableCell>
                    <TableCell>{inv.companyName ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {scopeRoleLabels[inv.scopeRole] ?? inv.scopeRole}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{inv.templateName ?? "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(inv.invitedAt).toLocaleDateString("ja-JP")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(inv.expiresAt).toLocaleDateString("ja-JP")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {inv.inviterDisplayName ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[inv.status]}>
                        {statusLabels[inv.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inv.status === "PENDING" && (
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResend(inv)}
                            disabled={busyId === inv.id}
                            title="再送"
                          >
                            {busyId === inv.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3 mr-1" />
                            )}
                            再送
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevoke(inv)}
                            disabled={busyId === inv.id}
                            title="取消"
                          >
                            <X className="h-3 w-3 mr-1" />
                            取消
                          </Button>
                        </div>
                      )}
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
