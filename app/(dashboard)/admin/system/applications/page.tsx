import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { listApplications } from "@/app/actions/company-applications"

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

function formatDate(date: Date) {
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function ApplicationsListPage() {
  const apps = await listApplications()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">公開申請一覧</h1>
        <p className="text-muted-foreground">
          fina の利用を希望する公開申請を確認・承認します (SUPER_ADMIN 専用)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>申請一覧 ({apps.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {apps.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              申請はまだありません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申請日</TableHead>
                  <TableHead>会社名</TableHead>
                  <TableHead>申請者</TableHead>
                  <TableHead>連絡先</TableHead>
                  <TableHead>PWDX</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(app.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">{app.companyName}</TableCell>
                    <TableCell>{app.applicantName}</TableCell>
                    <TableCell>{app.applicantEmail}</TableCell>
                    <TableCell>
                      {app.usePwdx ? (
                        <Badge variant="outline">連携希望</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">なし</span>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(app.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/system/applications/${app.id}`}>
                          詳細
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
