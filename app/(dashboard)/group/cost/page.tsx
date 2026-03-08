"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { KpiCard } from "@/components/KpiCard"
import { CompanyFilter } from "@/components/group/CompanyFilter"
import { formatYen } from "@/lib/format"
import {
  COMPANIES, MONTHS, MONTH_LABELS,
  monthlyFinancials, costDetails, aggregateFinancials,
} from "@/lib/mock/group-data"
import { Hammer } from "lucide-react"
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"

export default function GroupCostPage() {
  const [selectedIds, setSelectedIds] = useState(COMPANIES.map((c) => c.id))
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[MONTHS.length - 1])

  // 月別推移
  const trendData = useMemo(() => {
    return MONTHS.map((month) => {
      const total = monthlyFinancials
        .filter((d) => selectedIds.includes(d.companyId) && d.month === month)
        .reduce((sum, d) => sum + d.cost, 0)
      return { month: MONTH_LABELS[month], 原価: total }
    })
  }, [selectedIds])

  const currentCosts = useMemo(
    () => costDetails.filter((d) => selectedIds.includes(d.companyId) && d.month === selectedMonth),
    [selectedIds, selectedMonth]
  )

  const totalCost = useMemo(
    () => aggregateFinancials(
      monthlyFinancials.filter((d) => selectedIds.includes(d.companyId) && d.month === selectedMonth)
    ).cost,
    [selectedIds, selectedMonth]
  )

  // 内訳集計
  const breakdown = useMemo(() => {
    return currentCosts.reduce(
      (acc, d) => ({
        laborCost: acc.laborCost + d.laborCost,
        legalWelfare: acc.legalWelfare + d.legalWelfare,
        materialCost: acc.materialCost + d.materialCost,
        consumptionTax: acc.consumptionTax + d.consumptionTax,
      }),
      { laborCost: 0, legalWelfare: 0, materialCost: 0, consumptionTax: 0 }
    )
  }, [currentCosts])

  // 会社別内訳 BarChart
  const companyBreakdownData = useMemo(() => {
    return currentCosts.map((d) => {
      const company = COMPANIES.find((c) => c.id === d.companyId)
      return {
        name: company?.shortName || d.companyId,
        労務費: d.laborCost,
        法定福利費: d.legalWelfare,
        材料費: d.materialCost,
        消費税: d.consumptionTax,
      }
    })
  }, [currentCosts])

  const yenFormatter = (v: number) => `¥${(v / 1_000_000).toFixed(0)}M`
  const total = breakdown.laborCost + breakdown.legalWelfare + breakdown.materialCost + breakdown.consumptionTax

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">原価分析</h1>
        <p className="text-muted-foreground">グループ全社の原価内訳を分析</p>
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
          title="当月原価合計"
          value={formatYen(totalCost)}
          icon={<Hammer className="h-4 w-4" />}
        />
        <KpiCard
          title="労務費"
          value={formatYen(breakdown.laborCost)}
          subtitle={total > 0 ? `${(breakdown.laborCost / total * 100).toFixed(1)}%` : undefined}
        />
        <KpiCard
          title="材料費"
          value={formatYen(breakdown.materialCost)}
          subtitle={total > 0 ? `${(breakdown.materialCost / total * 100).toFixed(1)}%` : undefined}
        />
        <KpiCard
          title="法定福利費"
          value={formatYen(breakdown.legalWelfare)}
          subtitle={total > 0 ? `${(breakdown.legalWelfare / total * 100).toFixed(1)}%` : undefined}
        />
      </div>

      {/* 月別推移 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">原価月別推移</CardTitle>
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
                <Line type="monotone" dataKey="原価" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 内訳 BarChart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">会社別原価内訳（{MONTH_LABELS[selectedMonth]}）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={companyBreakdownData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={yenFormatter} tick={{ fontSize: 11 }} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(v: any) => formatYen(Number(v))} />
                <Legend />
                <Bar dataKey="労務費" stackId="a" fill="#3b82f6" />
                <Bar dataKey="法定福利費" stackId="a" fill="#22c55e" />
                <Bar dataKey="材料費" stackId="a" fill="#f59e0b" />
                <Bar dataKey="消費税" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 会社別一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">会社別原価明細（{MONTH_LABELS[selectedMonth]}）</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>会社名</TableHead>
                <TableHead className="text-right">労務費</TableHead>
                <TableHead className="text-right">法定福利費</TableHead>
                <TableHead className="text-right">材料費</TableHead>
                <TableHead className="text-right">消費税</TableHead>
                <TableHead className="text-right">合計</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentCosts.map((d) => {
                const company = COMPANIES.find((c) => c.id === d.companyId)
                const rowTotal = d.laborCost + d.legalWelfare + d.materialCost + d.consumptionTax
                return (
                  <TableRow key={d.companyId}>
                    <TableCell className="font-medium">{company?.shortName}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(d.laborCost)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(d.legalWelfare)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(d.materialCost)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(d.consumptionTax)}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatYen(rowTotal)}</TableCell>
                  </TableRow>
                )
              })}
              <TableRow className="font-bold border-t-2">
                <TableCell>合計</TableCell>
                <TableCell className="text-right font-mono">{formatYen(breakdown.laborCost)}</TableCell>
                <TableCell className="text-right font-mono">{formatYen(breakdown.legalWelfare)}</TableCell>
                <TableCell className="text-right font-mono">{formatYen(breakdown.materialCost)}</TableCell>
                <TableCell className="text-right font-mono">{formatYen(breakdown.consumptionTax)}</TableCell>
                <TableCell className="text-right font-mono">{formatYen(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
