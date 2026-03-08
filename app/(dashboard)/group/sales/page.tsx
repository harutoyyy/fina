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
  monthlyFinancials, salesDetails, aggregateFinancials,
} from "@/lib/mock/group-data"
import { TrendingUp, AlertCircle } from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"

export default function GroupSalesPage() {
  const [selectedIds, setSelectedIds] = useState(COMPANIES.map((c) => c.id))
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[MONTHS.length - 1])

  // 月別推移データ
  const trendData = useMemo(() => {
    return MONTHS.map((month) => {
      const items = monthlyFinancials.filter(
        (d) => selectedIds.includes(d.companyId) && d.month === month
      )
      const total = items.reduce((sum, d) => sum + d.sales, 0)
      return { month: MONTH_LABELS[month], 売上: total }
    })
  }, [selectedIds])

  // 当月の売上明細
  const currentSales = useMemo(
    () => salesDetails.filter((d) => selectedIds.includes(d.companyId) && d.month === selectedMonth),
    [selectedIds, selectedMonth]
  )

  const totalSales = useMemo(
    () => aggregateFinancials(
      monthlyFinancials.filter((d) => selectedIds.includes(d.companyId) && d.month === selectedMonth)
    ).sales,
    [selectedIds, selectedMonth]
  )

  const totalReceived = currentSales.reduce((sum, d) => sum + d.receivedAmount, 0)
  const totalAmount = currentSales.reduce((sum, d) => sum + d.amount, 0)
  const receivedRate = totalAmount > 0 ? (totalReceived / totalAmount * 100).toFixed(1) : "0.0"

  // 取引先別集計
  const partnerSummary = useMemo(() => {
    const map = new Map<string, { amount: number; received: number }>()
    for (const d of currentSales) {
      const existing = map.get(d.partnerName) || { amount: 0, received: 0 }
      map.set(d.partnerName, {
        amount: existing.amount + d.amount,
        received: existing.received + d.receivedAmount,
      })
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, rate: v.amount > 0 ? (v.received / v.amount * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount)
  }, [currentSales])

  // 未入金一覧
  const unpaid = currentSales.filter((d) => d.receivedRate < 100)

  const yenFormatter = (v: number) => `¥${(v / 1_000_000).toFixed(0)}M`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">売上分析</h1>
        <p className="text-muted-foreground">グループ全社の売上状況を分析</p>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="当月売上"
          value={formatYen(totalSales)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiCard
          title="入金額"
          value={formatYen(totalReceived)}
          subtitle={`入金率 ${receivedRate}%`}
        />
        <KpiCard
          title="未入金件数"
          value={`${unpaid.length}件`}
          subtitle={`未入金額 ${formatYen(totalAmount - totalReceived)}`}
          icon={<AlertCircle className="h-4 w-4" />}
          valueClassName={unpaid.length > 0 ? "text-amber-600" : ""}
        />
        <KpiCard
          title="取引先数"
          value={`${partnerSummary.length}社`}
        />
      </div>

      {/* 月別推移 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">売上月別推移</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={yenFormatter} tick={{ fontSize: 11 }} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(v: any) => formatYen(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="売上" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 取引先別 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">取引先別売上（{MONTH_LABELS[selectedMonth]}）</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>取引先</TableHead>
                <TableHead className="text-right">売上額</TableHead>
                <TableHead className="text-right">入金額</TableHead>
                <TableHead className="text-right">入金率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partnerSummary.map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right font-mono">{formatYen(p.amount)}</TableCell>
                  <TableCell className="text-right font-mono">{formatYen(p.received)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={p.rate === 100 ? "default" : "outline"}>
                      {p.rate.toFixed(0)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 未入金一覧 */}
      {unpaid.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">未入金一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>会社</TableHead>
                  <TableHead>取引先</TableHead>
                  <TableHead className="text-right">売上額</TableHead>
                  <TableHead className="text-right">入金額</TableHead>
                  <TableHead className="text-right">未入金額</TableHead>
                  <TableHead className="text-right">入金率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unpaid.map((d, i) => {
                  const company = COMPANIES.find((c) => c.id === d.companyId)
                  return (
                    <TableRow key={i}>
                      <TableCell>{company?.shortName}</TableCell>
                      <TableCell>{d.partnerName}</TableCell>
                      <TableCell className="text-right font-mono">{formatYen(d.amount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatYen(d.receivedAmount)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {formatYen(d.amount - d.receivedAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{d.receivedRate}%</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
