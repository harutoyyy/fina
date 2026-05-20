"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CardContent, CardFooter } from "@/components/ui/card"
import { completePasswordReset } from "@/app/actions/password-reset"

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (newPassword !== confirm) {
      setError("確認用パスワードが一致しません")
      return
    }
    setLoading(true)
    try {
      await completePasswordReset({ token, newPassword })
      setDone(true)
      // 5 秒後にログイン画面へ自動遷移
      setTimeout(() => router.push("/login"), 5000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "パスワードの更新に失敗しました"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <>
        <CardContent className="space-y-3 text-center">
          <div className="flex justify-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>
          <p className="text-sm">パスワードを更新しました。</p>
          <p className="text-sm text-muted-foreground">
            5 秒後にログイン画面へ遷移します。
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full" variant="outline">
            <Link href="/login">ログイン画面に進む</Link>
          </Button>
        </CardFooter>
      </>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="newPassword">新しいパスワード</Label>
          <Input
            id="newPassword"
            type="password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">8 文字以上で入力してください</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">新しいパスワード (確認)</Label>
          <Input
            id="confirm"
            type="password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          パスワードを更新
        </Button>
      </CardFooter>
    </form>
  )
}
