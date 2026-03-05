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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import SalaryExcelImport from "@/components/salary-excel-import"
import { getAccounts } from "@/app/actions/accounts"
import {
  getPayrollGroups,
  getSalaryEntries,
  createSalaryEntry,
  updateSalaryEntry,
  deleteSalaryEntry,
  upsertSalaryDeductions,
  upsertPaymentDetails,
  updateSalaryStatus,
  generateSalaryJournalEntries,
} from "@/app/actions/payroll"
import { formatYen, getCurrentMonth } from "@/lib/format"

type PayrollGroupOption = {
  id: string
  name: string
  costType: string
  headcount: number
}

type AccountOption = {
  id: string
  bankName: string | null
  branchName: string | null
  accountNumber: string | null
}

type DeductionRow = {
  itemName: string
  amount: string
}

type PaymentDetailRow = {
  paymentDate: string
  paymentMethod: "BANK_TRANSFER" | "DIRECT_DEBIT" | "CASH_WITHDRAWAL"
  accountId: string
  amount: string
}

type SalaryEntryData = {
  id: string
  payrollGroupId: string
  payMonth: string
  payDate: string | null
  taxablePayment: string
  transportAllowance: string
  miscExpenses: string
  carryoverAdjust: string
  advanceExpenses: string
  totalPayment: string
  socialInsuranceReserve: string
  consumptionTaxReserve: string
  totalDeduction: string
  netPayment: string
  headcount: number
  status: string
  payrollGroup: { id: string; name: string; costType: string }
  deductions: {
    id: string
    itemName: string
    amount: string
    midId: string | null
    subId: string | null
    displayOrder: number
  }[]
  paymentDetails: {
    id: string
    paymentDate: string
    paymentMethod: string
    accountId: string | null
    amount: string
    displayOrder: number
  }[]
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "下書き",
  READY: "準備完了",
  CONFIRMED: "確定済",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  READY: "secondary",
  CONFIRMED: "default",
}

const COST_TYPE_LABELS: Record<string, string> = {
  COST: "原価",
  SGA: "販管費",
  OUTSOURCE: "外注",
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "振込",
  DIRECT_DEBIT: "引落",
  CASH_WITHDRAWAL: "現金引出",
}

const emptyForm = {
  payrollGroupId: "",
  payDate: "",
  taxablePayment: "0",
  transportAllowance: "0",
  miscExpenses: "0",
  carryoverAdjust: "0",
  advanceExpenses: "0",
  headcount: 0,
}

function calcTotalPayment(f: typeof emptyForm) {
  return (
    (parseInt(f.taxablePayment) || 0) +
    (parseInt(f.transportAllowance) || 0) +
    (parseInt(f.miscExpenses) || 0) +
    (parseInt(f.carryoverAdjust) || 0) +
    (parseInt(f.advanceExpenses) || 0)
  )
}

function calcSocialInsurance(f: typeof emptyForm) {
  return Math.floor((parseInt(f.taxablePayment) || 0) * 0.15)
}

function calcConsumptionTax(f: typeof emptyForm) {
  return Math.floor((parseInt(f.taxablePayment) || 0) * 0.1)
}

export default function SalaryPage() {
  const { selectedCompany } = useCompany()
  const [payrollGroups, setPayrollGroups] = useState<PayrollGroupOption[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [entries, setEntries] = useState<SalaryEntryData[]>([])
  const [loading, setLoading] = useState(false)

  const [filterMonth, setFilterMonth] = useState(getCurrentMonth())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const [deductionDialogOpen, setDeductionDialogOpen] = useState(false)
  const [deductionEntryId, setDeductionEntryId] = useState<string | null>(null)
  const [deductionRows, setDeductionRows] = useState<DeductionRow[]>([])

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentEntryId, setPaymentEntryId] = useState<string | null>(null)
  const [paymentRows, setPaymentRows] = useState<PaymentDetailRow[]>([])

  const [submitting, setSubmitting] = useState(false)

  const loadMasterData = useCallback(async (companyId: string) => {
    const [groups, accts] = await Promise.all([
      getPayrollGroups(companyId),
      getAccounts(companyId),
    ])
    setPayrollGroups(
      (groups as PayrollGroupOption[]).filter((g: PayrollGroupOption & { isActive?: boolean }) => g.isActive !== false)
    )
    setAccounts(
      accts
        .filter((a) => a.isActive)
        .map((a) => ({
          id: a.id,
          bankName: a.bankName,
          branchName: a.branchName,
          accountNumber: a.accountNumber,
        }))
    )
  }, [])

  const loadEntries = useCallback(async (companyId: string) => {
    setLoading(true)
    try {
      const data = await getSalaryEntries(companyId, filterMonth || undefined)
      setEntries(data as SalaryEntryData[])
    } finally {
      setLoading(false)
    }
  }, [filterMonth])

  useEffect(() => {
    if (selectedCompany) {
      loadMasterData(selectedCompany.id)
    }
  }, [selectedCompany, loadMasterData])

  useEffect(() => {
    if (selectedCompany) {
      loadEntries(selectedCompany.id)
    }
  }, [selectedCompany, loadEntries])

  const openNewForm = () => {
    setForm({ ...emptyForm })
    setEditingId(null)
    setDialogOpen(true)
  }

  const openEditForm = (entry: SalaryEntryData) => {
    setForm({
      payrollGroupId: entry.payrollGroupId,
      payDate: entry.payDate ? entry.payDate.split("T")[0] : "",
      taxablePayment: entry.taxablePayment,
      transportAllowance: entry.transportAllowance,
      miscExpenses: entry.miscExpenses,
      carryoverAdjust: entry.carryoverAdjust,
      advanceExpenses: entry.advanceExpenses,
      headcount: entry.headcount,
    })
    setEditingId(entry.id)
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!selectedCompany || !form.payrollGroupId) return
    setSubmitting(true)
    try {
      if (editingId) {
        await updateSalaryEntry(editingId, selectedCompany.id, {
          payDate: form.payDate || null,
          taxablePayment: form.taxablePayment,
          transportAllowance: form.transportAllowance,
          miscExpenses: form.miscExpenses,
          carryoverAdjust: form.carryoverAdjust,
          advanceExpenses: form.advanceExpenses,
          headcount: form.headcount,
        })
      } else {
        await createSalaryEntry({
          payrollGroupId: form.payrollGroupId,
          companyId: selectedCompany.id,
          payMonth: filterMonth,
          payDate: form.payDate || undefined,
          taxablePayment: form.taxablePayment,
          transportAllowance: form.transportAllowance,
          miscExpenses: form.miscExpenses,
          carryoverAdjust: form.carryoverAdjust,
          advanceExpenses: form.advanceExpenses,
          headcount: form.headcount,
        })
      }
      setDialogOpen(false)
      loadEntries(selectedCompany.id)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!selectedCompany || !confirm("この給与データを削除しますか？")) return
    await deleteSalaryEntry(id, selectedCompany.id)
    loadEntries(selectedCompany.id)
  }

  const openDeductionDialog = (entry: SalaryEntryData) => {
    setDeductionEntryId(entry.id)
    setDeductionRows(
      entry.deductions.length > 0
        ? entry.deductions.map((d) => ({ itemName: d.itemName, amount: d.amount }))
        : [{ itemName: "", amount: "0" }]
    )
    setDeductionDialogOpen(true)
  }

  const handleDeductionSubmit = async () => {
    if (!selectedCompany || !deductionEntryId) return
    setSubmitting(true)
    try {
      const validRows = deductionRows.filter((r) => r.itemName.trim() !== "")
      await upsertSalaryDeductions(deductionEntryId, selectedCompany.id, validRows)
      setDeductionDialogOpen(false)
      loadEntries(selectedCompany.id)
    } finally {
      setSubmitting(false)
    }
  }

  const addDeductionRow = () => {
    setDeductionRows((prev) => [...prev, { itemName: "", amount: "0" }])
  }

  const removeDeductionRow = (index: number) => {
    setDeductionRows((prev) => prev.filter((_, i) => i !== index))
  }

  const updateDeductionRow = (index: number, field: keyof DeductionRow, value: string) => {
    setDeductionRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  const openPaymentDialog = (entry: SalaryEntryData) => {
    setPaymentEntryId(entry.id)
    setPaymentRows(
      entry.paymentDetails.length > 0
        ? entry.paymentDetails.map((d) => ({
            paymentDate: d.paymentDate ? d.paymentDate.split("T")[0] : "",
            paymentMethod: d.paymentMethod as PaymentDetailRow["paymentMethod"],
            accountId: d.accountId || "",
            amount: d.amount,
          }))
        : [{ paymentDate: "", paymentMethod: "BANK_TRANSFER", accountId: "", amount: "0" }]
    )
    setPaymentDialogOpen(true)
  }

  const handlePaymentSubmit = async () => {
    if (!selectedCompany || !paymentEntryId) return
    setSubmitting(true)
    try {
      const validRows = paymentRows.filter((r) => r.paymentDate && parseInt(r.amount) !== 0)
      await upsertPaymentDetails(paymentEntryId, selectedCompany.id, validRows)
      setPaymentDialogOpen(false)
      loadEntries(selectedCompany.id)
    } finally {
      setSubmitting(false)
    }
  }

  const addPaymentRow = () => {
    setPaymentRows((prev) => [
      ...prev,
      { paymentDate: "", paymentMethod: "BANK_TRANSFER", accountId: "", amount: "0" },
    ])
  }

  const removePaymentRow = (index: number) => {
    setPaymentRows((prev) => prev.filter((_, i) => i !== index))
  }

  const updatePaymentRow = (index: number, field: keyof PaymentDetailRow, value: string) => {
    setPaymentRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  const handleStatusChange = async (id: string, newStatus: "DRAFT" | "READY" | "CONFIRMED") => {
    if (!selectedCompany) return
    try {
      await updateSalaryStatus(id, selectedCompany.id, newStatus)
      loadEntries(selectedCompany.id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "ステータス変更に失敗しました"
      alert(msg)
    }
  }

  const handleGenerateJournal = async (entryId: string) => {
    if (!selectedCompany) return
    if (!confirm("この給与データから仕訳を自動生成しますか？\n控除項目ごとに取引が作成されます。")) return
    try {
      const result = await generateSalaryJournalEntries(entryId, selectedCompany.id)
      alert(`${result.count}件の仕訳を生成しました`)
      loadEntries(selectedCompany.id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "仕訳生成に失敗しました"
      alert(msg)
    }
  }

  const accountLabel = (a: AccountOption) =>
    [a.bankName, a.branchName, a.accountNumber].filter(Boolean).join(" ") || a.id

  const totalPayment = calcTotalPayment(form)
  const socialInsurance = calcSocialInsurance(form)
  const consumptionTax = calcConsumptionTax(form)

  const deductionTotal = deductionRows.reduce((sum, r) => sum + (parseInt(r.amount) || 0), 0)
  const paymentTotal = paymentRows.reduce((sum, r) => sum + (parseInt(r.amount) || 0), 0)

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">給与入力</h1>
          <p className="text-muted-foreground">会社を選択してください</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">給与入力</h1>
          <p className="text-muted-foreground">{selectedCompany.name} の給与・賞与を入力・管理します</p>
        </div>
        <div className="flex items-center gap-2">
          <SalaryExcelImport companyId={selectedCompany.id} onComplete={() => loadEntries(selectedCompany.id)} />
          <Button onClick={openNewForm} disabled={payrollGroups.length === 0}>
            新規給与入力
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">フィルタ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-1">
              <Label>支給月</Label>
              <Input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-44"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">給与データ一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm py-4">読み込み中...</p>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">データがありません</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ステータス</TableHead>
                  <TableHead>給与グループ</TableHead>
                  <TableHead>コスト種別</TableHead>
                  <TableHead>人数</TableHead>
                  <TableHead className="text-right">課税支給</TableHead>
                  <TableHead className="text-right">総支給</TableHead>
                  <TableHead className="text-right">社保積立(15%)</TableHead>
                  <TableHead className="text-right">消費税積立(10%)</TableHead>
                  <TableHead className="text-right">控除合計</TableHead>
                  <TableHead className="text-right">差引支給</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const entryNetPayment = parseInt(entry.netPayment) || 0
                  const entryPaymentTotal = entry.paymentDetails.reduce(
                    (sum, d) => sum + (parseInt(d.amount) || 0),
                    0
                  )
                  const paymentMismatch = entry.paymentDetails.length > 0 && entryNetPayment !== entryPaymentTotal
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[entry.status] || "outline"}>
                          {STATUS_LABELS[entry.status] || entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{entry.payrollGroup.name}</TableCell>
                      <TableCell>{COST_TYPE_LABELS[entry.payrollGroup.costType] || entry.payrollGroup.costType}</TableCell>
                      <TableCell>{entry.headcount}名</TableCell>
                      <TableCell className="text-right font-mono">{formatYen(parseInt(entry.taxablePayment))}</TableCell>
                      <TableCell className="text-right font-mono">{formatYen(parseInt(entry.totalPayment))}</TableCell>
                      <TableCell className="text-right font-mono text-blue-600">{formatYen(parseInt(entry.socialInsuranceReserve))}</TableCell>
                      <TableCell className="text-right font-mono text-blue-600">{formatYen(parseInt(entry.consumptionTaxReserve))}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{formatYen(parseInt(entry.totalDeduction))}</TableCell>
                      <TableCell className={`text-right font-mono font-bold ${paymentMismatch ? "text-orange-600" : ""}`}>
                        {formatYen(entryNetPayment)}
                        {paymentMismatch && (
                          <span className="block text-xs text-orange-500">
                            支払内訳: {formatYen(entryPaymentTotal)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {entry.status === "DRAFT" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => openEditForm(entry)}>編集</Button>
                              <Button variant="ghost" size="sm" onClick={() => openDeductionDialog(entry)}>控除</Button>
                              <Button variant="ghost" size="sm" onClick={() => openPaymentDialog(entry)}>支払内訳</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleStatusChange(entry.id, "READY")}>準備完了</Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(entry.id)}>削除</Button>
                            </>
                          )}
                          {entry.status === "READY" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => openDeductionDialog(entry)}>控除</Button>
                              <Button variant="ghost" size="sm" onClick={() => openPaymentDialog(entry)}>支払内訳</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleStatusChange(entry.id, "DRAFT")}>差戻し</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleStatusChange(entry.id, "CONFIRMED")}>確定</Button>
                            </>
                          )}
                          {entry.status === "CONFIRMED" && (
                            <Button variant="ghost" size="sm" onClick={() => handleGenerateJournal(entry.id)}>仕訳生成</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {entries.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-muted rounded-md">
                  <div className="text-muted-foreground">支給合計</div>
                  <div className="text-lg font-bold font-mono">
                    {formatYen(entries.reduce((s, e) => s + (parseInt(e.totalPayment) || 0), 0))}
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <div className="text-muted-foreground">控除合計</div>
                  <div className="text-lg font-bold font-mono text-red-600">
                    {formatYen(entries.reduce((s, e) => s + (parseInt(e.totalDeduction) || 0), 0))}
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <div className="text-muted-foreground">差引支給額</div>
                  <div className="text-lg font-bold font-mono">
                    {formatYen(entries.reduce((s, e) => s + (parseInt(e.netPayment) || 0), 0))}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "給与データを編集" : "新規給与入力"}</DialogTitle>
            <DialogDescription>支給月: {filterMonth}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {!editingId && (
              <div className="space-y-1">
                <Label>給与グループ *</Label>
                <Select value={form.payrollGroupId} onValueChange={(v) => {
                  const group = payrollGroups.find((g) => g.id === v)
                  setForm((f) => ({ ...f, payrollGroupId: v, headcount: group?.headcount || f.headcount }))
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="給与グループを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {payrollGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({COST_TYPE_LABELS[g.costType] || g.costType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>支給日</Label>
                <Input
                  type="date"
                  value={form.payDate}
                  onChange={(e) => setForm((f) => ({ ...f, payDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>人数</Label>
                <Input
                  type="number"
                  value={form.headcount}
                  onChange={(e) => setForm((f) => ({ ...f, headcount: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="border rounded-md p-4 space-y-3">
              <h4 className="font-medium text-sm">支給項目</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>課税支給 *</Label>
                  <Input
                    type="number"
                    value={form.taxablePayment}
                    onChange={(e) => setForm((f) => ({ ...f, taxablePayment: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>交通費</Label>
                  <Input
                    type="number"
                    value={form.transportAllowance}
                    onChange={(e) => setForm((f) => ({ ...f, transportAllowance: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>諸経費</Label>
                  <Input
                    type="number"
                    value={form.miscExpenses}
                    onChange={(e) => setForm((f) => ({ ...f, miscExpenses: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>繰越金調整</Label>
                  <Input
                    type="number"
                    value={form.carryoverAdjust}
                    onChange={(e) => setForm((f) => ({ ...f, carryoverAdjust: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>立替経費</Label>
                  <Input
                    type="number"
                    value={form.advanceExpenses}
                    onChange={(e) => setForm((f) => ({ ...f, advanceExpenses: e.target.value }))}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>総支給（自動計算）</Label>
                  <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm font-medium font-mono">
                    {formatYen(totalPayment)}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>社保積立 15%</Label>
                  <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm font-medium font-mono text-blue-600">
                    {formatYen(socialInsurance)}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>消費税積立 10%</Label>
                  <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm font-medium font-mono text-blue-600">
                    {formatYen(consumptionTax)}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSubmit} disabled={submitting || (!editingId && !form.payrollGroupId)}>
              {submitting ? "保存中..." : editingId ? "更新" : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deductionDialogOpen} onOpenChange={setDeductionDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>控除入力</DialogTitle>
            <DialogDescription>控除項目と金額を入力してください</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {deductionRows.map((row, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">項目名</Label>
                  <Input
                    value={row.itemName}
                    onChange={(e) => updateDeductionRow(i, "itemName", e.target.value)}
                    placeholder="家賃控除、貸金控除など"
                  />
                </div>
                <div className="w-36 space-y-1">
                  <Label className="text-xs">金額</Label>
                  <Input
                    type="number"
                    value={row.amount}
                    onChange={(e) => updateDeductionRow(i, "amount", e.target.value)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDeductionRow(i)}
                  disabled={deductionRows.length <= 1}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addDeductionRow}>
              + 行を追加
            </Button>
            <Separator />
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">控除合計</span>
              <span className="font-bold font-mono text-red-600">{formatYen(deductionTotal)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeductionDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleDeductionSubmit} disabled={submitting}>
              {submitting ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>支払内訳入力</DialogTitle>
            <DialogDescription>出金日、支払方法、出金口座、金額を入力してください</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {paymentRows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_120px_auto] gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">出金日</Label>
                  <Input
                    type="date"
                    value={row.paymentDate}
                    onChange={(e) => updatePaymentRow(i, "paymentDate", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">支払方法</Label>
                  <Select
                    value={row.paymentMethod}
                    onValueChange={(v) => updatePaymentRow(i, "paymentMethod", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BANK_TRANSFER">振込</SelectItem>
                      <SelectItem value="DIRECT_DEBIT">引落</SelectItem>
                      <SelectItem value="CASH_WITHDRAWAL">現金引出</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">出金口座</Label>
                  <Select
                    value={row.accountId}
                    onValueChange={(v) => updatePaymentRow(i, "accountId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="口座を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {accountLabel(a)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">金額</Label>
                  <Input
                    type="number"
                    value={row.amount}
                    onChange={(e) => updatePaymentRow(i, "amount", e.target.value)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePaymentRow(i)}
                  disabled={paymentRows.length <= 1}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addPaymentRow}>
              + 行を追加
            </Button>
            <Separator />
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">支払内訳合計</span>
              <span className="font-bold font-mono">{formatYen(paymentTotal)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handlePaymentSubmit} disabled={submitting}>
              {submitting ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
