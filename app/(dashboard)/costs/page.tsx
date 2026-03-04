"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function CostsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">原価支払</h1>
        <p className="text-muted-foreground">工事原価の支払いを管理します</p>
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
