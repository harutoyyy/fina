"use client"

// ============================================================
// 招待リンクからの初回ログイン (Phase 3, LOCAL のみ)
// 出典: docs/admin_and_auth_design.md §8.3
// URL: /accept?token=xxx
// ============================================================

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
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
import { signIn } from "@/lib/auth-client"
import { acceptInvitation } from "@/app/actions/user-invitations"

function AcceptInvitationInner() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token") ?? ""

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<"accept" | "done">("accept")

  useEffect(() => {
    if (!token) {
      setError("招待リンクが無効です (token が見つかりません)")
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!token) {
      setError("招待リンクが無効です")
      return
    }
    setLoading(true)
    try {
      // 1. 招待状の検証 + User 作成
      await acceptInvitation({
        token,
        email,
        initialPassword: password,
      })
      // 2. そのままサインインする
      const res = await signIn.email({ email, password })
      if (res.error) {
        setError(
          "ユーザーは作成されましたがサインインに失敗しました。ログイン画面から再度ログインしてください",
        )
        setPhase("done")
        return
      }
      // 3. mustChangePassword 画面へ
      router.push("/must-change-password")
    } catch (e) {
      setError(e instanceof Error ? e.message : "招待の受諾に失敗しました")
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
          <CardTitle className="text-xl">ご招待ありがとうございます</CardTitle>
          <CardDescription>
            メールに記載されたメールアドレスと初期パスワードを入力してください
          </CardDescription>
        </CardHeader>
        {phase === "done" ? (
          <CardContent className="space-y-4">
            <div className="rounded-md bg-emerald-50 dark:bg-emerald-950 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              アカウントを作成しました。ログイン画面から改めてサインインしてください。
            </div>
            <Button asChild className="w-full">
              <Link href="/login">ログイン画面へ</Link>
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading || !token}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">初期パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading || !token}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !token}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                招待を受諾してログイン
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                既にアカウントをお持ちの方は{" "}
                <Link href="/login" className="text-primary hover:underline">
                  ログイン
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <AcceptInvitationInner />
    </Suspense>
  )
}
