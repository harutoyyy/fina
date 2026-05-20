"use client"

// ============================================================
// ユーザー詳細編集画面 (Phase 3)
// 出典: docs/admin_and_auth_design.md §10.2.1
// ============================================================

import { useEffect, useState, use } from "react"
import Link from "next/link"
import {
  getUserDetail,
  updateUserRole,
  updateUserTemplate,
  deactivateUser,
  reactivateUser,
  adminResetPassword,
  getPermissionTemplates,
  type UserDetail,
} from "@/app/actions/user-management"
import { getCurrentUserProfile } from "@/app/actions/user-profile"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Loader2,
  ArrowLeft,
  KeyRound,
  Save,
  ShieldOff,
  ShieldCheck,
  Copy,
} from "lucide-react"

const scopeRoleLabels: Record<string, string> = {
  SUPER_ADMIN: "システム管理者",
  COMPANY_ADMIN: "会社管理者",
  OPERATOR: "経理担当",
  VIEWER: "閲覧者",
}

const authProviderLabels: Record<string, string> = {
  LOCAL: "fina ローカル",
  PWDX_OIDC: "PWDX 連携",
}

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [myScope, setMyScope] = useState<string>("")
  const [templates, setTemplates] = useState<
    Array<{ key: string; name: string; description: string | null }>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  // 編集状態
  const [scopeRole, setScopeRole] = useState<string>("")
  const [templateKey, setTemplateKey] = useState<string>("")

  // 代行リセット結果
  const [resetUrl, setResetUrl] = useState<string | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const [d, p, ts] = await Promise.all([
        getUserDetail(id),
        getCurrentUserProfile(),
        getPermissionTemplates(),
      ])
      if (!d) {
        setError("ユーザーが見つかりません")
        return
      }
      setDetail(d)
      setScopeRole(d.scopeRole)
      setTemplateKey(d.templateKey ?? "")
      setMyScope(p?.scopeRole ?? "")
      setTemplates(ts)
    } catch (e) {
      setError(e instanceof Error ? e.message : "読込みに失敗しました")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error || "ユーザーが見つかりません"}
        </div>
      </div>
    )
  }

  const isSuperAdmin = myScope === "SUPER_ADMIN"
  const canEditScope = isSuperAdmin || detail.scopeRole === "OPERATOR" || detail.scopeRole === "VIEWER"
  const scopeOptions: string[] = isSuperAdmin
    ? ["SUPER_ADMIN", "COMPANY_ADMIN", "OPERATOR", "VIEWER"]
    : ["OPERATOR", "VIEWER"]

  const handleSave = async () => {
    setError("")
    setInfo("")
    setBusy("save")
    try {
      if (scopeRole !== detail.scopeRole) {
        await updateUserRole(detail.id, scopeRole as never)
      }
      const newTpl = templateKey || null
      if (newTpl !== detail.templateKey) {
        await updateUserTemplate(detail.id, newTpl)
      }
      setInfo("変更を保存しました")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setBusy(null)
    }
  }

  const handleDeactivate = async () => {
    if (!confirm(`「${detail.displayName}」を無効化しますか？`)) return
    setBusy("deact")
    setError("")
    try {
      await deactivateUser(detail.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "無効化に失敗しました")
    } finally {
      setBusy(null)
    }
  }

  const handleReactivate = async () => {
    setBusy("react")
    setError("")
    try {
      await reactivateUser(detail.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "有効化に失敗しました")
    } finally {
      setBusy(null)
    }
  }

  const handleAdminReset = async () => {
    if (!confirm(`「${detail.displayName}」にパスワードリセットメールを送信しますか？`)) {
      return
    }
    setBusy("reset")
    setError("")
    try {
      const r = await adminResetPassword(detail.id)
      setResetUrl(r.resetUrl)
      setResetDialogOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "リセットに失敗しました")
    } finally {
      setBusy(null)
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // noop
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{detail.displayName}</h1>
          <p className="text-muted-foreground text-sm">
            {detail.primaryCompanyName ?? "-"} ・{" "}
            {authProviderLabels[detail.authProvider] ?? detail.authProvider}
          </p>
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
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">名前</Label>
            <div className="text-sm">{detail.displayName}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">メールアドレス</Label>
            <div className="text-sm font-mono">{detail.email ?? "-"}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">認証タイプ</Label>
            <div>
              <Badge variant="outline">
                {authProviderLabels[detail.authProvider] ?? detail.authProvider}
              </Badge>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">状態</Label>
            <div>
              <Badge variant={detail.isActive ? "default" : "secondary"}>
                {detail.isActive ? "有効" : "無効"}
              </Badge>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">最終ログイン</Label>
            <div className="text-sm">
              {detail.lastLoginAt
                ? new Date(detail.lastLoginAt).toLocaleString("ja-JP")
                : "-"}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">作成日</Label>
            <div className="text-sm">
              {new Date(detail.createdAt).toLocaleDateString("ja-JP")}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>権限</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>スコープロール</Label>
              {canEditScope ? (
                <Select value={scopeRole} onValueChange={setScopeRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {scopeRoleLabels[r] ?? r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm">
                  <Badge variant="secondary">
                    {scopeRoleLabels[detail.scopeRole] ?? detail.scopeRole}
                  </Badge>
                  <span className="ml-2 text-xs text-muted-foreground">
                    (SUPER_ADMIN のみ変更可)
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>権限テンプレート</Label>
              <Select value={templateKey || "NONE"} onValueChange={(v) => setTemplateKey(v === "NONE" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">なし</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={busy !== null}>
              {busy === "save" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              保存
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.authProvider === "LOCAL" && (
            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="text-sm font-medium">代行パスワードリセット</div>
                <div className="text-xs text-muted-foreground">
                  ユーザー宛にリセットリンクをメール送信します (30 分有効、ワンタイム)
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleAdminReset}
                disabled={busy !== null || !detail.isActive}
              >
                {busy === "reset" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                リセットメール送信
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between border rounded-md p-3">
            <div>
              <div className="text-sm font-medium">
                {detail.isActive ? "無効化" : "再有効化"}
              </div>
              <div className="text-xs text-muted-foreground">
                {detail.isActive
                  ? "ログイン不可にします。データは保持されます"
                  : "再びログイン可能にします"}
              </div>
            </div>
            {detail.isActive ? (
              <Button
                variant="destructive"
                onClick={handleDeactivate}
                disabled={busy !== null}
              >
                {busy === "deact" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldOff className="mr-2 h-4 w-4" />
                )}
                無効化
              </Button>
            ) : (
              <Button onClick={handleReactivate} disabled={busy !== null}>
                {busy === "react" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                有効化
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>パスワードリセットリンクを発行しました</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              対象ユーザーへメールを送信しました。下記リンクは{" "}
              <strong>この画面でのみ表示</strong> されます。
            </p>
            {resetUrl && (
              <div className="flex gap-2">
                <Input value={resetUrl} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(resetUrl)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setResetDialogOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
