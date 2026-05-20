"use client"

import { useState } from "react"
import Link from "next/link"
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
import { createApplication } from "@/app/actions/company-applications"

export default function ApplyPage() {
  const router = useRouter()
  const [companyName, setCompanyName] = useState("")
  const [applicantName, setApplicantName] = useState("")
  const [applicantEmail, setApplicantEmail] = useState("")
  const [applicantPhone, setApplicantPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await createApplication({
        companyName,
        applicantName,
        applicantEmail,
        applicantPhone: applicantPhone || undefined,
        notes: notes || undefined,
      })
      router.push("/apply/done")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "申請の送信に失敗しました"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2 text-2xl font-bold">
              <Landmark className="h-8 w-8" />
              経理くん
            </div>
          </div>
          <CardTitle className="text-xl">利用申請</CardTitle>
          <CardDescription>
            会社情報と連絡先をご入力ください。運営担当者の確認後、利用開始の手順をメールでお送りします。
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
              <Label htmlFor="companyName">
                会社名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="株式会社サンプル"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="applicantName">
                申請者氏名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="applicantName"
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                placeholder="山田 太郎"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="applicantEmail">
                連絡先メールアドレス <span className="text-destructive">*</span>
              </Label>
              <Input
                id="applicantEmail"
                type="email"
                value={applicantEmail}
                onChange={(e) => setApplicantEmail(e.target.value)}
                placeholder="example@company.jp"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="applicantPhone">電話番号</Label>
              <Input
                id="applicantPhone"
                type="tel"
                value={applicantPhone}
                onChange={(e) => setApplicantPhone(e.target.value)}
                placeholder="03-1234-5678"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">補足メモ</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ご利用予定の機能や、ご質問など"
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
              申請を送信
            </Button>
            <p className="text-sm text-muted-foreground">
              既にアカウントをお持ちの方は{" "}
              <Link href="/login" className="text-primary hover:underline">
                ログイン
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
