"use client"

import { useState, useEffect, useCallback, Fragment } from "react"
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
import { getCategories } from "@/app/actions/categories"
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  updateTransactionStatus,
  deleteTransaction,
  upsertTransactionDetails,
  getDeductionDetailsForTransaction,
  type TransactionWithRelations,
} from "@/app/actions/transactions"
import { formatYen, getCurrentMonth, formatDate } from "@/lib/format"
import { checkMonthClosed } from "@/app/actions/cashflow-table"
import { DeductionDetailsPanel } from "@/components/deduction-details-panel"

type Account = { id: string; bankName: string | null; branchName: string | null; accountNumber: string | null }
type Partner = { id: string; name: string; type: string; tagKey: string; isActive: boolean; defaults: { midId: string; subId: string | null }[] }
type MidCategory = { id: string; name: string; majorId: string; isActive: boolean; subCategories: SubCategory[] }
type SubCategory = { id: string; name: string; midId: string; isActive: boolean }
type MajorCategory = { id: string; name: string; direction: string; isActive: boolean; midCategories: MidCategory[] }

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

export default function SalesPage() {
  const searchParams = useSearchParams()
  const { selectedCompany } = useCompany()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [categories, setCategories] = useState<MajorCategory[]>([])
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([])
  const [filterMonth, setFilterMonth] = useState(getCurrentMonth())
  const [filterStatus, setFilterStatus] = useState<string>("ALL")
  const [loading, setLoading] = useState(false)

  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithRelations | null>(null)
  const [parentForPayment, setParentForPayment] = useState<TransactionWithRelations | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [deductionTarget, setDeductionTarget] = useState<TransactionWithRelations | null>(null)
  const [deductionOpen, setDeductionOpen] = useState(false)
  const [monthClosed, setMonthClosed] = useState(false)
  const [deductionSummaries, setDeductionSummaries] = useState<Record<string, { name: string; amount: string }[]>>({})

  const [formAccountId, setFormAccountId] = useState("")
  const [formPartnerId, setFormPartnerId] = useState("")
  const [formInvoiceDate, setFormInvoiceDate] = useState("")
  const [formTransactionDate, setFormTransactionDate] = useState("")
  const [formAccountingMonth, setFormAccountingMonth] = useState(getCurrentMonth())
  const [formAmount, setFormAmount] = useState("")
  const [formMidId, setFormMidId] = useState("")
  const [formSubId, setFormSubId] = useState("")
  const [formSummary, setFormSummary] = useState("")

  const incomeCategories = categories
    .filter((m) => m.direction === "INCOME" && m.isActive)
    .flatMap((m) => m.midCategories.filter((mid) => mid.isActive))

  const getSubCategories = (midId: string): SubCategory[] => {
    for (const major of categories) {
      for (const mid of major.midCategories) {
        if (mid.id === midId) return mid.subCategories.filter((s) => s.isActive)
      }
    }
    return []
  }

  const handlePartnerChange = (partnerId: string) => {
    const partner = partners.find((p) => p.id === partnerId)
    const defaults = partner?.defaults?.[0]
    setFormPartnerId(partnerId)
    if (defaults?.midId && !formMidId) setFormMidId(defaults.midId)
    if (defaults?.subId && !formSubId) setFormSubId(defaults.subId)
  }

  const loadData = useCallback(async () => {
    if (!selectedCompany) return
    setLoading(true)
    try {
      const [accs, parts, cats, txnResult, closed] = await Promise.all([
        getAccounts(selectedCompany.id),
        getPartners(selectedCompany.id),
        getCategories(),
        getTransactions(
          selectedCompany.id,
          "SALES" as never,
          filterMonth || undefined,
          filterStatus !== "ALL" ? (filterStatus as never) : undefined
        ),
        filterMonth ? checkMonthClosed(selectedCompany.id, filterMonth) : Promise.resolve(false),
      ])
      setAccounts(accs.filter((a) => a.isActive).map((a) => ({ id: a.id, bankName: a.bankName, branchName: a.branchName, accountNumber: a.accountNumber })))
      setMonthClosed(closed)
      setPartners(parts.filter((p: Partner) => p.isActive && (p.type === "CUSTOMER" || p.type === "BOTH")).map((p: Partner) => ({
        ...p,
        defaults: p.defaults?.map((d: { midId: string; subId: string | null }) => ({ midId: d.midId, subId: d.subId })) || [],
      })))
      setCategories(cats as MajorCategory[])
      setTransactions(txnResult.data)
    } catch (e) {
      console.error("Failed to load data:", e)
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
    if (editId && transactions.length > 0 && !editDialogOpen) {
      const tx = transactions.find((t) => t.id === editId)
      if (tx) openEditDialog(tx)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, transactions])

  const resetForm = () => {
    setFormAccountId("")
    setFormPartnerId("")
    setFormInvoiceDate("")
    setFormTransactionDate("")
    setFormAccountingMonth(getCurrentMonth())
    setFormAmount("")
    setFormMidId("")
    setFormSubId("")
    setFormSummary("")
  }

  const openInvoiceDialog = () => {
    resetForm()
    setInvoiceDialogOpen(true)
  }

  const openPaymentDialog = (parent: TransactionWithRelations) => {
    resetForm()
    setFormAccountId(parent.accountId)
    setFormPartnerId(parent.partnerId || "")
    setFormAccountingMonth(parent.accountingMonth)
    setParentForPayment(parent)
    setPaymentDialogOpen(true)
  }

  const openEditDialog = (txn: TransactionWithRelations) => {
    setEditingTransaction(txn)
    setFormAccountId(txn.accountId)
    setFormPartnerId(txn.partnerId || "")
    setFormInvoiceDate(txn.invoiceDate ? txn.invoiceDate.split("T")[0] : "")
    setFormTransactionDate(txn.transactionDate ? txn.transactionDate.split("T")[0] : "")
    setFormAccountingMonth(txn.accountingMonth)
    setFormAmount(txn.amount)
    setFormMidId(txn.details?.[0]?.midId || "")
    setFormSubId(txn.details?.[0]?.subId || "")
    setFormSummary(txn.summary || "")
    setEditDialogOpen(true)
  }

  const handleCreateInvoice = async () => {
    if (!selectedCompany || !formAccountId || !formAmount) return
    try {
      await createTransaction({
        companyId: selectedCompany.id,
        accountId: formAccountId,
        partnerId: formPartnerId || undefined,
        type: "SALES" as never,
        invoiceDate: formInvoiceDate || undefined,
        scheduledDate: formTransactionDate || undefined,
        accountingMonth: formAccountingMonth,
        amount: formAmount,
        invoiceAmount: formAmount,
        summary: formSummary || undefined,
        details: formMidId
          ? [{ midId: formMidId, subId: formSubId || undefined, amount: formAmount, summary: formSummary || undefined }]
          : undefined,
      })
      setInvoiceDialogOpen(false)
      resetForm()
      await loadData()
    } catch (e) {
      console.error("Failed to create invoice:", e)
    }
  }

  const handleCreatePayment = async () => {
    if (!selectedCompany || !parentForPayment || !formAccountId || !formAmount || !formTransactionDate) return
    try {
      await createTransaction({
        companyId: selectedCompany.id,
        accountId: formAccountId,
        partnerId: formPartnerId || undefined,
        type: "SALES" as never,
        transactionDate: formTransactionDate,
        accountingMonth: formAccountingMonth,
        amount: formAmount,
        parentId: parentForPayment.id,
        summary: formSummary || undefined,
        details: formMidId
          ? [{ midId: formMidId, subId: formSubId || undefined, amount: formAmount, summary: formSummary || undefined }]
          : undefined,
      })
      setPaymentDialogOpen(false)
      setParentForPayment(null)
      resetForm()
      await loadData()
    } catch (e) {
      console.error("Failed to create payment:", e)
    }
  }

  const handleUpdate = async () => {
    if (!editingTransaction) return
    try {
      await updateTransaction(editingTransaction.id, selectedCompany!.id, {
        accountId: formAccountId || undefined,
        partnerId: formPartnerId || null,
        invoiceDate: formInvoiceDate || null,
        transactionDate: formTransactionDate || null,
        accountingMonth: formAccountingMonth || undefined,
        amount: formAmount || undefined,
        summary: formSummary || null,
        invoiceAmount: editingTransaction.parentId ? undefined : (formAmount || undefined),
      })
      if (formMidId) {
        await upsertTransactionDetails(editingTransaction.id, [
          { midId: formMidId, subId: formSubId || undefined, amount: formAmount || editingTransaction.amount, summary: formSummary || undefined },
        ])
      }
      setEditDialogOpen(false)
      setEditingTransaction(null)
      resetForm()
      await loadData()
    } catch (e) {
      console.error("Failed to update:", e)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateTransactionStatus(id, selectedCompany!.id, status as never)
      await loadData()
    } catch (e) {
      console.error("Failed to update status:", e)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("この取引を削除しますか？")) return
    try {
      await deleteTransaction(id, selectedCompany!.id)
      await loadData()
    } catch (e) {
      console.error("Failed to delete:", e)
    }
  }

  const toggleExpand = async (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    // 展開時に控除内訳を読み込む
    if (!expandedRows.has(id) && !deductionSummaries[id]) {
      try {
        const details = await getDeductionDetailsForTransaction(id)
        if (details.length > 0) {
          setDeductionSummaries((prev) => ({
            ...prev,
            [id]: details.map((d) => ({ name: d.summary || "控除", amount: d.amount })),
          }))
        }
      } catch {
        // ignore
      }
    }
  }

  const getAccountLabel = (acc: Account) => {
    const parts = [acc.bankName, acc.branchName, acc.accountNumber].filter(Boolean)
    return parts.length > 0 ? parts.join(" ") : acc.id.slice(0, 8)
  }

  const getChildrenTotal = (txn: TransactionWithRelations) => {
    return txn.children.reduce((sum, c) => sum + Number(c.amount), 0)
  }

  const getRemainingAmount = (txn: TransactionWithRelations) => {
    const invoiceAmt = Number(txn.invoiceAmount || txn.amount)
    const paidAmt = getChildrenTotal(txn)
    return invoiceAmt - paidAmt
  }

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">売上入力</h1>
          <p className="text-muted-foreground">会社を選択してください</p>
        </div>
      </div>
    )
  }

  const amountFieldsDisabled = editingTransaction !== null && monthClosed

  const renderFormFields = (isPayment: boolean) => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>口座</Label>
          <Select value={formAccountId} onValueChange={setFormAccountId} disabled={amountFieldsDisabled}>
            <SelectTrigger><SelectValue placeholder="口座を選択" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{getAccountLabel(a)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>取引先</Label>
          <Select value={formPartnerId} onValueChange={handlePartnerChange}>
            <SelectTrigger><SelectValue placeholder="取引先を選択" /></SelectTrigger>
            <SelectContent>
              {partners.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {!isPayment && (
          <div className="space-y-2">
            <Label>請求日</Label>
            <Input type="date" value={formInvoiceDate} onChange={(e) => setFormInvoiceDate(e.target.value)} disabled={amountFieldsDisabled} />
          </div>
        )}
        <div className="space-y-2">
          <Label>{isPayment ? "入金日" : "予定入金日"}</Label>
          <Input type="date" value={formTransactionDate} onChange={(e) => setFormTransactionDate(e.target.value)} disabled={amountFieldsDisabled} />
        </div>
        <div className="space-y-2">
          <Label>計上月</Label>
          <Input type="month" value={formAccountingMonth} onChange={(e) => setFormAccountingMonth(e.target.value)} disabled={amountFieldsDisabled} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>金額</Label>
          <Input type="number" placeholder="0" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} disabled={amountFieldsDisabled} />
        </div>
        <div className="space-y-2">
          <Label>勘定科目</Label>
          <Select value={formMidId} onValueChange={(v) => { setFormMidId(v); setFormSubId("") }}>
            <SelectTrigger><SelectValue placeholder="科目を選択" /></SelectTrigger>
            <SelectContent>
              {incomeCategories.map((mid) => (
                <SelectItem key={mid.id} value={mid.id}>{mid.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {formMidId && getSubCategories(formMidId).length > 0 && (
        <div className="space-y-2">
          <Label>補助科目</Label>
          <Select value={formSubId} onValueChange={setFormSubId}>
            <SelectTrigger><SelectValue placeholder="補助科目を選択（任意）" /></SelectTrigger>
            <SelectContent>
              {getSubCategories(formMidId).map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label>摘要</Label>
        <Input value={formSummary} onChange={(e) => setFormSummary(e.target.value)} placeholder="摘要を入力" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">売上入力</h1>
          <p className="text-muted-foreground">売上（請求＋入金）の入力・管理を行います</p>
        </div>
        <Button onClick={openInvoiceDialog}>請求を追加</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>請求一覧</CardTitle>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">計上月</Label>
              <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">ステータス</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  <SelectItem value="DRAFT">下書き</SelectItem>
                  <SelectItem value="READY">準備完了</SelectItem>
                  <SelectItem value="CONFIRMED">確定済</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">読み込み中...</p>
          ) : transactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">データがありません</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>取引先</TableHead>
                  <TableHead>請求日</TableHead>
                  <TableHead>予定入金日</TableHead>
                  <TableHead>計上月</TableHead>
                  <TableHead>科目</TableHead>
                  <TableHead className="text-right">請求額</TableHead>
                  <TableHead className="text-right">入金済</TableHead>
                  <TableHead className="text-right">残額</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => {
                  const isExpanded = expandedRows.has(txn.id)
                  const childrenTotal = getChildrenTotal(txn)
                  const remaining = getRemainingAmount(txn)
                  return (
                    <Fragment key={txn.id}>
                      <TableRow className="cursor-pointer" onClick={() => toggleExpand(txn.id)}>
                        <TableCell>
                          <span className="text-xs">{isExpanded ? "▼" : "▶"}</span>
                          {txn.children.length > 0 && (
                            <span className="ml-1 text-xs text-muted-foreground">({txn.children.length})</span>
                          )}
                        </TableCell>
                        <TableCell>{txn.partner?.name || "-"}</TableCell>
                        <TableCell>{formatDate(txn.invoiceDate)}</TableCell>
                        <TableCell>{formatDate(txn.scheduledDate || txn.transactionDate)}</TableCell>
                        <TableCell>{txn.accountingMonth}</TableCell>
                        <TableCell>{txn.details?.[0]?.mid?.name || "-"}</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(Number(txn.invoiceAmount || txn.amount))}</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(childrenTotal)}</TableCell>
                        <TableCell className={`text-right font-mono ${remaining > 0 ? "text-orange-600" : "text-green-600"}`}>
                          {formatYen(remaining)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariants[txn.status] || "outline"}>{statusLabels[txn.status] || txn.status}</Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            {txn.status === "DRAFT" && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => openEditDialog(txn)}>編集</Button>
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(txn.id, "READY")}>確認</Button>
                                <Button size="sm" variant="ghost" onClick={() => openPaymentDialog(txn)}>入金</Button>
                                <Button size="sm" variant="ghost" onClick={() => { setDeductionTarget(txn); setDeductionOpen(true) }}>控除</Button>
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(txn.id)}>削除</Button>
                              </>
                            )}
                            {txn.status === "READY" && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(txn.id, "CONFIRMED")}>確定</Button>
                                <Button size="sm" variant="ghost" onClick={() => openPaymentDialog(txn)}>入金</Button>
                                <Button size="sm" variant="ghost" onClick={() => { setDeductionTarget(txn); setDeductionOpen(true) }}>控除</Button>
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(txn.id, "DRAFT")}>戻す</Button>
                              </>
                            )}
                            {monthClosed && txn.status !== "DRAFT" && (
                              <Button size="sm" variant="ghost" onClick={() => openEditDialog(txn)}>摘要・科目編集</Button>
                            )}
                            {txn.status === "CONFIRMED" && (
                              <Button size="sm" variant="ghost" onClick={() => openPaymentDialog(txn)}>入金</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && txn.children.length > 0 && txn.children.map((child) => (
                        <TableRow key={child.id} className="bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell className="pl-8 text-muted-foreground text-sm">↳ 入金</TableCell>
                          <TableCell></TableCell>
                          <TableCell>{formatDate(child.transactionDate)}</TableCell>
                          <TableCell></TableCell>
                          <TableCell>{child.details?.[0]?.mid?.name || "-"}</TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right font-mono">{formatYen(Number(child.amount))}</TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            <Badge variant={statusVariants[child.status] || "outline"}>{statusLabels[child.status] || child.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {child.status === "DRAFT" && (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => handleStatusChange(child.id, "CONFIRMED")}>確定</Button>
                                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(child.id)}>削除</Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {isExpanded && txn.children.length === 0 && (
                        <TableRow key={`${txn.id}-empty`} className="bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell colSpan={10} className="text-muted-foreground text-sm text-center py-2">
                            入金実績はありません
                          </TableCell>
                        </TableRow>
                      )}
                      {isExpanded && remaining > 0 && (
                        <TableRow key={`${txn.id}-deductions`} className="bg-orange-50 dark:bg-orange-950/30">
                          <TableCell></TableCell>
                          <TableCell colSpan={5} className="text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-orange-700 dark:text-orange-300">差額（控除）</span>
                              <span className="font-mono text-orange-600">{formatYen(remaining)}</span>
                              {deductionSummaries[txn.id] && deductionSummaries[txn.id].length > 0 ? (
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({deductionSummaries[txn.id].map((d) => `${d.name}: ${formatYen(Number(d.amount))}`).join("、")})
                                </span>
                              ) : (
                                <span className="text-xs text-orange-500 ml-2">控除内訳が未入力です</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell colSpan={5} className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300"
                              onClick={(e) => { e.stopPropagation(); setDeductionTarget(txn); setDeductionOpen(true) }}
                            >
                              控除内訳を入力
                            </Button>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>請求を追加</DialogTitle>
            <DialogDescription>新しい請求（予定入金）を登録します</DialogDescription>
          </DialogHeader>
          {renderFormFields(false)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleCreateInvoice} disabled={!formAccountId || !formAmount}>登録</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>入金を記録</DialogTitle>
            <DialogDescription>
              {parentForPayment && (
                <>
                  請求先: {parentForPayment.partner?.name || "-"} / 請求額: {formatYen(Number(parentForPayment.invoiceAmount || parentForPayment.amount))} / 残額: {formatYen(getRemainingAmount(parentForPayment))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {renderFormFields(true)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleCreatePayment} disabled={!formAccountId || !formAmount || !formTransactionDate}>登録</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>請求を編集</DialogTitle>
            <DialogDescription>請求内容を変更します</DialogDescription>
          </DialogHeader>
          {renderFormFields(!editingTransaction?.parentId ? false : true)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleUpdate}>更新</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deductionTarget && (
        <DeductionDetailsPanel
          transactionId={deductionTarget.id}
          companyId={selectedCompany!.id}
          forType="SALES"
          diffAmount={getRemainingAmount(deductionTarget)}
          open={deductionOpen}
          onOpenChange={setDeductionOpen}
          onSaved={() => {
            // 控除サマリーをリフレッシュ
            setDeductionSummaries((prev) => {
              const next = { ...prev }
              delete next[deductionTarget.id]
              return next
            })
            toggleExpand(deductionTarget.id) // 再読み込み
            toggleExpand(deductionTarget.id)
            loadData()
          }}
        />
      )}
    </div>
  )
}
