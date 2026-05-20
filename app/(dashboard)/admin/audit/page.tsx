"use client"

// ============================================================
// 監査ログ画面 (Phase 4)
// ============================================================
// 設計: docs/admin_and_auth_design.md §6.8
// マスタープラン: docs/admin_master_plan.md §P4
//   - フィルタ: 期間 / ユーザー / アクション / 対象タイプ
//   - 詳細パネル (payload JSON 整形表示)
//   - CSV エクスポート
//   - SUPER_ADMIN は全社、COMPANY_ADMIN は自社のみ
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Download, FileText, Loader2, ScrollText } from "lucide-react"
import {
  listAuditLogs,
  getAuditLogFacets,
  exportAuditLogsCsv,
  type AuditLogListItem,
  type AuditLogListResult,
} from "@/app/actions/audit-logs"

type FilterState = {
  from: string
  to: string
  userId: string
  action: string
  targetType: string
  query: string
}

const INITIAL_FILTER: FilterState = {
  from: "",
  to: "",
  userId: "",
  action: "ALL",
  targetType: "ALL",
  query: "",
}

function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export default function AuditLogPage() {
  const [filter, setFilter] = useState<FilterState>(INITIAL_FILTER)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [result, setResult] = useState<AuditLogListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actions, setActions] = useState<string[]>([])
  const [targetTypes, setTargetTypes] = useState<string[]>([])
  const [detailItem, setDetailItem] = useState<AuditLogListItem | null>(null)
  const [exporting, setExporting] = useState(false)

  const filterForServer = useMemo(
    () => ({
      from: filter.from || null,
      to: filter.to || null,
      userId: filter.userId.trim() || null,
      action: filter.action === "ALL" ? null : filter.action,
      targetType: filter.targetType === "ALL" ? null : filter.targetType,
      query: filter.query.trim() || null,
    }),
    [filter],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAuditLogs(filterForServer, { page, pageSize })
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました")
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [filterForServer, page, pageSize])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const facets = await getAuditLogFacets()
        if (!cancelled) {
          setActions(facets.actions)
          setTargetTypes(facets.targetTypes)
        }
      } catch {
        // ファセット取得失敗は致命ではない
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleReset = () => {
    setFilter(INITIAL_FILTER)
    setPage(1)
  }

  const handleSearch = () => {
    setPage(1)
    load()
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const csv = await exportAuditLogsCsv(filterForServer)
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const ts = new Date()
        .toISOString()
        .replace(/[-:T]/g, "")
        .slice(0, 14)
      a.download = `audit-logs-${ts}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : "エクスポートに失敗しました")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ScrollText className="h-6 w-6" />
            監査ログ
          </h1>
          <p className="text-muted-foreground">
            ユーザー操作の履歴を検索・確認します
            {result?.canSeeAllCompanies ? "（SUPER_ADMIN: 全社可視）" : "（自社のみ）"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exporting || loading}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1" />
          )}
          CSV エクスポート
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">フィルタ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-sm">期間 開始</Label>
              <Input
                type="date"
                value={filter.from}
                onChange={(e) => setFilter({ ...filter, from: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">期間 終了</Label>
              <Input
                type="date"
                value={filter.to}
                onChange={(e) => setFilter({ ...filter, to: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">ユーザーID</Label>
              <Input
                placeholder="User.id (better-auth)"
                value={filter.userId}
                onChange={(e) => setFilter({ ...filter, userId: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">アクション</Label>
              <Select
                value={filter.action}
                onValueChange={(v) => setFilter({ ...filter, action: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  {actions.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">対象タイプ</Label>
              <Select
                value={filter.targetType}
                onValueChange={(v) => setFilter({ ...filter, targetType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  {targetTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">フリーワード</Label>
              <Input
                placeholder="recordId / 理由 部分一致"
                value={filter.query}
                onChange={(e) => setFilter({ ...filter, query: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleReset}>
              リセット
            </Button>
            <Button onClick={handleSearch}>検索</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            一覧
            {result && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {result.total.toLocaleString()} 件
              </span>
            )}
          </CardTitle>
          {result && result.totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                前へ
              </Button>
              <span className="text-sm">
                {page} / {result.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= result.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                次へ
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive mb-3">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              読み込み中…
            </div>
          ) : !result || result.items.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              該当する監査ログはありません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">日時</TableHead>
                  <TableHead>ユーザー</TableHead>
                  <TableHead>会社</TableHead>
                  <TableHead>アクション</TableHead>
                  <TableHead>対象タイプ</TableHead>
                  <TableHead>対象ID</TableHead>
                  <TableHead>理由</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {formatDateTime(item.createdAt)}
                    </TableCell>
                    <TableCell>
                      {item.userName ?? (
                        <span className="text-muted-foreground">不明</span>
                      )}
                      {item.userEmail && (
                        <div className="text-xs text-muted-foreground">{item.userEmail}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.companyName ?? (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {item.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.targetType}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[160px] truncate">
                      {item.targetId}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {item.reason ?? ""}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailItem(item)}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailItem} onOpenChange={(o) => !o && setDetailItem(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>監査ログ詳細</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">日時</div>
                  <div className="font-mono">{formatDateTime(detailItem.createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">アクション</div>
                  <div className="font-mono">{detailItem.action}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">対象</div>
                  <div>
                    {detailItem.targetType}
                    <div className="font-mono text-xs text-muted-foreground break-all">
                      {detailItem.targetId}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">ユーザー</div>
                  <div>
                    {detailItem.userName ?? "不明"}
                    {detailItem.userEmail && (
                      <div className="text-xs text-muted-foreground">{detailItem.userEmail}</div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">会社</div>
                  <div>{detailItem.companyName ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">IP / UA</div>
                  <div className="text-xs">
                    {detailItem.ipAddress ?? "-"}
                    {detailItem.userAgent && (
                      <div className="text-muted-foreground break-all">{detailItem.userAgent}</div>
                    )}
                  </div>
                </div>
              </div>

              {detailItem.reason && (
                <div>
                  <div className="text-xs text-muted-foreground">理由</div>
                  <div>{detailItem.reason}</div>
                </div>
              )}

              {detailItem.payload && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">payload (after)</div>
                  <pre className="bg-muted rounded p-3 text-xs overflow-x-auto max-h-[300px]">
                    {JSON.stringify(detailItem.payload, null, 2)}
                  </pre>
                </div>
              )}

              {detailItem.before && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">before</div>
                  <pre className="bg-muted rounded p-3 text-xs overflow-x-auto max-h-[300px]">
                    {JSON.stringify(detailItem.before, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
