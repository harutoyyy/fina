"use client"

import { useState, useEffect, useCallback } from "react"
import { useCompany } from "@/contexts/company-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { updateTransactionStatus } from "@/app/actions/transactions"
import { getExpensesForOperator, getCurrentUserProfile, type CurrentUserProfile } from "@/app/actions/user-profile"
import { formatYen, formatDate, getCurrentMonth } from "@/lib/format"

type ExpenseRow = {
  id: string
  companyId: string
  accountId: string
  partnerId: string | null
  type: string
  status: string
  transactionDate: string | null
  accountingMonth: string
  amount: string
  paymentMethod: string | null
  summary: string | null
  hasEvidence: boolean
  partner: { id: string; name: string } | null
  account: { id: string; bankName: string | null; branchName: string | null; accountNumber: string | null }
  details: {
    id: string
    midId: string | null
    midName: string | null
    subName: string | null
    amount: string
    summary: string | null
  }[]
}

const PAYMENT_LABELS: Record<string, string> = {
  BANK_TRANSFER: "振込",
  DIRECT_DEBIT: "引落",
  CASH_WITHDRAWAL: "現金",
}

export default function ExpenseBoxPage() {
  const { selectedCompany } = useCompany()
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [filterMonth, setFilterMonth] = useState(getCurrentMonth())
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!selectedCompany) return
    setLoading(true)
    try {
      const [expData, userProfile] = await Promise.all([
        getExpensesForOperator(selectedCompany.id, filterMonth || undefined),
        getCurrentUserProfile(),
      ])
      setExpenses(expData)
      setProfile(userProfile)
    } catch (e) {
      console.error("Failed to load expense box data:", e)
    } finally {
      setLoading(false)
    }
  }, [selectedCompany, filterMonth])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!selectedCompany) return
    setActionLoading(id)
    try {
      await updateTransactionStatus(id, selectedCompany.id, newStatus as never)
      await loadData()
    } catch (e) {
      alert(e instanceof Error ? e.message : "ステータス変更に失敗しました")
    } finally {
      setActionLoading(null)
    }
  }

  const draftExpenses = expenses.filter((e) => e.status === "DRAFT")
  const readyExpenses = expenses.filter((e) => e.status === "READY")

  const isAdmin = profile?.role === "ADMIN"

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">経費確定BOX</h1>
          <p className="text-muted-foreground">会社を選択してください</p>
        </div>
      </div>
    )
  }

  const renderExpenseTable = (items: ExpenseRow[], showConfirmButton: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>取引日</TableHead>
          <TableHead>計上月</TableHead>
          <TableHead>取引先</TableHead>
          <TableHead>支払方法</TableHead>
          <TableHead>科目</TableHead>
          <TableHead className="text-right">金額</TableHead>
          <TableHead>摘要</TableHead>
          <TableHead>証憑</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
              該当するデータがありません
            </TableCell>
          </TableRow>
        ) : (
          items.map((exp) => {
            const categoryDisplay = exp.details[0]
              ? [exp.details[0].midName, exp.details[0].subName].filter(Boolean).join(" / ")
              : "-"
            return (
              <TableRow key={exp.id}>
                <TableCell className="whitespace-nowrap">{formatDate(exp.transactionDate)}</TableCell>
                <TableCell>{exp.accountingMonth}</TableCell>
                <TableCell>{exp.partner?.name || "-"}</TableCell>
                <TableCell>{exp.paymentMethod ? PAYMENT_LABELS[exp.paymentMethod] || exp.paymentMethod : "-"}</TableCell>
                <TableCell className="text-sm">{categoryDisplay}</TableCell>
                <TableCell className="text-right font-mono">{formatYen(Number(exp.amount))}</TableCell>
                <TableCell className="max-w-48 truncate text-sm">{exp.summary || "-"}</TableCell>
                <TableCell>
                  <Badge variant={exp.hasEvidence ? "default" : "outline"}>
                    {exp.hasEvidence ? "添付済" : "未添付"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {exp.status === "DRAFT" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionLoading === exp.id}
                        onClick={() => handleStatusChange(exp.id, "READY")}
                      >
                        準備完了
                      </Button>
                    )}
                    {exp.status === "READY" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={actionLoading === exp.id}
                          onClick={() => handleStatusChange(exp.id, "DRAFT")}
                        >
                          差戻し
                        </Button>
                        {showConfirmButton && isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionLoading === exp.id}
                            onClick={() => handleStatusChange(exp.id, "CONFIRMED")}
                          >
                            確定
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">経費確定BOX</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "全件表示（管理者）" : "担当分のみ表示"}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="space-y-1">
              <Label>計上月</Label>
              <Input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">下書き</Badge>
                <span className="font-mono">{draftExpenses.length}件</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">準備完了</Badge>
                <span className="font-mono">{readyExpenses.length}件</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">合計金額:</span>
                <span className="font-mono font-medium">
                  {formatYen(expenses.reduce((sum, e) => sum + Number(e.amount), 0))}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">読み込み中...</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="ready">
          <TabsList>
            <TabsTrigger value="ready">
              準備完了 ({readyExpenses.length})
            </TabsTrigger>
            <TabsTrigger value="draft">
              下書き ({draftExpenses.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ready">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  準備完了の経費
                  {isAdmin && readyExpenses.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      管理者は確定操作が可能です
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderExpenseTable(readyExpenses, true)}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="draft">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">下書きの経費</CardTitle>
              </CardHeader>
              <CardContent>
                {renderExpenseTable(draftExpenses, false)}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
