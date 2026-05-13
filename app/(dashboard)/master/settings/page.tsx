"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">設定</h1>
        <p className="text-muted-foreground">システムの設定を管理します</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>準備中</CardTitle>
          <CardDescription>
            設定機能は今後のアップデートで追加予定です。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            給与グループ設定、控除項目設定、銀行マスタ管理などの機能を順次追加します。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
