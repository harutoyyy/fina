"use client"

// ============================================================
// PWDX 連携 詳細設定画面 (Phase 5)
// ============================================================
// 設計: docs/admin_and_auth_design.md §10.2.3
// マスタープラン: docs/admin_master_plan.md §P5
// ============================================================

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ArrowLeft, Loader2, RotateCcw, Trash2 } from "lucide-react"
import {
  getPwdxIntegration,
  upsertPwdxIntegration,
  deletePwdxIntegration,
  rotateCredentialKey,
  syncNow,
  checkPwdxCompanyIdDuplicate,
  type PwdxIntegrationDetail,
  type SyncFeatures,
} from "@/app/actions/pwdx-integration"

const FEATURE_LABELS: Array<{ key: keyof SyncFeatures; label: string }> = [
  { key: "partners", label: "取引先マスタ" },
  { key: "invoices", label: "請求 → 売上" },
  { key: "orders", label: "発注 → 原価支払" },
  { key: "payments", label: "支払" },
]

function formatDateTime(iso: string | null): string {
  if (!iso) return "-"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "-"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function StatusLabel({ status, message }: { status: string | null; message: string | null }) {
  if (!status) return <span className="text-muted-foreground">未同期</span>
  let badge = <Badge variant="outline">{status}</Badge>
  if (status === "SUCCESS") badge = <Badge>成功</Badge>
  if (status === "FAILED") badge = <Badge variant="destructive">失敗</Badge>
  if (status === "RUNNING") badge = <Badge variant="secondary">実行中</Badge>
  if (status === "PENDING") badge = <Badge variant="secondary">待機中</Badge>
  return (
    <span className="flex items-center gap-2">
      {badge}
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </span>
  )
}

export default function PwdxDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = use(params)
  const router = useRouter()

  const [detail, setDetail] = useState<PwdxIntegrationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // form fields
  const [enabled, setEnabled] = useState(false)
  const [pwdxCompanyId, setPwdxCompanyId] = useState("")
  const [apiBaseUrl, setApiBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [syncFeatures, setSyncFeatures] = useState<SyncFeatures>({
    partners: false,
    invoices: false,
    orders: false,
    payments: false,
  })

  // dialogs
  const [rotateOpen, setRotateOpen] = useState(false)
  const [rotateNewKey, setRotateNewKey] = useState("")
  const [rotating, setRotating] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPwdxIntegration(companyId)
      if (!data) {
        setError("会社が見つかりません")
        return
      }
      setDetail(data)
      setEnabled(data.enabled)
      setPwdxCompanyId(data.pwdxCompanyId)
      setApiBaseUrl(data.apiBaseUrl ?? "")
      setApiKey("")
      setSyncFeatures(data.syncFeatures)
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const handleSave = async () => {
    setSaveMessage(null)
    setError(null)
    if (!pwdxCompanyId.trim()) {
      setError("PWDX 企業 ID は必須です")
      return
    }
    setSaving(true)
    try {
      // 重複チェック (サーバ側でもチェックされるが UX のためここでも)
      const dup = await checkPwdxCompanyIdDuplicate(pwdxCompanyId.trim(), companyId)
      if (dup.inUse) {
        setError(
          `PWDX 企業 ID は既に他会社 (${dup.companyName ?? "?"}) で使用されています`,
        )
        setSaving(false)
        return
      }
      await upsertPwdxIntegration({
        companyId,
        enabled,
        pwdxCompanyId: pwdxCompanyId.trim(),
        apiBaseUrl: apiBaseUrl.trim() || null,
        apiKey: apiKey ? apiKey : null,
        syncFeatures,
      })
      setSaveMessage("保存しました")
      setApiKey("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    setSaveMessage(null)
    setError(null)
    try {
      const result = await syncNow(companyId)
      setSaveMessage(result.message || "同期を実行しました")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "同期の実行に失敗しました")
    } finally {
      setSyncing(false)
    }
  }

  const handleRotate = async () => {
    if (!rotateNewKey.trim()) {
      setError("新しい API キーを入力してください")
      return
    }
    setRotating(true)
    setError(null)
    try {
      await rotateCredentialKey(companyId, rotateNewKey.trim())
      setSaveMessage("API キーを回転しました")
      setRotateOpen(false)
      setRotateNewKey("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "キー回転に失敗しました")
    } finally {
      setRotating(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await deletePwdxIntegration(companyId)
      setDeleteOpen(false)
      router.push("/admin/pwdx")
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました")
      setDeleting(false)
    }
  }

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
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/pwdx">
            <ArrowLeft className="h-4 w-4 mr-1" />
            一覧へ戻る
          </Link>
        </Button>
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {error ?? "会社が見つかりません"}
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasIntegration = !!detail.id

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2">
            <Link href="/admin/pwdx">
              <ArrowLeft className="h-4 w-4 mr-1" />
              一覧へ戻る
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            PWDX 連携: {detail.companyName}
          </h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/pwdx/${companyId}/sync-history`}>同期履歴</Link>
        </Button>
      </div>

      {error && (
        <div className="rounded border border-destructive bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {error}
        </div>
      )}
      {saveMessage && (
        <div className="rounded border border-primary/40 bg-primary/10 px-4 py-2 text-sm">
          {saveMessage}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>基本設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} id="enabled" />
            <Label htmlFor="enabled" className="cursor-pointer">
              PWDX 連携を有効化
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pwdxCompanyId">PWDX 企業 ID</Label>
            <Input
              id="pwdxCompanyId"
              value={pwdxCompanyId}
              onChange={(e) => setPwdxCompanyId(e.target.value)}
              placeholder="例: okigroup_001"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              PWDX 側で発行された会社 ID。他会社と重複できません
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiBaseUrl">API URL</Label>
            <Input
              id="apiBaseUrl"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://pwdx.example.jp/api/v1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">
              API キー{hasIntegration && detail.hasCredential ? " (現在: ********)" : ""}
            </Label>
            <div className="flex gap-2">
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  hasIntegration && detail.hasCredential
                    ? "新しい API キーを入力する場合のみ"
                    : "API キーを入力"
                }
              />
              {hasIntegration && detail.hasCredential && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRotateOpen(true)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  キー回転
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              API キーは入力時のみ平文を扱い、保存後は暗号化されます (現状はスタブ実装)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>同期対象</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {FEATURE_LABELS.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-3 cursor-pointer text-sm"
            >
              <Checkbox
                checked={syncFeatures[key]}
                onCheckedChange={(v) =>
                  setSyncFeatures((s) => ({ ...s, [key]: !!v }))
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>同期状況</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground">最終同期日時:</span>
            <span>{formatDateTime(detail.lastSyncedAt)}</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-muted-foreground">状態:</span>
            <StatusLabel
              status={detail.lastSyncStatus}
              message={detail.lastSyncMessage}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 justify-between">
        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            保存
          </Button>
          <Button
            variant="outline"
            onClick={handleSyncNow}
            disabled={syncing || !hasIntegration || !enabled}
          >
            {syncing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            今すぐ同期
          </Button>
        </div>
        {hasIntegration && (
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" />
            連携を削除
          </Button>
        )}
      </div>

      {/* キー回転ダイアログ */}
      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API キーを回転</DialogTitle>
            <DialogDescription>
              旧キーは失効し、新しいキーで動作します。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="newKey">新しい API キー</Label>
            <Input
              id="newKey"
              type="password"
              value={rotateNewKey}
              onChange={(e) => setRotateNewKey(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleRotate} disabled={rotating}>
              {rotating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              回転を実行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除ダイアログ */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PWDX 連携を削除</DialogTitle>
            <DialogDescription>
              {detail.companyName} の PWDX 連携設定を完全に削除します。
              この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
