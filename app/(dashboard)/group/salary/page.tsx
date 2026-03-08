"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { KpiCard } from "@/components/KpiCard"
import { CompanyFilter } from "@/components/group/CompanyFilter"
import { formatYen } from "@/lib/format"
import {
  COMPANIES, MONTHS, MONTH_LABELS, salaryDetails,
} from "@/lib/mock/group-data"
import { Users } from "lucide-react"
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"

export default function GroupSalaryPage() {
  const [selectedIds, setSelectedIds] = useState(COMPANIES.map((c) => c.id))
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[MONTHS.length - 1])

  const currentSalary = useMemo(
    () => salaryDetails.filter((d) => selectedIds.includes(d.companyId) && d.month === selectedMonth),
    [selectedIds, selectedMonth]
  )

  const totals = useMemo(() => {
    return currentSalary.reduce(
      (acc, d) => ({
        headcount: acc.headcount + d.headcount,
        grossPay: acc.grossPay + d.grossPay,
        deductions: acc.deductions + d.deductions,
        netPay: acc.netPay + d.netPay,
        reserve: acc.reserve + d.reserve,
      }),
      { headcount: 0, grossPay: 0, deductions: 0, netPay: 0, reserve: 0 }
    )
  }, [currentSalary])

  // グループ別（業種別）
  const industryData = useMemo(() => {
    const map = new Map<string, { grossPay: number; deductions: number; netPay: number; headcount: number }>()
    for (const d of currentSalary) {
      const company = COMPANIES.find((c) => c.id === d.companyId)
      const industry = company?.industry || "その他"
      const existing = map.get(industry) || { grossPay: 0, deductions: 0, netPay: 0, headcount: 0 }
      map.set(industry, {
        grossPay: existing.grossPay + d.grossPay,
        deductions: existing.deductions + d.deductions,
        netPay: existing.netPay + d.netPay,
        headcount: existing.headcount + d.headcount,
      })
    }
    return Array.from(map.entries()).map(([name, v]) => ({
      name,
      総支給: v.grossPay,
      控除: v.deductions,
      差引支給: v.netPay,
      headcount: v.headcount,
    }))
  }, [currentSalary])

  // 積立推移
  const reserveTrend = useMemo(() => {
    return MONTHS.map((month) => {
      const items = salaryDetails.filter(
        (d) => selectedIds.includes(d.companyId) && d.month === month
      )
      return {
        month: MONTH_LABELS[month],
        積立金: items.reduce((sum, d) => sum + d.reserve, 0),
      }
    })
  }, [selectedIds])

  const yenFormatter = (v: number) => `¥${(v / 1_000_000).toFixed(0)}M`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">給与分析</h1>
        <p className="text-muted-foreground">グループ全社の給与状況を分析</p>
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
          title="総支給額"
          value={formatYen(totals.grossPay)}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          title="差引支給額"
          value={formatYen(totals.netPay)}
        />
        <KpiCard
          title="総人員"
          value={`${totals.headcount}名`}
        />
        <KpiCard
          title="一人当たり平均"
          value={formatYen(totals.headcount > 0 ? Math.round(totals.grossPay / totals.headcount) : 0)}
        />
      </div>

      {/* グループ（業種）別 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">業種別 支給・控除内訳（{MONTH_LABELS[selectedMonth]}）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={industryData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={yenFormatter} tick={{ fontSize: 11 }} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(v: any) => formatYen(Number(v))} />
                <Legend />
                <Bar dataKey="総支給" fill="#3b82f6" />
                <Bar dataKey="控除" fill="#ef4444" />
                <Bar dataKey="差引支給" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 積立推移 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">積立金推移</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reserveTrend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={yenFormatter} tick={{ fontSize: 11 }} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(v: any) => formatYen(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="積立金" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 会社別一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">会社別給与明細（{MONTH_LABELS[selectedMonth]}）</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>会社名</TableHead>
                <TableHead className="text-right">人数</TableHead>
                <TableHead className="text-right">総支給額</TableHead>
                <TableHead className="text-right">控除合計</TableHead>
                <TableHead className="text-right">差引支給額</TableHead>
                <TableHead className="text-right">積立金</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentSalary.map((d) => {
                const company = COMPANIES.find((c) => c.id === d.companyId)
                return (
                  <TableRow key={d.companyId}>
                    <TableCell className="font-medium">{company?.shortName}</TableCell>
                    <TableCell className="text-right">{d.headcount}名</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(d.grossPay)}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">{formatYen(d.deductions)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(d.netPay)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(d.reserve)}</TableCell>
                  </TableRow>
                )
              })}
              <TableRow className="font-bold border-t-2">
                <TableCell>合計</TableCell>
                <TableCell className="text-right">{totals.headcount}名</TableCell>
                <TableCell className="text-right font-mono">{formatYen(totals.grossPay)}</TableCell>
                <TableCell className="text-right font-mono text-red-600">{formatYen(totals.deductions)}</TableCell>
                <TableCell className="text-right font-mono">{formatYen(totals.netPay)}</TableCell>
                <TableCell className="text-right font-mono">{formatYen(totals.reserve)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
