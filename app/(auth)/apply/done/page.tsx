import Link from "next/link"
import { CheckCircle2, Landmark } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function ApplyDonePage() {
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
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>
          <CardTitle className="text-xl">申請を受け付けました</CardTitle>
          <CardDescription>
            ご入力いただいたメールアドレスに、申請受付の確認メールをお送りしました。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            運営担当者が内容を確認後、改めて結果をご連絡いたします。通常 1〜3 営業日以内に審査が完了します。
          </p>
          <p>
            確認メールが届かない場合は、迷惑メールフォルダもご確認ください。
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full" variant="outline">
            <Link href="/login">ログイン画面に戻る</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
