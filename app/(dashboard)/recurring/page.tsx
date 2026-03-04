"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function RecurringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">定期テンプレート</h1>
        <p className="text-muted-foreground">毎月発生する定期取引のテンプレートを管理します</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>準備中</CardTitle>
          <CardDescription>この機能は次のフェーズで実装予定です。</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
