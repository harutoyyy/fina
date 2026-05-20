import Link from "next/link"
import { Landmark, ShieldX } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { validateResetToken } from "@/app/actions/password-reset"
import { ResetPasswordForm } from "./reset-password-form"

type SearchParams = Promise<{ token?: string }>

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { token } = await searchParams
  const rawToken = (token ?? "").trim()

  if (!rawToken) {
    return <InvalidTokenView reason="NOT_FOUND" />
  }

  const result = await validateResetToken(rawToken)
  if (!result.valid) {
    return <InvalidTokenView reason={result.reason} />
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
          <CardTitle className="text-xl">新しいパスワードを設定</CardTitle>
          <CardDescription>
            {result.displayName} 様のアカウントのパスワードを変更します。
          </CardDescription>
        </CardHeader>
        <ResetPasswordForm token={rawToken} />
      </Card>
    </div>
  )
}

function InvalidTokenView({
  reason,
}: {
  reason: "NOT_FOUND" | "EXPIRED" | "CONSUMED"
}) {
  const description = (() => {
    switch (reason) {
      case "EXPIRED":
        return "リンクの有効期限が切れています。お手数ですが、もう一度パスワード再設定をリクエストしてください。"
      case "CONSUMED":
        return "このリンクは既に使用されています。新しいパスワードでログインしてください。"
      default:
        return "リンクが無効です。もう一度パスワード再設定をリクエストしてください。"
    }
  })()
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
            <ShieldX className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-xl">リンクが無効です</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>セキュリティ上、リンクの有効期限は 30 分です。</p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/forgot-password">再度リクエストする</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">ログイン画面に戻る</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
