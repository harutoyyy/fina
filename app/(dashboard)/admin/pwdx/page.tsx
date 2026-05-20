"use client"

// ============================================================
// PWDX 連携一覧画面 (Phase 5)
// ============================================================
// 設計: docs/admin_and_auth_design.md §10.2.3
// マスタープラン: docs/admin_master_plan.md §P5
// ============================================================

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, Plug } from "lucide-react"
import {
  listPwdxIntegrations,
  type PwdxIntegrationSummary,
  type SyncFeatures,
} from "@/app/actions/pwdx-integration"

const FEATURE_LABELS: Record<keyof SyncFeatures, string> = {
  partners: "取引先",
  invoices: "請求",
  orders: "発注",
  payments: "支払",
}

function featureSummary(features: SyncFeatures | null): string {
  if (!features) return "-"
  const labels: string[] = []
  if (features.partners) labels.push(FEATURE_LABELS.partners)
  if (features.invoices) labels.push(FEATURE_LABELS.invoices)
  if (features.orders) labels.push(FEATURE_LABELS.orders)
  if (features.payments) labels.push(FEATURE_LABELS.payments)
  return labels.length === 0 ? "-" : labels.join(", ")
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "-"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">-</span>
  if (status === "SUCCESS") return <Badge>成功</Badge>
  if (status === "FAILED") return <Badge variant="destructive">失敗</Badge>
  if (status === "RUNNING") return <Badge variant="secondary">実行中</Badge>
  if (status === "PENDING") return <Badge variant="secondary">待機中</Badge>
  return <Badge variant="outline">{status}</Badge>
}

export default function PwdxListPage() {
  const [items, setItems] = useState<PwdxIntegrationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listPwdxIntegrations()
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Plug className="h-6 w-6" />
            PWDX 連携
          </h1>
          <p className="text-muted-foreground">
            会社対会社の PWDX 連携設定を管理します
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>連携状況</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              管理対象の会社がありません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>会社</TableHead>
                  <TableHead>連携</TableHead>
                  <TableHead>PWDX 企業 ID</TableHead>
                  <TableHead>同期対象</TableHead>
                  <TableHead>最終同期</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.companyId}>
                    <TableCell className="font-medium">
                      {item.companyName}
                      {item.companyShortName && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({item.companyShortName})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.hasIntegration ? (
                        item.enabled ? (
                          <Badge>有効</Badge>
                        ) : (
                          <Badge variant="secondary">無効</Badge>
                        )
                      ) : (
                        <Badge variant="outline">未設定</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.pwdxCompanyId || "-"}
                    </TableCell>
                    <TableCell>{featureSummary(item.syncFeatures)}</TableCell>
                    <TableCell>{formatDateTime(item.lastSyncedAt)}</TableCell>
                    <TableCell>
                      <StatusBadge status={item.lastSyncStatus} />
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/pwdx/${item.companyId}`}>
                          設定
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
