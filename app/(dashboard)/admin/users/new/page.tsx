"use client"

// ============================================================
// ユーザー招待画面 (Phase 3, LOCAL のみ)
// 出典: docs/admin_and_auth_design.md §8.2, §8.3
// ============================================================

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  createInvitation,
  type CreateInvitationResult,
} from "@/app/actions/user-invitations"
import {
  getCompaniesForAdmin,
  getPermissionTemplates,
} from "@/app/actions/user-management"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Copy, ArrowLeft, CheckCircle2 } from "lucide-react"

export default function NewUserInvitePage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<
    Array<{ id: string; name: string; shortName: string | null }>
  >([])
  const [templates, setTemplates] = useState<
    Array<{ key: string; name: string; description: string | null }>
  >([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<CreateInvitationResult | null>(null)

  // フォーム
  const [form, setForm] = useState({
    companyId: "",
    displayName: "",
    email: "",
    scopeRole: "OPERATOR" as "OPERATOR" | "VIEWER",
    templateKey: "",
    initialPasswordMode: "AUTO" as "AUTO" | "MANUAL",
    customInitialPassword: "",
    expiresInDays: 14,
  })

  useEffect(() => {
    Promise.all([getCompaniesForAdmin(), getPermissionTemplates()])
      .then(([cs, ts]) => {
        setCompanies(cs)
        setTemplates(ts)
        // 初期値
        setForm((f) => ({
          ...f,
          companyId: cs[0]?.id ?? "",
          templateKey: ts[0]?.key ?? "",
        }))
      })
      .catch((e) => setError(e instanceof Error ? e.message : "読込み失敗"))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.companyId) {
      setError("会社を選択してください")
      return
    }
    if (!form.templateKey) {
      setError("権限テンプレートを選択してください")
      return
    }
    if (!form.email.trim() || !form.displayName.trim()) {
      setError("名前とメールアドレスを入力してください")
      return
    }
    if (
      form.initialPasswordMode === "MANUAL" &&
      (!form.customInitialPassword.trim() || form.customInitialPassword.length < 8)
    ) {
      setError("初期パスワードは 8 文字以上で入力してください")
      return
    }

    setSubmitting(true)
    try {
      const r = await createInvitation({
        companyId: form.companyId,
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        scopeRole: form.scopeRole,
        templateKey: form.templateKey,
        customInitialPassword:
          form.initialPasswordMode === "MANUAL"
            ? form.customInitialPassword
            : undefined,
        expiresInDays: form.expiresInDays,
      })
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : "招待状作成に失敗しました")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // noop
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (result) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">招待状を発行しました</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              発行完了
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-green-50 dark:bg-green-950 p-3 text-sm">
              <p>
                招待メールを送信しました。下記の招待リンクと初期パスワードは、
                <strong>この画面でのみ表示されます</strong>。必要に応じて控えてください。
              </p>
            </div>

            <div className="space-y-2">
              <Label>招待リンク</Label>
              <div className="flex gap-2">
                <Input value={result.inviteUrl} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(result.inviteUrl)}
                  title="コピー"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>初期パスワード</Label>
              <div className="flex gap-2">
                <Input value={result.initialPassword} readOnly className="font-mono" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(result.initialPassword)}
                  title="コピー"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                招待されたユーザーは初回ログイン後、パスワードの変更を求められます。
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={() => router.push("/admin/invitations")}>
                招待状一覧へ
              </Button>
              <Button variant="outline" onClick={() => router.push("/admin/users")}>
                ユーザー一覧へ
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ユーザー招待</h1>
          <p className="text-muted-foreground">
            メールで招待状を送り、新しいユーザーを追加します
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>招待状の発行 (fina ローカル)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>認証タイプ</Label>
              <div className="text-sm text-muted-foreground">
                fina ローカル (メアド + パスワード)
                <span className="ml-2 text-xs">※ PWDX 連携は P8 で対応</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">名前 *</Label>
                <Input
                  id="displayName"
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, displayName: e.target.value }))
                  }
                  placeholder="山田 太郎"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="user@example.com"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>所属会社 *</Label>
                <Select
                  value={form.companyId}
                  onValueChange={(v) => setForm((f) => ({ ...f, companyId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>スコープロール *</Label>
                <Select
                  value={form.scopeRole}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, scopeRole: v as "OPERATOR" | "VIEWER" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPERATOR">経理担当 (OPERATOR)</SelectItem>
                    <SelectItem value="VIEWER">閲覧者 (VIEWER)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  COMPANY_ADMIN への昇格は SUPER_ADMIN のみが行えます
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>権限テンプレート *</Label>
              <Select
                value={form.templateKey}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, templateKey: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.name}
                      {t.description ? ` — ${t.description}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-md border p-4">
              <Label>初期パスワード</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="auto"
                    name="passwordMode"
                    checked={form.initialPasswordMode === "AUTO"}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        initialPasswordMode: "AUTO",
                        customInitialPassword: "",
                      }))
                    }
                  />
                  <Label htmlFor="auto" className="font-normal cursor-pointer">
                    自動生成 (12 文字 / 推奨)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="manual"
                    name="passwordMode"
                    checked={form.initialPasswordMode === "MANUAL"}
                    onChange={() =>
                      setForm((f) => ({ ...f, initialPasswordMode: "MANUAL" }))
                    }
                  />
                  <Label htmlFor="manual" className="font-normal cursor-pointer">
                    手動指定
                  </Label>
                </div>
                {form.initialPasswordMode === "MANUAL" && (
                  <Input
                    type="text"
                    placeholder="8 文字以上で入力"
                    value={form.customInitialPassword}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        customInitialPassword: e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            </div>

            <div className="space-y-2 max-w-xs">
              <Label htmlFor="expires">有効期限 (日)</Label>
              <Input
                id="expires"
                type="number"
                min={1}
                max={60}
                value={form.expiresInDays}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    expiresInDays: Math.max(
                      1,
                      Math.min(60, parseInt(e.target.value) || 14),
                    ),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                招待リンクの有効期限。標準 14 日
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                招待状を発行
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/admin/users")}
              >
                キャンセル
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
