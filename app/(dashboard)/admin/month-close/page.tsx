"use client"

// ============================================================
// 月締め状況画面 (Phase 4)
// ============================================================
// 設計: docs/admin_master_plan.md §P4 月締め状況
//   - 会社 × 月 のマトリクス
//   - 直近 6 ヶ月表示、月切替
//   - 「未締」セルクリック → 資金繰り表に遷移
//   - SUPER_ADMIN: 全社、COMPANY_ADMIN: 自社のみ
// ============================================================

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import {
  getMonthCloseMatrix,
  type MonthCloseMatrix,
  type MonthCloseCellStatus,
} from "@/app/actions/month-close-status"

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function shiftMonth(ym: string, delta: number): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/)
  if (!m) return getCurrentMonth()
  let year = parseInt(m[1], 10)
  let month = parseInt(m[2], 10) + delta
  while (month <= 0) {
    month += 12
    year -= 1
  }
  while (month > 12) {
    month -= 12
    year += 1
  }
  return `${year}-${String(month).padStart(2, "0")}`
}

function formatYearMonth(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/)
  if (!m) return ym
  return `${m[1]}年${parseInt(m[2], 10)}月`
}

function StatusCell({
  status,
  onClick,
}: {
  status: MonthCloseCellStatus
  onClick?: () => void
}) {
  const clickable = !!onClick
  const baseCls = clickable ? "cursor-pointer hover:opacity-80" : ""
  if (status === "CLOSED") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!clickable}
        className={`inline-flex items-center justify-center w-full ${baseCls}`}
      >
        <Badge className="bg-emerald-600 hover:bg-emerald-700">締済</Badge>
      </button>
    )
  }
  if (status === "OPEN") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!clickable}
        className={`inline-flex items-center justify-center w-full ${baseCls}`}
      >
        <Badge variant="outline" className="text-orange-700 border-orange-400">
          未締
        </Badge>
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`inline-flex items-center justify-center w-full ${baseCls}`}
    >
      <Badge variant="outline" className="text-muted-foreground">
        記録なし
      </Badge>
    </button>
  )
}

export default function MonthCloseStatusPage() {
  const router = useRouter()
  const [baseMonth, setBaseMonth] = useState<string>(getCurrentMonth())
  const [months] = useState(6)
  const [matrix, setMatrix] = useState<MonthCloseMatrix | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMonthCloseMatrix({ baseMonth, months })
      setMatrix(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました")
      setMatrix(null)
    } finally {
      setLoading(false)
    }
  }, [baseMonth, months])

  useEffect(() => {
    load()
  }, [load])

  const navigateToCashflow = (companyId: string, yearMonth: string) => {
    // 資金繰り表画面に遷移。selectedCompanyId を localStorage に書いて
    // 既存の company-context が拾えるようにする。
    try {
      localStorage.setItem("selectedCompanyId", companyId)
    } catch {
      // localStorage 不可環境では無視
    }
    router.push(`/cashflow-table?month=${encodeURIComponent(yearMonth)}`)
  }

  // 集計
  const summary = (() => {
    if (!matrix) return null
    let closed = 0
    let open = 0
    let none = 0
    for (const row of matrix.rows) {
      for (const cell of row.cells) {
        if (cell.status === "CLOSED") closed += 1
        else if (cell.status === "OPEN") open += 1
        else none += 1
      }
    }
    return { closed, open, none, total: closed + open + none }
  })()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarCheck className="h-6 w-6" />
            月締め状況
          </h1>
          <p className="text-muted-foreground">
            会社ごとの月締め進捗を一覧します
            {matrix?.canSeeAllCompanies ? "（SUPER_ADMIN: 全社）" : "（自社のみ）"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">表示範囲</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBaseMonth((m) => shiftMonth(m, -1))}
              disabled={loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Label className="text-sm whitespace-nowrap">基準月</Label>
            <Input
              type="month"
              value={baseMonth}
              onChange={(e) => setBaseMonth(e.target.value || getCurrentMonth())}
              className="w-40"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBaseMonth((m) => shiftMonth(m, 1))}
              disabled={loading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBaseMonth(getCurrentMonth())}
              disabled={loading}
            >
              今月
            </Button>
          </div>
        </CardHeader>
        {summary && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">集計対象</div>
                <div className="text-lg font-semibold mt-1">{summary.total}</div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">締済</div>
                <div className="text-lg font-semibold mt-1 text-emerald-600">
                  {summary.closed}
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">未締</div>
                <div className="text-lg font-semibold mt-1 text-orange-600">
                  {summary.open}
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">記録なし</div>
                <div className="text-lg font-semibold mt-1 text-muted-foreground">
                  {summary.none}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">マトリクス</CardTitle>
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
          ) : !matrix || matrix.rows.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              表示できる会社がありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">
                      会社
                    </TableHead>
                    {matrix.yearMonths.map((ym) => (
                      <TableHead
                        key={ym}
                        className="text-center whitespace-nowrap min-w-[110px]"
                      >
                        {formatYearMonth(ym)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrix.rows.map((row) => (
                    <TableRow key={row.companyId}>
                      <TableCell className="sticky left-0 bg-background font-medium z-10">
                        {row.companyShortName ?? row.companyName}
                      </TableCell>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.yearMonth} className="text-center p-2">
                          <StatusCell
                            status={cell.status}
                            onClick={() =>
                              navigateToCashflow(row.companyId, cell.yearMonth)
                            }
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
