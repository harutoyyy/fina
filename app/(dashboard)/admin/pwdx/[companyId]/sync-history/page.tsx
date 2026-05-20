"use client"

// ============================================================
// PWDX 同期履歴画面 (Phase 5: 空表示, Phase 9 で本実装)
// ============================================================
// 設計: docs/admin_and_auth_design.md §11.3
// マスタープラン: docs/admin_master_plan.md §P5 / §P9
// ============================================================

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import {
  listSyncHistory,
  type SyncHistoryEntry,
} from "@/app/actions/pwdx-integration"

export default function PwdxSyncHistoryPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = use(params)
  const [items, setItems] = useState<SyncHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await listSyncHistory(companyId)
        setItems(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : "読み込みに失敗しました")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [companyId])

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link href={`/admin/pwdx/${companyId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            連携設定に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">同期履歴</h1>
        <p className="text-muted-foreground">
          PWDX 連携の同期ジョブ履歴
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">{error}</div>
          ) : items.length === 0 ? (
            <div className="space-y-2 py-8 text-center text-muted-foreground">
              <div className="text-sm">同期履歴はまだありません</div>
              <div className="text-xs">
                同期処理本体は Phase 9 で実装予定です
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* TODO(P9): SyncJob テーブル追加後に履歴テーブル UI を実装 */}
              {items.map((item) => (
                <div key={item.id} className="border rounded p-3 text-sm">
                  <div>{item.feature}</div>
                  <div className="text-muted-foreground">{item.status}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
