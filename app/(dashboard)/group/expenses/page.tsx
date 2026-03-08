"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { KpiCard } from "@/components/KpiCard"
import { CompanyFilter } from "@/components/group/CompanyFilter"
import { formatYen } from "@/lib/format"
import {
  COMPANIES, MONTHS, MONTH_LABELS,
  monthlyFinancials, expenseDetails, aggregateFinancials,
} from "@/lib/mock/group-data"
import { Receipt } from "lucide-react"
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"

const PIE_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
  "#84cc16", "#d946ef", "#0ea5e9", "#e11d48", "#a3e635",
]

export default function GroupExpensesPage() {
  const [selectedIds, setSelectedIds] = useState(COMPANIES.map((c) => c.id))
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[MONTHS.length - 1])

  // 月別推移
  const trendData = useMemo(() => {
    return MONTHS.map((month) => {
      const total = monthlyFinancials
        .filter((d) => selectedIds.includes(d.companyId) && d.month === month)
        .reduce((sum, d) => sum + d.expenses, 0)
      return { month: MONTH_LABELS[month], 経費: total }
    })
  }, [selectedIds])

  const currentExpenses = useMemo(
    () => expenseDetails.filter((d) => selectedIds.includes(d.companyId) && d.month === selectedMonth),
    [selectedIds, selectedMonth]
  )

  const totalExpenses = useMemo(
    () => aggregateFinancials(
      monthlyFinancials.filter((d) => selectedIds.includes(d.companyId) && d.month === selectedMonth)
    ).expenses,
    [selectedIds, selectedMonth]
  )

  // 科目別集計
  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of currentExpenses) {
      map.set(d.category, (map.get(d.category) || 0) + d.amount)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [currentExpenses])

  // 取引先ランキング
  const partnerRanking = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of currentExpenses) {
      map.set(d.partnerName, (map.get(d.partnerName) || 0) + d.amount)
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
  }, [currentExpenses])

  const yenFormatter = (v: number) => `¥${(v / 1_000_000).toFixed(0)}M`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">経費分析</h1>
        <p className="text-muted-foreground">グループ全社の経費状況を分析</p>
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
          title="当月経費合計"
          value={formatYen(totalExpenses)}
          icon={<Receipt className="h-4 w-4" />}
        />
        <KpiCard
          title="経費件数"
          value={`${currentExpenses.length}件`}
        />
        <KpiCard
          title="科目数"
          value={`${categoryData.length}科目`}
        />
        <KpiCard
          title="平均単価"
          value={formatYen(currentExpenses.length > 0 ? Math.round(totalExpenses / currentExpenses.length) : 0)}
        />
      </div>

      {/* 月別推移 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">経費月別推移</CardTitle>
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
                <Line type="monotone" dataKey="経費" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 科目別 PieChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">科目別内訳</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={10}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={(v: any) => formatYen(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 取引先ランキング */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">取引先ランキング TOP10</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>取引先</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnerRanking.map((p, i) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium">{i + 1}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
