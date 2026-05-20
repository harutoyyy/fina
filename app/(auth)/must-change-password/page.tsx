"use client"

// ============================================================
// 強制パスワード変更画面 (Phase 3)
// 出典: docs/admin_and_auth_design.md §8.3
// 招待受諾後、または mustChangePassword=true のユーザー初回ログイン後
// ============================================================

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Landmark, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { changeMyPassword } from "@/app/actions/user-management"

export default function MustChangePasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (newPassword !== confirmPassword) {
      setError("新しいパスワードと確認が一致しません")
      return
    }
    if (newPassword.length < 8) {
      setError("新しいパスワードは 8 文字以上で入力してください")
      return
    }
    if (currentPassword === newPassword) {
      setError("新しいパスワードは現在のものと異なる必要があります")
      return
    }

    setLoading(true)
    try {
      await changeMyPassword({ currentPassword, newPassword })
      router.push("/dashboard")
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "パスワードの変更に失敗しました",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2 text-2xl font-bold">
              <Landmark className="h-8 w-8" />
              経理くん
            </div>
          </div>
          <CardTitle className="text-xl">パスワードを変更してください</CardTitle>
          <CardDescription>
            セキュリティのため、初期パスワードを新しいパスワードに変更します
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="current">現在のパスワード (初期パスワード)</Label>
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">新しいパスワード (8 文字以上)</Label>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">新しいパスワード (確認)</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              パスワードを変更
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
