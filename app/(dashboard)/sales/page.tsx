"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">売上入力</h1>
        <p className="text-muted-foreground">売上の入力・管理を行います</p>
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
