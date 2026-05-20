import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { getApplication } from "@/app/actions/company-applications"
import { ApplicationActionPanel } from "./application-action-panel"

export const dynamic = "force-dynamic"

function statusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return <Badge variant="secondary">承認待ち</Badge>
    case "ACCEPTED":
      return <Badge className="bg-emerald-500 hover:bg-emerald-500/90">承認済</Badge>
    case "REJECTED":
      return <Badge variant="destructive">却下</Badge>
    case "EXPIRED":
      return <Badge variant="outline">期限切れ</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function formatDate(date: Date | null) {
  if (!date) return "-"
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm">{value || "-"}</dd>
    </div>
  )
}

type RouteParams = Promise<{ id: string }>

export default async function ApplicationDetailPage({
  params,
}: {
  params: RouteParams
}) {
  const { id } = await params
  const app = await getApplication(id)
  if (!app) return notFound()

  const isPending = app.status === "PENDING"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Button asChild size="sm" variant="ghost" className="mb-2">
            <Link href="/admin/system/applications">
              <ArrowLeft className="mr-1 h-4 w-4" />
              一覧へ戻る
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">申請詳細</h1>
        </div>
        <div className="flex items-center gap-2">
          状態: {statusBadge(app.status)}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>申請内容</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Field label="申請日" value={formatDate(app.createdAt)} />
            <Field label="申請 ID" value={<code className="text-xs">{app.id}</code>} />
            <Field label="有効期限" value={formatDate(app.expiresAt)} />
          </dl>

          <Separator className="my-4" />
          <h3 className="mb-2 font-semibold">申請者情報</h3>
          <dl>
            <Field label="氏名" value={app.applicantName} />
            <Field label="連絡先メアド" value={app.applicantEmail} />
            <Field label="電話" value={app.applicantPhone} />
          </dl>

          <Separator className="my-4" />
          <h3 className="mb-2 font-semibold">会社情報</h3>
          <dl>
            <Field label="会社名" value={app.companyName} />
            <Field label="補足メモ" value={app.notes} />
          </dl>

          <Separator className="my-4" />
          <h3 className="mb-2 font-semibold">PWDX 連携</h3>
          <dl>
            <Field
              label="連携希望"
              value={app.usePwdx ? "あり" : "なし"}
            />
            {app.usePwdx && (
              <>
                <Field label="PWDX 会社" value={app.pwdxCompanyName ?? app.pwdxCompanyId} />
                <Field label="認証 sub" value={app.externalSub ? <code className="text-xs">{app.externalSub}</code> : "-"} />
                <Field label="PWDX User ID" value={app.externalUserId} />
              </>
            )}
          </dl>

          {!isPending && (
            <>
              <Separator className="my-4" />
              <h3 className="mb-2 font-semibold">審査結果</h3>
              <dl>
                <Field label="審査日時" value={formatDate(app.reviewedAt)} />
                <Field
                  label="審査者"
                  value={app.reviewer?.displayName ?? app.reviewedBy}
                />
                <Field label="コメント" value={app.reviewComment} />
                {app.createdCompanyId && (
                  <Field
                    label="作成会社 ID"
                    value={<code className="text-xs">{app.createdCompanyId}</code>}
                  />
                )}
                {app.createdUserId && (
                  <Field
                    label="作成ユーザー ID"
                    value={<code className="text-xs">{app.createdUserId}</code>}
                  />
                )}
              </dl>
            </>
          )}
        </CardContent>
      </Card>

      {isPending && (
        <Card>
          <CardHeader>
            <CardTitle>承認 / 却下</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              承認すると Company / UserProfile (COMPANY_ADMIN) が自動作成され、申請者に初回パスワード設定リンクをメール送信します。
            </p>
            <ApplicationActionPanel applicationId={app.id} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
