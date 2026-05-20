"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Landmark, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { signIn } from "@/lib/auth-client"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn.email({ email, password })
      if (result.error) {
        setError("メールアドレスまたはパスワードが正しくありません")
      } else {
        router.push("/dashboard")
      }
    } catch {
      setError("ログインに失敗しました")
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
          <CardTitle className="text-xl">ログイン</CardTitle>
          <CardDescription>アカウント情報を入力してください</CardDescription>
        </CardHeader>
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
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              ログイン
            </Button>
            <div className="w-full border-t pt-3 text-center text-sm text-muted-foreground space-y-2">
              <p>
                パスワードを忘れた方は{" "}
                <Link href="/forgot-password" className="text-primary hover:underline">
                  こちら
                </Link>
              </p>
              <p>
                まだアカウントをお持ちでない方は{" "}
                <Link href="/apply" className="text-primary hover:underline font-medium">
                  会社の利用申請
                </Link>{" "}
                から
              </p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
