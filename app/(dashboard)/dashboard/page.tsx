"use client"

import { useCompany } from "@/contexts/company-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, CreditCard, Handshake, FileText } from "lucide-react"

export default function DashboardPage() {
  const { selectedCompany } = useCompany()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ダッシュボード</h1>
        <p className="text-muted-foreground">
          {selectedCompany ? `${selectedCompany.name} の概要` : "会社を選択してください"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">会社</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedCompany?.name || "-"}</div>
            <p className="text-xs text-muted-foreground">{selectedCompany?.industryType || ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">口座数</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">登録済み口座</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">取引先数</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">登録済み取引先</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今月の取引</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">件</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ようこそ</CardTitle>
          <CardDescription>
            経理くん（fina）はグループ会社の財務データ入力・管理システムです。
            左のサイドバーから各機能にアクセスできます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm">
            <p>まずは以下の順序でセットアップしてください：</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>マスタ管理 → 会社一覧で会社情報を確認</li>
              <li>マスタ管理 → 銀行口座で口座を登録</li>
              <li>マスタ管理 → 取引先を登録</li>
              <li>各入力画面から取引データを入力</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
