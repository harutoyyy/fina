"use client"

import { useState } from "react"
import Link from "next/link"
import { Landmark, Loader2, MailCheck } from "lucide-react"

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
import { requestPasswordReset } from "@/app/actions/password-reset"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await requestPasswordReset(email)
    } catch {
      // メアド列挙対策のため、成功・失敗いずれも同一の画面を表示
    } finally {
      setLoading(false)
      setSubmitted(true)
    }
  }

  if (submitted) {
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
            <div className="flex justify-center mb-3">
              <MailCheck className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-xl">メールを送信しました</CardTitle>
            <CardDescription>
              入力されたメールアドレスがアカウントに登録されている場合、再設定用のリンクをお送りしました。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>リンクの有効期限は 30 分です。</p>
            <p>
              メールが届かない場合は、迷惑メールフォルダもご確認のうえ、しばらく経ってから再度お試しください。
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button asChild className="w-full" variant="outline">
              <Link href="/login">ログイン画面に戻る</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
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
          <CardTitle className="text-xl">パスワードをお忘れの方</CardTitle>
          <CardDescription>
            ご登録のメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
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

            {/* TODO: reCAPTCHA / hCaptcha のウィジェット差し込み */}
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              スパム対策の認証 (CAPTCHA) を後日設置予定
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              送信
            </Button>
            <p className="text-sm text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline">
                ログイン画面に戻る
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
