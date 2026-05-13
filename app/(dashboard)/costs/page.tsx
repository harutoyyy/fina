"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { useCompany } from "@/contexts/company-context"
import { getAccounts } from "@/app/actions/accounts"
import { getPartners } from "@/app/actions/partners"
import { getTransactions, createTransaction, updateTransaction, updateTransactionStatus, deleteTransaction, type TransactionWithRelations } from "@/app/actions/transactions"
import { formatYen, getCurrentMonth, formatDate } from "@/lib/format"
import { checkMonthClosed } from "@/app/actions/cashflow-table"
import { DeductionDetailsPanel } from "@/components/deduction-details-panel"

type AccountOption = { id: string; bankName: string | null; branchName: string | null; accountNumber: string | null }
type PartnerOption = { id: string; name: string }

const statusLabels: Record<string, string> = {
  DRAFT: "下書き",
  READY: "準備完了",
  CONFIRMED: "確定済",
  CANCELLED: "取消済",
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  READY: "secondary",
  CONFIRMED: "default",
  CANCELLED: "destructive",
}

type CostFormData = {
  accountId: string
  partnerId: string
  transactionDate: string
  accountingMonth: string
  laborCost: string
  welfareCost: string
  materialCost: string
  taxAmount: string
  actualPayment: string
  summary: string
}

const emptyForm: CostFormData = {
  accountId: "",
  partnerId: "",
  transactionDate: "",
  accountingMonth: getCurrentMonth(),
  laborCost: "0",
  welfareCost: "0",
  materialCost: "0",
  taxAmount: "0",
  actualPayment: "0",
  summary: "",
}

function calcTotal(form: CostFormData): number {
  return (
    (parseInt(form.laborCost) || 0) +
    (parseInt(form.welfareCost) || 0) +
    (parseInt(form.materialCost) || 0) +
    (parseInt(form.taxAmount) || 0)
  )
}

function calcDifference(form: CostFormData): number {
  return calcTotal(form) - (parseInt(form.actualPayment) || 0)
}

export default function CostsPage() {
  const searchParams = useSearchParams()
  const { selectedCompany } = useCompany()
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([])
  const [filterMonth, setFilterMonth] = useState(getCurrentMonth())
  const [filterStatus, setFilterStatus] = useState<string>("ALL")
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CostFormData>(emptyForm)
  const [deductionTarget, setDeductionTarget] = useState<TransactionWithRelations | null>(null)
  const [deductionOpen, setDeductionOpen] = useState(false)
  const [monthClosed, setMonthClosed] = useState(false)

  const loadData = useCallback(async () => {
    if (!selectedCompany) return
    setLoading(true)
    try {
      const [accts, ptns, txnResult, closed] = await Promise.all([
        getAccounts(selectedCompany.id),
        getPartners(selectedCompany.id),
        getTransactions(
          selectedCompany.id,
          "COST_PAYMENT" as const,
          filterMonth || undefined,
          filterStatus !== "ALL" ? (filterStatus as "DRAFT" | "READY" | "CONFIRMED" | "CANCELLED") : undefined
        ),
        filterMonth ? checkMonthClosed(selectedCompany.id, filterMonth) : Promise.resolve(false),
      ])
      setAccounts(accts.map((a) => ({ id: a.id, bankName: a.bankName, branchName: a.branchName, accountNumber: a.accountNumber })))
      setPartners(ptns.map((p) => ({ id: p.id, name: p.name })))
      setMonthClosed(closed)
      setTransactions(txnResult.data)
    } catch (e) {
      console.error("Failed to load data", e)
    } finally {
      setLoading(false)
    }
  }, [selectedCompany, filterMonth, filterStatus])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 資金繰り表からの編集遷移: ?edit=transactionId
  useEffect(() => {
    const editId = searchParams.get("edit")
    if (editId && transactions.length > 0 && !dialogOpen) {
      const tx = transactions.find((t) => t.id === editId)
      if (tx) openEditDialog(tx)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, transactions])

  function openCreateDialog() {
    setEditingId(null)
    setForm({ ...emptyForm, accountingMonth: filterMonth || getCurrentMonth() })
    setDialogOpen(true)
  }

  function openEditDialog(txn: TransactionWithRelations) {
    setEditingId(txn.id)
    const recordedAmount = parseInt(txn.recordedAmount || "0")
    const transferAmount = parseInt(txn.transferAmount || "0")
    const amount = parseInt(txn.amount || "0")

    const details = txn.details || []
    const laborDetail = details[0]
    const welfareDetail = details[1]
    const materialDetail = details[2]
    const taxDetail = details[3]

    setForm({
      accountId: txn.accountId || "",
      partnerId: txn.partnerId || "",
      transactionDate: txn.transactionDate ? txn.transactionDate.split("T")[0] : "",
      accountingMonth: txn.accountingMonth || getCurrentMonth(),
      laborCost: laborDetail ? laborDetail.amount : "0",
      welfareCost: welfareDetail ? welfareDetail.amount : "0",
      materialCost: materialDetail ? materialDetail.amount : "0",
      taxAmount: taxDetail ? taxDetail.amount : "0",
      actualPayment: transferAmount ? String(transferAmount) : String(amount),
      summary: txn.summary || "",
    })
    setDialogOpen(true)
  }

  async function handleSubmit() {
    if (!selectedCompany) return
    const total = calcTotal(form)
    const actualPay = parseInt(form.actualPayment) || 0
    const diff = total - actualPay

    const details = [
      { amount: String(parseInt(form.laborCost) || 0), summary: "労務費" },
      { amount: String(parseInt(form.welfareCost) || 0), summary: "法定福利" },
      { amount: String(parseInt(form.materialCost) || 0), summary: "材料雑費" },
      { amount: String(parseInt(form.taxAmount) || 0), summary: "消費税" },
    ]

    try {
      if (editingId) {
        await updateTransaction(editingId, selectedCompany.id, {
          accountId: form.accountId,
          partnerId: form.partnerId || null,
          transactionDate: form.transactionDate || null,
          accountingMonth: form.accountingMonth,
          amount: String(total),
          summary: form.summary || null,
          recordedAmount: String(total),
          transferAmount: String(actualPay),
        })
      } else {
        await createTransaction({
          companyId: selectedCompany.id,
          accountId: form.accountId,
          partnerId: form.partnerId || undefined,
          type: "COST_PAYMENT",
          transactionDate: form.transactionDate || undefined,
          accountingMonth: form.accountingMonth,
          amount: String(total),
          summary: form.summary || undefined,
          recordedAmount: String(total),
          transferAmount: String(actualPay),
          details,
        })
      }
      setDialogOpen(false)
      await loadData()
    } catch (e) {
      console.error("Failed to save", e)
    }
  }

  async function handleStatusChange(id: string, newStatus: "DRAFT" | "READY" | "CONFIRMED") {
    try {
      await updateTransactionStatus(id, selectedCompany!.id, newStatus)
      await loadData()
    } catch (e) {
      console.error("Failed to update status", e)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("この取引を削除しますか？")) return
    try {
      await deleteTransaction(id, selectedCompany!.id)
      await loadData()
    } catch (e) {
      console.error("Failed to delete", e)
    }
  }

  function accountLabel(a: AccountOption) {
    return [a.bankName, a.branchName, a.accountNumber].filter(Boolean).join(" ") || a.id
  }

  function partnerName(id: string | null) {
    if (!id) return "-"
    return partners.find((p) => p.id === id)?.name || "-"
  }

  const total = calcTotal(form)
  const difference = calcDifference(form)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">原価支払</h1>
          <p className="text-muted-foreground">工事原価の支払いを管理します</p>
        </div>
        <Button onClick={openCreateDialog} disabled={!selectedCompany}>新規登録</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">フィルタ</CardTitle>
        </CardHeader>
        <CardContent>
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
            <div className="space-y-1">
              <Label>ステータス</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  <SelectItem value="DRAFT">下書き</SelectItem>
                  <SelectItem value="READY">準備完了</SelectItem>
                  <SelectItem value="CONFIRMED">確定済</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">原価支払一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm py-4">読み込み中...</p>
          ) : transactions.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">データがありません</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ステータス</TableHead>
                  <TableHead>施工日</TableHead>
                  <TableHead>支払先</TableHead>
                  <TableHead>口座</TableHead>
                  <TableHead className="text-right">計上額</TableHead>
                  <TableHead className="text-right">実支払額</TableHead>
                  <TableHead className="text-right">差額</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => {
                  const recorded = parseInt(txn.recordedAmount || txn.amount || "0")
                  const transfer = parseInt(txn.transferAmount || txn.amount || "0")
                  const diff = recorded - transfer
                  return (
                    <TableRow key={txn.id}>
                      <TableCell>
                        <Badge variant={statusVariants[txn.status] || "outline"}>
                          {statusLabels[txn.status] || txn.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(txn.transactionDate)}</TableCell>
                      <TableCell>{partnerName(txn.partnerId)}</TableCell>
                      <TableCell className="text-xs">
                        {accounts.find((a) => a.id === txn.accountId)
                          ? accountLabel(accounts.find((a) => a.id === txn.accountId)!)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">{formatYen(recorded)}</TableCell>
                      <TableCell className="text-right">{formatYen(transfer)}</TableCell>
                      <TableCell className={`text-right ${diff !== 0 ? "text-orange-600 font-medium" : ""}`}>
                        {formatYen(diff)}
                      </TableCell>
                      <TableCell className="text-xs max-w-32 truncate">{txn.summary || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {txn.status === "DRAFT" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(txn)}>編集</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleStatusChange(txn.id, "READY")}>準備完了</Button>
                              <Button variant="ghost" size="sm" onClick={() => { setDeductionTarget(txn); setDeductionOpen(true) }}>控除</Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(txn.id)}>削除</Button>
                            </>
                          )}
                          {txn.status === "READY" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => handleStatusChange(txn.id, "DRAFT")}>差戻し</Button>
                              <Button variant="ghost" size="sm" onClick={() => { setDeductionTarget(txn); setDeductionOpen(true) }}>控除</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleStatusChange(txn.id, "CONFIRMED")}>確定</Button>
                            </>
                          )}
                          {monthClosed && txn.status !== "DRAFT" && (
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(txn)}>摘要編集</Button>
                          )}
                          {txn.status === "CONFIRMED" && !monthClosed && (
                            <span className="text-xs text-muted-foreground">確定済</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "原価支払を編集" : "原価支払を登録"}{editingId && monthClosed ? "（月締め中：摘要のみ変更可）" : ""}</DialogTitle>
            <DialogDescription>工事原価の支払い情報を入力してください</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>口座</Label>
                <Select value={form.accountId} onValueChange={(v) => setForm((f) => ({ ...f, accountId: v }))} disabled={editingId !== null && monthClosed}>
                  <SelectTrigger>
                    <SelectValue placeholder="口座を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{accountLabel(a)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>支払先</Label>
                <Select value={form.partnerId} onValueChange={(v) => setForm((f) => ({ ...f, partnerId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="支払先を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>施工日</Label>
                <Input
                  type="date"
                  value={form.transactionDate}
                  onChange={(e) => setForm((f) => ({ ...f, transactionDate: e.target.value }))}
                  disabled={editingId !== null && monthClosed}
                />
              </div>
              <div className="space-y-1">
                <Label>計上月</Label>
                <Input
                  type="month"
                  value={form.accountingMonth}
                  onChange={(e) => setForm((f) => ({ ...f, accountingMonth: e.target.value }))}
                  disabled={editingId !== null && monthClosed}
                />
              </div>
            </div>

            <div className="border rounded-md p-4 space-y-3">
              <h4 className="font-medium text-sm">内訳</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>労務費</Label>
                  <Input
                    type="number"
                    value={form.laborCost}
                    onChange={(e) => setForm((f) => ({ ...f, laborCost: e.target.value }))}
                    disabled={editingId !== null && monthClosed}
                  />
                </div>
                <div className="space-y-1">
                  <Label>法定福利</Label>
                  <Input
                    type="number"
                    value={form.welfareCost}
                    onChange={(e) => setForm((f) => ({ ...f, welfareCost: e.target.value }))}
                    disabled={editingId !== null && monthClosed}
                  />
                </div>
                <div className="space-y-1">
                  <Label>材料雑費</Label>
                  <Input
                    type="number"
                    value={form.materialCost}
                    onChange={(e) => setForm((f) => ({ ...f, materialCost: e.target.value }))}
                    disabled={editingId !== null && monthClosed}
                  />
                </div>
                <div className="space-y-1">
                  <Label>消費税</Label>
                  <Input
                    type="number"
                    value={form.taxAmount}
                    onChange={(e) => setForm((f) => ({ ...f, taxAmount: e.target.value }))}
                    disabled={editingId !== null && monthClosed}
                  />
                </div>
              </div>

              <div className="border-t pt-3 grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>合計（自動計算）</Label>
                  <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm font-medium">
                    {formatYen(total)}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>実支払額</Label>
                  <Input
                    type="number"
                    value={form.actualPayment}
                    onChange={(e) => setForm((f) => ({ ...f, actualPayment: e.target.value }))}
                    disabled={editingId !== null && monthClosed}
                  />
                </div>
                <div className="space-y-1">
                  <Label>差額（控除）</Label>
                  <div className={`h-9 flex items-center px-3 bg-muted rounded-md text-sm font-medium ${difference !== 0 ? "text-orange-600" : ""}`}>
                    {formatYen(difference)}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label>摘要</Label>
              <Input
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="摘要を入力"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSubmit} disabled={!form.accountId}>
              {editingId ? "更新" : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deductionTarget && (
        <DeductionDetailsPanel
          transactionId={deductionTarget.id}
          companyId={selectedCompany!.id}
          forType="COST"
          diffAmount={parseInt(deductionTarget.recordedAmount || deductionTarget.amount || "0") - parseInt(deductionTarget.transferAmount || deductionTarget.amount || "0")}
          open={deductionOpen}
          onOpenChange={setDeductionOpen}
          onSaved={loadData}
        />
      )}
    </div>
  )
}
