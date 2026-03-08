"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { KpiCard } from "@/components/KpiCard"
import { CompanyFilter } from "@/components/group/CompanyFilter"
import { formatYen } from "@/lib/format"
import {
  COMPANIES, MONTHS, MONTH_LABELS,
  monthlyFinancials, monthlyCloses, aggregateFinancials, getFinancials,
  type CloseStatus,
} from "@/lib/mock/group-data"
import { TrendingUp, TrendingDown, Building2, CalendarCheck } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"

const STATUS_BADGE: Record<CloseStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  closed: { label: "締済", variant: "default" },
  in_progress: { label: "処理中", variant: "secondary" },
  open: { label: "未着手", variant: "outline" },
}

export default function GroupOverviewPage() {
  const [selectedIds, setSelectedIds] = useState(COMPANIES.map((c) => c.id))
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[MONTHS.length - 1])

  const currentData = useMemo(
    () => getFinancials(selectedIds, selectedMonth),
    [selectedIds, selectedMonth]
  )
  const totals = useMemo(() => aggregateFinancials(currentData), [currentData])

  const prevMonth = MONTHS[MONTHS.indexOf(selectedMonth) - 1]
  const prevTotals = prevMonth
    ? aggregateFinancials(getFinancials(selectedIds, prevMonth))
    : null

  const salesChange = prevTotals
    ? ((totals.sales - prevTotals.sales) / prevTotals.sales * 100).toFixed(1)
    : null

  // 会社別比較チャートデータ
  const barData = useMemo(() => {
    return currentData.map((d) => {
      const company = COMPANIES.find((c) => c.id === d.companyId)
      return {
        name: company?.shortName || d.companyId,
        売上: d.sales,
        経費: d.expenses,
        原価: d.cost,
        給与: d.salary,
        利益: d.profit,
      }
    })
  }, [currentData])

  // 月締め状況
  const closeStatuses = useMemo(
    () => monthlyCloses.filter((c) => selectedIds.includes(c.companyId) && c.month === selectedMonth),
    [selectedIds, selectedMonth]
  )

  const closedCount = closeStatuses.filter((c) => c.status === "closed").length

  const yenFormatter = (v: number) => `¥${(v / 1_000_000).toFixed(0)}M`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">全社概要</h1>
        <p className="text-muted-foreground">グループ全社の財務状況を横断的に確認</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <CompanyFilter selectedIds={selectedIds} onChange={setSelectedIds} />
        <div className="flex gap-1.5 flex-wrap">
          {MONTHS.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                m === selectedMonth
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-accent"
              }`}
            >
              {MONTH_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="グループ売上"
          value={formatYen(totals.sales)}
          subtitle={salesChange ? `前月比 ${Number(salesChange) >= 0 ? "+" : ""}${salesChange}%` : undefined}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiCard
          title="グループ利益"
          value={formatYen(totals.profit)}
          valueClassName={totals.profit >= 0 ? "text-green-600" : "text-red-600"}
          icon={<TrendingDown className="h-4 w-4" />}
          subtitle={`利益率 ${totals.sales > 0 ? (totals.profit / totals.sales * 100).toFixed(1) : 0}%`}
        />
        <KpiCard
          title="対象会社数"
          value={`${selectedIds.length}社`}
          icon={<Building2 className="h-4 w-4" />}
          subtitle={`全${COMPANIES.length}社中`}
        />
        <KpiCard
          title="月締め状況"
          value={`${closedCount} / ${closeStatuses.length}`}
          icon={<CalendarCheck className="h-4 w-4" />}
          subtitle="締済 / 全社"
        />
      </div>

      {/* 会社別比較 BarChart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">会社別 売上・利益比較</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={yenFormatter} tick={{ fontSize: 11 }} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(v: any) => formatYen(Number(v))} />
                <Legend />
                <Bar dataKey="売上" fill="#3b82f6" />
                <Bar dataKey="利益" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* PL一覧テーブル */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">損益一覧（{MONTH_LABELS[selectedMonth]}）</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>会社名</TableHead>
                <TableHead className="text-right">売上</TableHead>
                <TableHead className="text-right">経費</TableHead>
                <TableHead className="text-right">原価</TableHead>
                <TableHead className="text-right">給与</TableHead>
                <TableHead className="text-right">利益</TableHead>
                <TableHead className="text-right">利益率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentData.map((d) => {
                const company = COMPANIES.find((c) => c.id === d.companyId)
                const margin = d.sales > 0 ? (d.profit / d.sales * 100).toFixed(1) : "0.0"
                return (
                  <TableRow key={d.companyId}>
                    <TableCell className="font-medium">{company?.shortName}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(d.sales)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(d.expenses)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(d.cost)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(d.salary)}</TableCell>
                    <TableCell className={`text-right font-mono font-medium ${d.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatYen(d.profit)}
                    </TableCell>
                    <TableCell className={`text-right ${Number(margin) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {margin}%
                    </TableCell>
                  </TableRow>
                )
              })}
              <TableRow className="font-bold border-t-2">
                <TableCell>合計</TableCell>
                <TableCell className="text-right font-mono">{formatYen(totals.sales)}</TableCell>
                <TableCell className="text-right font-mono">{formatYen(totals.expenses)}</TableCell>
                <TableCell className="text-right font-mono">{formatYen(totals.cost)}</TableCell>
                <TableCell className="text-right font-mono">{formatYen(totals.salary)}</TableCell>
                <TableCell className={`text-right font-mono ${totals.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatYen(totals.profit)}
                </TableCell>
                <TableCell className={`text-right ${totals.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {totals.sales > 0 ? (totals.profit / totals.sales * 100).toFixed(1) : "0.0"}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 月締め状況 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">月締め状況（{MONTH_LABELS[selectedMonth]}）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {closeStatuses.map((cs) => {
              const company = COMPANIES.find((c) => c.id === cs.companyId)
              const badge = STATUS_BADGE[cs.status]
              return (
                <div key={cs.companyId} className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5">
                  <span className="text-sm">{company?.shortName}</span>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
