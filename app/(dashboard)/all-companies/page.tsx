"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Layers, TrendingUp, TrendingDown, Inbox, FileText, Wallet } from "lucide-react"
import {
  getAllCompaniesCashFlow,
  getAllCompaniesExpenses,
  getAllCompaniesSales,
  getAllCompaniesExpenseBox,
  getAllCompaniesSummary,
  type AllCompaniesRow,
} from "@/app/actions/all-companies"
import { Pagination } from "@/components/pagination"
import { formatYen, formatDate, getCurrentMonth } from "@/lib/format"

const TYPE_LABELS: Record<string, string> = {
  EXPENSE: "経費",
  SALES: "売上",
  COST_PAYMENT: "原価",
  SALARY: "給与",
  LOAN: "借入",
  TRANSFER: "振替",
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "下書き",
  READY: "準備完了",
  CONFIRMED: "確定済",
  CANCELLED: "取消",
}

const PAYMENT_LABELS: Record<string, string> = {
  BANK_TRANSFER: "振込",
  DIRECT_DEBIT: "引落",
  CASH_WITHDRAWAL: "現金",
}

type ListState = {
  rows: AllCompaniesRow[]
  total: number
  totalPages: number
  totalAmount: string
  totalDeposit?: string
  totalWithdrawal?: string
  loading: boolean
}

const initialList: ListState = { rows: [], total: 0, totalPages: 0, totalAmount: "0", loading: false }

function CompanyBadge({ row }: { row: AllCompaniesRow }) {
  return (
    <Badge variant="outline" className="font-normal">
      {row.companyShortName || row.companyName}
    </Badge>
  )
}

function CommonTable({
  rows,
  showCashFlow = false,
}: {
  rows: AllCompaniesRow[]
  showCashFlow?: boolean
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-center py-8">データがありません</p>
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">会社</TableHead>
            <TableHead className="whitespace-nowrap">予定日</TableHead>
            <TableHead className="whitespace-nowrap">実出納日</TableHead>
            <TableHead className="whitespace-nowrap">計上月</TableHead>
            <TableHead className="whitespace-nowrap">種別</TableHead>
            <TableHead className="whitespace-nowrap">取引先</TableHead>
            <TableHead className="whitespace-nowrap">摘要</TableHead>
            <TableHead className="whitespace-nowrap">口座</TableHead>
            {showCashFlow && <TableHead className="whitespace-nowrap">支払方法</TableHead>}
            <TableHead className="text-right whitespace-nowrap">金額</TableHead>
            <TableHead className="whitespace-nowrap">状態</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const amt = Number(r.amount)
            return (
              <TableRow key={r.id}>
                <TableCell>
                  <CompanyBadge row={r} />
                </TableCell>
                <TableCell className="whitespace-nowrap">{r.scheduledDate ? formatDate(r.scheduledDate) : "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.transactionDate ? formatDate(r.transactionDate) : "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{r.accountingMonth || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{TYPE_LABELS[r.type] || r.type}</Badge>
                </TableCell>
                <TableCell className="max-w-[180px] truncate">{r.partnerName || "—"}</TableCell>
                <TableCell className="max-w-[220px] truncate text-sm">{r.summary || "—"}</TableCell>
                <TableCell className="text-sm max-w-[180px] truncate">{r.accountLabel || "—"}</TableCell>
                {showCashFlow && (
                  <TableCell className="text-sm">{r.paymentMethod ? PAYMENT_LABELS[r.paymentMethod] || r.paymentMethod : "—"}</TableCell>
                )}
                <TableCell className={`text-right font-mono ${amt > 0 ? "text-green-600" : amt < 0 ? "text-red-600" : ""}`}>
                  {amt > 0 ? "+" : ""}{formatYen(amt)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{STATUS_LABELS[r.status] || r.status}</Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export default function AllCompaniesPage() {
  const [yearMonth, setYearMonth] = useState(getCurrentMonth())
  const [tab, setTab] = useState("cashflow")
  const [summary, setSummary] = useState<{ companyCount: number; expenseCount: number; salesCount: number; expenseBoxCount: number; transactionCount: number } | null>(null)

  const [cashFlow, setCashFlow] = useState<ListState>(initialList)
  const [cashFlowPage, setCashFlowPage] = useState(1)

  const [expenses, setExpenses] = useState<ListState>(initialList)
  const [expensesPage, setExpensesPage] = useState(1)

  const [sales, setSales] = useState<ListState>(initialList)
  const [salesPage, setSalesPage] = useState(1)

  const [expenseBox, setExpenseBox] = useState<ListState>(initialList)
  const [expenseBoxPage, setExpenseBoxPage] = useState(1)
  const [showReady, setShowReady] = useState(false)

  const loadSummary = useCallback(async () => {
    try {
      const r = await getAllCompaniesSummary(yearMonth)
      setSummary(r)
    } catch (e) {
      console.error("Failed to load summary:", e)
    }
  }, [yearMonth])

  const loadCashFlow = useCallback(async () => {
    setCashFlow((s) => ({ ...s, loading: true }))
    try {
      const r = await getAllCompaniesCashFlow(yearMonth, { page: cashFlowPage, pageSize: 50 })
      setCashFlow({
        rows: r.data,
        total: r.total,
        totalPages: r.totalPages,
        totalAmount: r.totalAmount,
        totalDeposit: r.totalDeposit,
        totalWithdrawal: r.totalWithdrawal,
        loading: false,
      })
    } catch (e) {
      console.error("Failed to load cash flow:", e)
      setCashFlow((s) => ({ ...s, loading: false }))
    }
  }, [yearMonth, cashFlowPage])

  const loadExpenses = useCallback(async () => {
    setExpenses((s) => ({ ...s, loading: true }))
    try {
      const r = await getAllCompaniesExpenses({ yearMonth, page: expensesPage, pageSize: 50 })
      setExpenses({
        rows: r.data,
        total: r.total,
        totalPages: r.totalPages,
        totalAmount: r.totalAmount,
        loading: false,
      })
    } catch (e) {
      console.error("Failed to load expenses:", e)
      setExpenses((s) => ({ ...s, loading: false }))
    }
  }, [yearMonth, expensesPage])

  const loadSales = useCallback(async () => {
    setSales((s) => ({ ...s, loading: true }))
    try {
      const r = await getAllCompaniesSales({ yearMonth, page: salesPage, pageSize: 50 })
      setSales({
        rows: r.data,
        total: r.total,
        totalPages: r.totalPages,
        totalAmount: r.totalAmount,
        loading: false,
      })
    } catch (e) {
      console.error("Failed to load sales:", e)
      setSales((s) => ({ ...s, loading: false }))
    }
  }, [yearMonth, salesPage])

  const loadExpenseBox = useCallback(async () => {
    setExpenseBox((s) => ({ ...s, loading: true }))
    try {
      const r = await getAllCompaniesExpenseBox({ page: expenseBoxPage, pageSize: 50, showReady })
      setExpenseBox({
        rows: r.data,
        total: r.total,
        totalPages: r.totalPages,
        totalAmount: r.totalAmount,
        loading: false,
      })
    } catch (e) {
      console.error("Failed to load expense box:", e)
      setExpenseBox((s) => ({ ...s, loading: false }))
    }
  }, [expenseBoxPage, showReady])

  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => { if (tab === "cashflow") loadCashFlow() }, [tab, loadCashFlow])
  useEffect(() => { if (tab === "expenses") loadExpenses() }, [tab, loadExpenses])
  useEffect(() => { if (tab === "sales") loadSales() }, [tab, loadSales])
  useEffect(() => { if (tab === "expensebox") loadExpenseBox() }, [tab, loadExpenseBox])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6" />
            全社合算ビュー
          </h1>
          <p className="text-muted-foreground">アクセス可能な全社の取引データを一括確認します（読み取り専用）</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">対象月</Label>
          <Input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} className="w-44" />
        </div>
      </div>

      {/* サマリタイル */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">対象会社数</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.companyCount ?? "—"}<span className="text-sm font-normal text-muted-foreground ml-1">社</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{yearMonth} 取引</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.transactionCount ?? "—"}<span className="text-sm font-normal text-muted-foreground ml-1">件</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">経費</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.expenseCount ?? "—"}<span className="text-sm font-normal text-muted-foreground ml-1">件</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">売上</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.salesCount ?? "—"}<span className="text-sm font-normal text-muted-foreground ml-1">件</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">受領BOX (DRAFT)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.expenseBoxCount ?? "—"}<span className="text-sm font-normal text-muted-foreground ml-1">件</span></div></CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="cashflow"><Wallet className="h-3.5 w-3.5 mr-1" />資金繰り</TabsTrigger>
          <TabsTrigger value="expenses"><TrendingDown className="h-3.5 w-3.5 mr-1" />経費</TabsTrigger>
          <TabsTrigger value="sales"><TrendingUp className="h-3.5 w-3.5 mr-1" />売上</TabsTrigger>
          <TabsTrigger value="expensebox"><Inbox className="h-3.5 w-3.5 mr-1" />受領BOX</TabsTrigger>
        </TabsList>

        <TabsContent value="cashflow">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>資金繰り（全社・{yearMonth}）</span>
                <span className="text-sm font-normal flex gap-4">
                  <span className="text-green-700">入金 {formatYen(Number(cashFlow.totalDeposit || 0))}</span>
                  <span className="text-red-700">出金 {formatYen(Number(cashFlow.totalWithdrawal || 0))}</span>
                  <span>収支 {formatYen(Number(cashFlow.totalAmount))}</span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cashFlow.loading ? <p className="text-muted-foreground text-center py-8">読み込み中...</p> : (
                <>
                  <CommonTable rows={cashFlow.rows} showCashFlow />
                  <div className="mt-4">
                    <Pagination currentPage={cashFlowPage} totalPages={cashFlow.totalPages} onPageChange={setCashFlowPage} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-right">全 {cashFlow.total} 件</p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>経費（全社・{yearMonth}）</span>
                <span className="text-sm font-normal text-red-700">合計 {formatYen(Number(expenses.totalAmount))}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expenses.loading ? <p className="text-muted-foreground text-center py-8">読み込み中...</p> : (
                <>
                  <CommonTable rows={expenses.rows} />
                  <div className="mt-4">
                    <Pagination currentPage={expensesPage} totalPages={expenses.totalPages} onPageChange={setExpensesPage} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-right">全 {expenses.total} 件</p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>売上（全社・{yearMonth}）</span>
                <span className="text-sm font-normal text-green-700">合計 {formatYen(Number(sales.totalAmount))}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sales.loading ? <p className="text-muted-foreground text-center py-8">読み込み中...</p> : (
                <>
                  <CommonTable rows={sales.rows} />
                  <div className="mt-4">
                    <Pagination currentPage={salesPage} totalPages={sales.totalPages} onPageChange={setSalesPage} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-right">全 {sales.total} 件</p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expensebox">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>受領BOX（全社）</span>
                <label className="text-sm font-normal flex items-center gap-2">
                  <input type="checkbox" checked={showReady} onChange={(e) => { setShowReady(e.target.checked); setExpenseBoxPage(1) }} />
                  準備完了も表示
                </label>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expenseBox.loading ? <p className="text-muted-foreground text-center py-8">読み込み中...</p> : (
                <>
                  <CommonTable rows={expenseBox.rows} />
                  <div className="mt-4">
                    <Pagination currentPage={expenseBoxPage} totalPages={expenseBox.totalPages} onPageChange={setExpenseBoxPage} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-right">全 {expenseBox.total} 件</p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
