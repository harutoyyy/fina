"use client"

import { useState, useEffect, useCallback } from "react"
import { useCompany } from "@/contexts/company-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
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
  type TransactionWithRelations,
} from "@/app/actions/transactions"
import { formatYen, formatDate, getCurrentMonth } from "@/lib/format"
import EvidencePanel from "@/components/evidence-panel"
import { Paperclip } from "lucide-react"

type AccountOption = {
  id: string
  bankName: string | null
  branchName: string | null
  accountNumber: string | null
}

type PartnerOption = {
  id: string
  name: string
  defaults: {
    midId: string
    subId: string | null
  }[]
}

type MidCategory = {
  id: string
  name: string
  subCategories: { id: string; name: string; isActive: boolean }[]
}

type MajorCategory = {
  id: string
  name: string
  direction: string
  midCategories: MidCategory[]
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "下書き",
  READY: "準備完了",
  CONFIRMED: "確定済",
  CANCELLED: "取消済",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  READY: "secondary",
  CONFIRMED: "default",
  CANCELLED: "destructive",
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "振込",
  DIRECT_DEBIT: "引落",
  CASH_WITHDRAWAL: "現金",
}

const initialFormState = {
  accountId: "",
  partnerId: "",
  transactionDate: "",
  accountingMonth: getCurrentMonth(),
  paymentMethod: "BANK_TRANSFER" as "BANK_TRANSFER" | "DIRECT_DEBIT" | "CASH_WITHDRAWAL",
  amount: "",
  midId: "",
  subId: "",
  summary: "",
}

export default function ExpensesPage() {
  const { selectedCompany } = useCompany()
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [categories, setCategories] = useState<MajorCategory[]>([])
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [filterMonth, setFilterMonth] = useState(getCurrentMonth())
  const [filterStatus, setFilterStatus] = useState<string>("ALL")

  const [form, setForm] = useState(initialFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [evidenceTargetId, setEvidenceTargetId] = useState<string | null>(null)

  const expenseMidCategories = categories
    .filter((m) => m.direction === "EXPENSE")
    .flatMap((m) => m.midCategories)

  const selectedMid = expenseMidCategories.find((m) => m.id === form.midId)
  const subCategories = selectedMid?.subCategories.filter((s) => s.isActive) || []

  const loadMasterData = useCallback(async (companyId: string) => {
    const [accts, parts, cats] = await Promise.all([
      getAccounts(companyId),
      getPartners(companyId),
      getCategories(),
    ])
    setAccounts(accts.filter((a) => a.isActive).map((a) => ({
      id: a.id,
      bankName: a.bankName,
      branchName: a.branchName,
      accountNumber: a.accountNumber,
    })))
    setPartners(parts.filter((p) => p.isActive).map((p) => ({
      id: p.id,
      name: p.name,
      defaults: p.defaults.map((d) => ({ midId: d.midId, subId: d.subId })),
    })))
    setCategories(cats as MajorCategory[])
  }, [])

  const loadTransactions = useCallback(async (companyId: string) => {
    setLoading(true)
    try {
      const statusFilter = filterStatus === "ALL" ? undefined : (filterStatus as "DRAFT" | "READY" | "CONFIRMED" | "CANCELLED")
      const data = await getTransactions(companyId, "EXPENSE", filterMonth || undefined, statusFilter)
      setTransactions(data)
    } finally {
      setLoading(false)
    }
  }, [filterMonth, filterStatus])

  useEffect(() => {
    if (selectedCompany) {
      loadMasterData(selectedCompany.id)
    }
  }, [selectedCompany, loadMasterData])

  useEffect(() => {
    if (selectedCompany) {
      loadTransactions(selectedCompany.id)
    }
  }, [selectedCompany, loadTransactions])

  const handlePartnerChange = (partnerId: string) => {
    setForm((prev) => {
      const partner = partners.find((p) => p.id === partnerId)
      const defaults = partner?.defaults?.[0]
      return {
        ...prev,
        partnerId,
        midId: defaults?.midId || prev.midId,
        subId: defaults?.subId || prev.subId,
      }
    })
  }

  const handleMidChange = (midId: string) => {
    setForm((prev) => ({ ...prev, midId, subId: "" }))
  }

  const resetForm = () => {
    setForm(initialFormState)
    setEditingId(null)
    setDialogOpen(false)
  }

  const handleSubmit = async () => {
    if (!selectedCompany || !form.accountId || !form.amount || !form.midId) return
    setSubmitting(true)
    try {
      if (editingId) {
        await updateTransaction(editingId, selectedCompany.id, {
          accountId: form.accountId,
          partnerId: form.partnerId || null,
          transactionDate: form.transactionDate || null,
          accountingMonth: form.accountingMonth,
          amount: form.amount,
          paymentMethod: form.paymentMethod,
          summary: form.summary || null,
        })
        await upsertTransactionDetails(editingId, [
          {
            midId: form.midId,
            subId: form.subId || undefined,
            amount: form.amount,
            summary: form.summary || undefined,
          },
        ])
      } else {
        await createTransaction({
          companyId: selectedCompany.id,
          accountId: form.accountId,
          partnerId: form.partnerId || undefined,
          type: "EXPENSE",
          transactionDate: form.transactionDate || undefined,
          accountingMonth: form.accountingMonth,
          amount: form.amount,
          paymentMethod: form.paymentMethod,
          summary: form.summary || undefined,
          details: [
            {
              midId: form.midId,
              subId: form.subId || undefined,
              amount: form.amount,
              summary: form.summary || undefined,
            },
          ],
        })
      }
      resetForm()
      loadTransactions(selectedCompany.id)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (tx: TransactionWithRelations) => {
    const detail = tx.details[0]
    setForm({
      accountId: tx.account.id,
      partnerId: tx.partner?.id || "",
      transactionDate: tx.transactionDate ? tx.transactionDate.split("T")[0] : "",
      accountingMonth: tx.accountingMonth,
      paymentMethod: (tx.paymentMethod as "BANK_TRANSFER" | "DIRECT_DEBIT" | "CASH_WITHDRAWAL") || "BANK_TRANSFER",
      amount: tx.amount,
      midId: detail?.mid?.id || "",
      subId: detail?.sub?.id || "",
      summary: tx.summary || "",
    })
    setEditingId(tx.id)
    setDialogOpen(true)
  }

  const handleStatusChange = async (id: string, status: "READY" | "DRAFT") => {
    if (!selectedCompany) return
    await updateTransactionStatus(id, selectedCompany.id, status)
    loadTransactions(selectedCompany.id)
  }

  const handleDelete = async (id: string) => {
    if (!selectedCompany || !confirm("この経費を削除しますか？")) return
    await deleteTransaction(id, selectedCompany.id)
    loadTransactions(selectedCompany.id)
  }

  const openNewForm = () => {
    setForm(initialFormState)
    setEditingId(null)
    setDialogOpen(true)
  }

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">経費入力</h1>
          <p className="text-muted-foreground">会社を選択してください</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">経費入力</h1>
          <p className="text-muted-foreground">{selectedCompany.name} の経費を入力・管理します</p>
        </div>
        <Button onClick={openNewForm}>新規経費</Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "経費を編集" : "新規経費入力"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>口座 *</Label>
                <Select value={form.accountId} onValueChange={(v) => setForm((p) => ({ ...p, accountId: v }))}>
                  <SelectTrigger><SelectValue placeholder="口座を選択" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.bankName} {a.branchName} {a.accountNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>支払先</Label>
                <Select value={form.partnerId} onValueChange={handlePartnerChange}>
                  <SelectTrigger><SelectValue placeholder="取引先を選択" /></SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>支払日</Label>
                <Input type="date" value={form.transactionDate} onChange={(e) => setForm((p) => ({ ...p, transactionDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>計上月 *</Label>
                <Input type="month" value={form.accountingMonth} onChange={(e) => setForm((p) => ({ ...p, accountingMonth: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>支払方法</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm((p) => ({ ...p, paymentMethod: v as typeof form.paymentMethod }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK_TRANSFER">振込</SelectItem>
                    <SelectItem value="DIRECT_DEBIT">引落</SelectItem>
                    <SelectItem value="CASH_WITHDRAWAL">現金</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>金額 *</Label>
                <Input type="number" placeholder="0" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>勘定科目（中項目） *</Label>
                <Select value={form.midId} onValueChange={handleMidChange}>
                  <SelectTrigger><SelectValue placeholder="科目を選択" /></SelectTrigger>
                  <SelectContent>
                    {expenseMidCategories.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>補助科目（小項目）</Label>
                <Select value={form.subId} onValueChange={(v) => setForm((p) => ({ ...p, subId: v }))} disabled={subCategories.length === 0}>
                  <SelectTrigger><SelectValue placeholder={subCategories.length === 0 ? "なし" : "選択"} /></SelectTrigger>
                  <SelectContent>
                    {subCategories.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>摘要</Label>
              <Input value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} placeholder="メモ・摘要を入力" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>キャンセル</Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.accountId || !form.amount || !form.midId}>
              {submitting ? "保存中..." : editingId ? "更新" : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>経費一覧</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">月</Label>
                <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">状態</Label>
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
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">読み込み中...</p>
          ) : transactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">経費データがありません</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>支払日</TableHead>
                  <TableHead>支払先</TableHead>
                  <TableHead>勘定科目</TableHead>
                  <TableHead>支払方法</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const detail = tx.details[0]
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>{tx.transactionDate ? formatDate(tx.transactionDate) : "—"}</TableCell>
                      <TableCell>{tx.partner?.name || "—"}</TableCell>
                      <TableCell>
                        {detail?.mid?.name || "—"}
                        {detail?.sub?.name ? ` / ${detail.sub.name}` : ""}
                      </TableCell>
                      <TableCell>{tx.paymentMethod ? PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod : "—"}</TableCell>
                      <TableCell className="text-right font-mono">{formatYen(Number(tx.amount))}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{tx.summary || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[tx.status] || "outline"}>
                          {STATUS_LABELS[tx.status] || tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEvidenceTargetId(tx.id)} title="証憑">
                            <Paperclip className="h-4 w-4" />
                          </Button>
                          {tx.status === "DRAFT" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(tx)}>編集</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleStatusChange(tx.id, "READY")}>準備完了</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(tx.id)}>削除</Button>
                            </>
                          )}
                          {tx.status === "READY" && (
                            <Button variant="ghost" size="sm" onClick={() => handleStatusChange(tx.id, "DRAFT")}>差戻し</Button>
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

      {evidenceTargetId && (
        <EvidencePanel
          transactionId={evidenceTargetId}
          open={!!evidenceTargetId}
          onOpenChange={(open) => { if (!open) setEvidenceTargetId(null) }}
        />
      )}
    </div>
  )
}
