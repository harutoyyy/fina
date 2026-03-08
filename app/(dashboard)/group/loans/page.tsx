"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { KpiCard } from "@/components/KpiCard"
import { CompanyFilter } from "@/components/group/CompanyFilter"
import { formatYen } from "@/lib/format"
import {
  COMPANIES, loanContracts, leaseContracts,
} from "@/lib/mock/group-data"
import { Landmark, Repeat } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"

export default function GroupLoansPage() {
  const [selectedIds, setSelectedIds] = useState(COMPANIES.map((c) => c.id))

  const filteredLoans = useMemo(
    () => loanContracts.filter((d) => selectedIds.includes(d.companyId)),
    [selectedIds]
  )

  const filteredLeases = useMemo(
    () => leaseContracts.filter((d) => selectedIds.includes(d.companyId)),
    [selectedIds]
  )

  const loanTotals = useMemo(() => ({
    principal: filteredLoans.reduce((s, d) => s + d.principalAmount, 0),
    remaining: filteredLoans.reduce((s, d) => s + d.remainingBalance, 0),
    monthly: filteredLoans.reduce((s, d) => s + d.monthlyPayment, 0),
  }), [filteredLoans])

  const leaseTotals = useMemo(() => ({
    total: filteredLeases.reduce((s, d) => s + d.totalAmount, 0),
    remaining: filteredLeases.reduce((s, d) => s + d.remainingBalance, 0),
    monthly: filteredLeases.reduce((s, d) => s + d.monthlyPayment, 0),
  }), [filteredLeases])

  // 会社別残高 BarChart
  const balanceData = useMemo(() => {
    const map = new Map<string, { loan: number; lease: number }>()
    for (const id of selectedIds) {
      const company = COMPANIES.find((c) => c.id === id)
      if (!company) continue
      const loanBal = filteredLoans
        .filter((d) => d.companyId === id)
        .reduce((s, d) => s + d.remainingBalance, 0)
      const leaseBal = filteredLeases
        .filter((d) => d.companyId === id)
        .reduce((s, d) => s + d.remainingBalance, 0)
      if (loanBal > 0 || leaseBal > 0) {
        map.set(company.shortName, { loan: loanBal, lease: leaseBal })
      }
    }
    return Array.from(map.entries()).map(([name, v]) => ({
      name,
      借入残高: v.loan,
      リース残高: v.lease,
    }))
  }, [selectedIds, filteredLoans, filteredLeases])

  const yenFormatter = (v: number) => `¥${(v / 1_000_000).toFixed(0)}M`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">借入・リース</h1>
        <p className="text-muted-foreground">グループ全社の借入金・リース契約を管理</p>
      </div>

      <CompanyFilter selectedIds={selectedIds} onChange={setSelectedIds} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="借入残高合計"
          value={formatYen(loanTotals.remaining)}
          icon={<Landmark className="h-4 w-4" />}
          subtitle={`${filteredLoans.length}件`}
        />
        <KpiCard
          title="借入月額返済"
          value={formatYen(loanTotals.monthly)}
        />
        <KpiCard
          title="リース残高合計"
          value={formatYen(leaseTotals.remaining)}
          icon={<Repeat className="h-4 w-4" />}
          subtitle={`${filteredLeases.length}件`}
        />
        <KpiCard
          title="リース月額支払"
          value={formatYen(leaseTotals.monthly)}
        />
      </div>

      {/* 会社別残高 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">会社別 借入・リース残高</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={balanceData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={yenFormatter} tick={{ fontSize: 11 }} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(v: any) => formatYen(Number(v))} />
                <Legend />
                <Bar dataKey="借入残高" fill="#3b82f6" />
                <Bar dataKey="リース残高" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 借入契約一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">借入契約一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>会社</TableHead>
                <TableHead>銀行</TableHead>
                <TableHead className="text-right">借入額</TableHead>
                <TableHead className="text-right">残高</TableHead>
                <TableHead className="text-right">金利</TableHead>
                <TableHead className="text-right">月額返済</TableHead>
                <TableHead>期間</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLoans.map((loan) => {
                const company = COMPANIES.find((c) => c.id === loan.companyId)
                return (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{company?.shortName}</TableCell>
                    <TableCell>{loan.bankName}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(loan.principalAmount)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(loan.remainingBalance)}</TableCell>
                    <TableCell className="text-right">{loan.interestRate}%</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(loan.monthlyPayment)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {loan.startDate} ~ {loan.endDate}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* リース契約一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">リース契約一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>会社</TableHead>
                <TableHead>リース会社</TableHead>
                <TableHead>物件名</TableHead>
                <TableHead className="text-right">契約額</TableHead>
                <TableHead className="text-right">残高</TableHead>
                <TableHead className="text-right">月額</TableHead>
                <TableHead>期間</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeases.map((lease) => {
                const company = COMPANIES.find((c) => c.id === lease.companyId)
                return (
                  <TableRow key={lease.id}>
                    <TableCell className="font-medium">{company?.shortName}</TableCell>
                    <TableCell>{lease.lessorName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{lease.itemName}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatYen(lease.totalAmount)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(lease.remainingBalance)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(lease.monthlyPayment)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {lease.startDate} ~ {lease.endDate}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
