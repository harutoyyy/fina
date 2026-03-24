"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useCompany } from "@/contexts/company-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
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
import { createFundTransfer } from "@/app/actions/fund-transfers"
import {
  getExpenseTemplates,
  createRecurringTemplate,
  updateRecurringTemplate,
  deleteRecurringTemplate,
} from "@/app/actions/recurring"
import { checkMonthClosed } from "@/app/actions/cashflow-table"
import { formatYen, formatDate, getCurrentMonth } from "@/lib/format"
import { Checkbox } from "@/components/ui/checkbox"
import EvidencePanel from "@/components/evidence-panel"
import { Paperclip } from "lucide-react"

type AccountOption = {
  id: string
  bankName: string | null
  branchName: string | null
  accountNumber: string | null
  isMain: boolean
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

type ExpenseTemplate = {
  id: string
  name: string
  frequency: string
  dueDayRule: string
  transactionType: string
  accountId: string | null
  partnerId: string | null
  midId: string | null
  subId: string | null
  amountType: string
  fixedAmount: string | null
  paymentMethod: string | null
  classification: string | null
  accountingMonthOffset: number
  summary: string | null
  isActive: boolean
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

const DUE_DAY_LABELS: Record<string, string> = {
  DAY_1: "1日",
  DAY_5: "5日",
  DAY_10: "10日",
  DAY_15: "15日",
  DAY_20: "20日",
  DAY_25: "25日",
  DAY_27: "27日",
  MONTH_END: "月末",
}

const AMOUNT_TYPE_LABELS: Record<string, string> = {
  FIXED: "固定額",
  VARIABLE: "変動",
  MANUAL: "手動",
}

const OFFSET_LABELS: Record<number, string> = {
  [-1]: "前月分",
  0: "当月分",
  1: "翌月分",
}

// ============================================================
// 臨時タブ用フォーム初期値
// ============================================================
const initialTempFormState = {
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

// ============================================================
// テンプレート用フォーム初期値
// ============================================================
const initialTemplateFormState = {
  name: "",
  partnerId: "",
  midId: "",
  subId: "",
  dueDayRule: "DAY_25",
  accountingMonthOffset: 0,
  paymentMethod: "DIRECT_DEBIT" as string,
  amountType: "VARIABLE" as string,
  fixedAmount: "",
  accountId: "",
  summary: "",
  isActive: true,
}

export default function ExpensesPage() {
  const searchParams = useSearchParams()
  const { selectedCompany } = useCompany()
  const [activeTab, setActiveTab] = useState("FIXED")
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [categories, setCategories] = useState<MajorCategory[]>([])

  // テンプレート（固定/変動）
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([])
  const [templateForm, setTemplateForm] = useState(initialTemplateFormState)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [templateSubmitting, setTemplateSubmitting] = useState(false)

  // 臨時タブ
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [filterMonth, setFilterMonth] = useState(getCurrentMonth())
  const [filterStatus, setFilterStatus] = useState<string>("ALL")
  const [tempForm, setTempForm] = useState(initialTempFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tempDialogOpen, setTempDialogOpen] = useState(false)
  const [evidenceTargetId, setEvidenceTargetId] = useState<string | null>(null)
  const [monthClosed, setMonthClosed] = useState(false)
  const [createFundTransferFlag, setCreateFundTransferFlag] = useState(false)
  const [fundTransferSourceId, setFundTransferSourceId] = useState("")
  const [fundTransferDate, setFundTransferDate] = useState("")

  const mainAccountId = accounts.find((a) => a.isMain)?.id || ""
  const showFundTransferOption = tempForm.accountId && tempForm.accountId !== mainAccountId && !editingId

  const expenseMidCategories = categories
    .filter((m) => m.direction === "EXPENSE")
    .flatMap((m) => m.midCategories)

  // 臨時フォーム用
  const selectedTempMid = expenseMidCategories.find((m) => m.id === tempForm.midId)
  const tempSubCategories = selectedTempMid?.subCategories.filter((s) => s.isActive) || []

  // テンプレートフォーム用
  const selectedTemplateMid = expenseMidCategories.find((m) => m.id === templateForm.midId)
  const templateSubCategories = selectedTemplateMid?.subCategories.filter((s) => s.isActive) || []

  // フィルタされたテンプレート
  const filteredTemplates = templates.filter((t) => t.classification === activeTab)

  // ============================================================
  // データ読み込み
  // ============================================================
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
      isMain: a.isMain,
    })))
    setPartners(parts.filter((p) => p.isActive).map((p) => ({
      id: p.id,
      name: p.name,
      defaults: p.defaults.map((d) => ({ midId: d.midId, subId: d.subId })),
    })))
    setCategories(cats as MajorCategory[])
  }, [])

  const loadTemplates = useCallback(async (companyId: string) => {
    const data = await getExpenseTemplates(companyId)
    setTemplates(data as ExpenseTemplate[])
  }, [])

  const loadTransactions = useCallback(async (companyId: string) => {
    setLoading(true)
    try {
      const statusFilter = filterStatus === "ALL" ? undefined : (filterStatus as "DRAFT" | "READY" | "CONFIRMED" | "CANCELLED")
      const [data, closed] = await Promise.all([
        getTransactions(companyId, "EXPENSE", filterMonth || undefined, statusFilter),
        filterMonth ? checkMonthClosed(companyId, filterMonth) : Promise.resolve(false),
      ])
      // 臨時タブ: classification=TEMPORARY のみ表示
      setTransactions(data.filter((t) => t.classification === "TEMPORARY"))
      setMonthClosed(closed)
    } finally {
      setLoading(false)
    }
  }, [filterMonth, filterStatus])

  useEffect(() => {
    if (selectedCompany) {
      loadMasterData(selectedCompany.id)
      loadTemplates(selectedCompany.id)
    }
  }, [selectedCompany, loadMasterData, loadTemplates])

  useEffect(() => {
    if (selectedCompany && activeTab === "TEMPORARY") {
      loadTransactions(selectedCompany.id)
    }
  }, [selectedCompany, activeTab, loadTransactions])

  // 資金繰り表からの編集遷移
  useEffect(() => {
    const editId = searchParams.get("edit")
    if (editId && transactions.length > 0 && !tempDialogOpen) {
      const tx = transactions.find((t) => t.id === editId)
      if (tx) {
        handleEditTemp(tx)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, transactions])

  // ============================================================
  // テンプレート（固定/変動） ハンドラー
  // ============================================================
  const handleTemplatePartnerChange = (partnerId: string) => {
    setTemplateForm((prev) => {
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

  const handleTemplateMidChange = (midId: string) => {
    setTemplateForm((prev) => ({ ...prev, midId, subId: "" }))
  }

  const resetTemplateForm = () => {
    setTemplateForm(initialTemplateFormState)
    setEditingTemplateId(null)
    setTemplateDialogOpen(false)
  }

  const openNewTemplateForm = () => {
    setTemplateForm({
      ...initialTemplateFormState,
      // タブに応じてclassification設定
    })
    setEditingTemplateId(null)
    setTemplateDialogOpen(true)
  }

  const handleEditTemplate = (t: ExpenseTemplate) => {
    setTemplateForm({
      name: t.name,
      partnerId: t.partnerId || "",
      midId: t.midId || "",
      subId: t.subId || "",
      dueDayRule: t.dueDayRule,
      accountingMonthOffset: t.accountingMonthOffset,
      paymentMethod: t.paymentMethod || "DIRECT_DEBIT",
      amountType: t.amountType,
      fixedAmount: t.fixedAmount || "",
      accountId: t.accountId || "",
      summary: t.summary || "",
      isActive: t.isActive,
    })
    setEditingTemplateId(t.id)
    setTemplateDialogOpen(true)
  }

  const handleTemplateSubmit = async () => {
    if (!selectedCompany || !templateForm.name) return
    setTemplateSubmitting(true)
    try {
      const classification = activeTab === "TEMPORARY" ? "VARIABLE" : activeTab
      if (editingTemplateId) {
        await updateRecurringTemplate(editingTemplateId, selectedCompany.id, {
          name: templateForm.name,
          partnerId: templateForm.partnerId || null,
          midId: templateForm.midId || null,
          subId: templateForm.subId || null,
          dueDayRule: templateForm.dueDayRule,
          accountingMonthOffset: templateForm.accountingMonthOffset,
          paymentMethod: templateForm.paymentMethod as "BANK_TRANSFER" | "DIRECT_DEBIT" | "CASH_WITHDRAWAL" | null,
          amountType: templateForm.amountType,
          fixedAmount: templateForm.fixedAmount || null,
          accountId: templateForm.accountId || null,
          summary: templateForm.summary || null,
          isActive: templateForm.isActive,
          classification,
        })
      } else {
        await createRecurringTemplate({
          companyId: selectedCompany.id,
          name: templateForm.name,
          frequency: "MONTHLY",
          dueDayRule: templateForm.dueDayRule,
          transactionType: "EXPENSE",
          partnerId: templateForm.partnerId || undefined,
          midId: templateForm.midId || undefined,
          subId: templateForm.subId || undefined,
          accountingMonthOffset: templateForm.accountingMonthOffset,
          paymentMethod: templateForm.paymentMethod as "BANK_TRANSFER" | "DIRECT_DEBIT" | "CASH_WITHDRAWAL" | undefined,
          amountType: templateForm.amountType,
          fixedAmount: templateForm.fixedAmount || undefined,
          accountId: templateForm.accountId || undefined,
          summary: templateForm.summary || undefined,
          classification,
        })
      }
      resetTemplateForm()
      loadTemplates(selectedCompany.id)
    } finally {
      setTemplateSubmitting(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!selectedCompany || !confirm("この経費項目を削除しますか？")) return
    await deleteRecurringTemplate(id, selectedCompany.id)
    loadTemplates(selectedCompany.id)
  }

  const handleToggleActive = async (t: ExpenseTemplate) => {
    if (!selectedCompany) return
    await updateRecurringTemplate(t.id, selectedCompany.id, { isActive: !t.isActive })
    loadTemplates(selectedCompany.id)
  }

  // ============================================================
  // 臨時タブ ハンドラー
  // ============================================================
  const handleTempPartnerChange = (partnerId: string) => {
    setTempForm((prev) => {
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

  const handleTempMidChange = (midId: string) => {
    setTempForm((prev) => ({ ...prev, midId, subId: "" }))
  }

  const resetTempForm = () => {
    setTempForm(initialTempFormState)
    setEditingId(null)
    setTempDialogOpen(false)
    setCreateFundTransferFlag(false)
    setFundTransferSourceId("")
    setFundTransferDate("")
  }

  const handleTempSubmit = async () => {
    if (!selectedCompany || !tempForm.accountId || !tempForm.amount || !tempForm.midId) return
    setSubmitting(true)
    try {
      if (editingId) {
        await updateTransaction(editingId, selectedCompany.id, {
          accountId: tempForm.accountId,
          partnerId: tempForm.partnerId || null,
          transactionDate: tempForm.transactionDate || null,
          accountingMonth: tempForm.accountingMonth,
          amount: tempForm.amount,
          paymentMethod: tempForm.paymentMethod,
          summary: tempForm.summary || null,
        })
        await upsertTransactionDetails(editingId, [
          {
            midId: tempForm.midId,
            subId: tempForm.subId || undefined,
            amount: tempForm.amount,
            summary: tempForm.summary || undefined,
          },
        ])
      } else {
        await createTransaction({
          companyId: selectedCompany.id,
          accountId: tempForm.accountId,
          partnerId: tempForm.partnerId || undefined,
          type: "EXPENSE",
          transactionDate: tempForm.transactionDate || undefined,
          accountingMonth: tempForm.accountingMonth,
          amount: tempForm.amount,
          paymentMethod: tempForm.paymentMethod,
          summary: tempForm.summary || undefined,
          classification: "TEMPORARY",
          details: [
            {
              midId: tempForm.midId,
              subId: tempForm.subId || undefined,
              amount: tempForm.amount,
              summary: tempForm.summary || undefined,
            },
          ],
        })

        if (createFundTransferFlag && fundTransferSourceId && fundTransferDate) {
          await createFundTransfer({
            companyId: selectedCompany.id,
            fromAccountId: fundTransferSourceId,
            toAccountId: tempForm.accountId,
            transferDate: fundTransferDate,
            amount: tempForm.amount,
            accountingMonth: tempForm.accountingMonth,
            summary: `経費原資移動: ${tempForm.summary || "経費支払"}`,
          })
        }
      }
      resetTempForm()
      loadTransactions(selectedCompany.id)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditTemp = (tx: TransactionWithRelations) => {
    const detail = tx.details[0]
    setTempForm({
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
    setTempDialogOpen(true)
  }

  const handleStatusChange = async (id: string, status: "READY" | "DRAFT") => {
    if (!selectedCompany) return
    await updateTransactionStatus(id, selectedCompany.id, status)
    loadTransactions(selectedCompany.id)
  }

  const handleDeleteTemp = async (id: string) => {
    if (!selectedCompany || !confirm("この経費を削除しますか？")) return
    await deleteTransaction(id, selectedCompany.id)
    loadTransactions(selectedCompany.id)
  }

  // ============================================================
  // レンダリング
  // ============================================================
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">経費入力</h1>
        <p className="text-muted-foreground">{selectedCompany.name} の経費を入力・管理します</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="FIXED">固定</TabsTrigger>
          <TabsTrigger value="VARIABLE">変動</TabsTrigger>
          <TabsTrigger value="TEMPORARY">臨時</TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* 固定 / 変動 タブ */}
        {/* ============================================================ */}
        {["FIXED", "VARIABLE"].map((tabKey) => (
          <TabsContent key={tabKey} value={tabKey}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{tabKey === "FIXED" ? "固定" : "変動"}経費一覧</CardTitle>
                  <Button onClick={openNewTemplateForm}>新規登録</Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredTemplates.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {tabKey === "FIXED" ? "固定" : "変動"}経費が登録されていません
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名称</TableHead>
                        <TableHead>取引先</TableHead>
                        <TableHead>勘定科目</TableHead>
                        <TableHead>支払日</TableHead>
                        <TableHead>計上月</TableHead>
                        <TableHead>支払方法</TableHead>
                        <TableHead>金額タイプ</TableHead>
                        <TableHead className="text-right">固定金額</TableHead>
                        <TableHead>有効</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTemplates.map((t) => {
                        const midCat = expenseMidCategories.find((m) => m.id === t.midId)
                        const partnerName = partners.find((p) => p.id === t.partnerId)?.name
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium">{t.name}</TableCell>
                            <TableCell>{partnerName || "—"}</TableCell>
                            <TableCell>{midCat?.name || "—"}</TableCell>
                            <TableCell>{DUE_DAY_LABELS[t.dueDayRule] || t.dueDayRule}</TableCell>
                            <TableCell>{OFFSET_LABELS[t.accountingMonthOffset] ?? `${t.accountingMonthOffset}ヶ月`}</TableCell>
                            <TableCell>{t.paymentMethod ? PAYMENT_METHOD_LABELS[t.paymentMethod] || t.paymentMethod : "—"}</TableCell>
                            <TableCell>{AMOUNT_TYPE_LABELS[t.amountType] || t.amountType}</TableCell>
                            <TableCell className="text-right font-mono">
                              {t.amountType === "FIXED" && t.fixedAmount ? formatYen(Number(t.fixedAmount)) : "—"}
                            </TableCell>
                            <TableCell>
                              <Switch checked={t.isActive} onCheckedChange={() => handleToggleActive(t)} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEditTemplate(t)}>編集</Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteTemplate(t.id)}>削除</Button>
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
          </TabsContent>
        ))}

        {/* ============================================================ */}
        {/* 臨時 タブ */}
        {/* ============================================================ */}
        <TabsContent value="TEMPORARY">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>臨時経費一覧</CardTitle>
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
                  <Button onClick={() => { setTempForm(initialTempFormState); setEditingId(null); setTempDialogOpen(true) }}>新規経費</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-center py-8">読み込み中...</p>
              ) : transactions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">臨時経費データがありません</p>
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
                                  <Button variant="ghost" size="sm" onClick={() => handleEditTemp(tx)}>編集</Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleStatusChange(tx.id, "READY")}>準備完了</Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteTemp(tx.id)}>削除</Button>
                                </>
                              )}
                              {tx.status === "READY" && (
                                <Button variant="ghost" size="sm" onClick={() => handleStatusChange(tx.id, "DRAFT")}>差戻し</Button>
                              )}
                              {monthClosed && tx.status !== "DRAFT" && (
                                <Button variant="ghost" size="sm" onClick={() => handleEditTemp(tx)}>摘要・科目編集</Button>
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
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* テンプレート登録/編集ダイアログ（固定/変動） */}
      {/* ============================================================ */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplateId ? "経費項目を編集" : "新規経費項目登録"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>名称 *</Label>
                <Input value={templateForm.name} onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))} placeholder="例: NTT東日本" />
              </div>
              <div className="space-y-2">
                <Label>取引先</Label>
                <Select value={templateForm.partnerId} onValueChange={handleTemplatePartnerChange}>
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
              <div className="space-y-2">
                <Label>勘定科目（中項目）</Label>
                <Select value={templateForm.midId} onValueChange={handleTemplateMidChange}>
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
                <Select value={templateForm.subId} onValueChange={(v) => setTemplateForm((p) => ({ ...p, subId: v }))} disabled={templateSubCategories.length === 0}>
                  <SelectTrigger><SelectValue placeholder={templateSubCategories.length === 0 ? "なし" : "選択"} /></SelectTrigger>
                  <SelectContent>
                    {templateSubCategories.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>支払予定日 *</Label>
                <Select value={templateForm.dueDayRule} onValueChange={(v) => setTemplateForm((p) => ({ ...p, dueDayRule: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DUE_DAY_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>計上月</Label>
                <Select value={String(templateForm.accountingMonthOffset)} onValueChange={(v) => setTemplateForm((p) => ({ ...p, accountingMonthOffset: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">前月分</SelectItem>
                    <SelectItem value="0">当月分</SelectItem>
                    <SelectItem value="1">翌月分</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>支払方法</Label>
                <Select value={templateForm.paymentMethod} onValueChange={(v) => setTemplateForm((p) => ({ ...p, paymentMethod: v }))}>
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
                <Label>金額タイプ</Label>
                <Select value={templateForm.amountType} onValueChange={(v) => setTemplateForm((p) => ({ ...p, amountType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">固定額</SelectItem>
                    <SelectItem value="VARIABLE">変動</SelectItem>
                    <SelectItem value="MANUAL">手動</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {templateForm.amountType === "FIXED" && (
                <div className="space-y-2">
                  <Label>固定金額</Label>
                  <Input type="number" placeholder="0" value={templateForm.fixedAmount} onChange={(e) => setTemplateForm((p) => ({ ...p, fixedAmount: e.target.value }))} />
                </div>
              )}
              <div className="space-y-2">
                <Label>口座</Label>
                <Select value={templateForm.accountId} onValueChange={(v) => setTemplateForm((p) => ({ ...p, accountId: v }))}>
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
            </div>
            <div className="space-y-2">
              <Label>摘要</Label>
              <Input value={templateForm.summary} onChange={(e) => setTemplateForm((p) => ({ ...p, summary: e.target.value }))} placeholder="メモ・摘要を入力" />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={templateForm.isActive}
                onCheckedChange={(v) => setTemplateForm((p) => ({ ...p, isActive: v }))}
              />
              <Label htmlFor="isActive">有効</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetTemplateForm}>キャンセル</Button>
            <Button onClick={handleTemplateSubmit} disabled={templateSubmitting || !templateForm.name}>
              {templateSubmitting ? "保存中..." : editingTemplateId ? "更新" : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* 臨時経費登録/編集ダイアログ */}
      {/* ============================================================ */}
      <Dialog open={tempDialogOpen} onOpenChange={setTempDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "経費を編集" : "新規臨時経費入力"}{editingId && monthClosed ? "（月締め中：摘要・科目のみ変更可）" : ""}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>口座 *</Label>
                <Select value={tempForm.accountId} onValueChange={(v) => setTempForm((p) => ({ ...p, accountId: v }))} disabled={editingId !== null && monthClosed}>
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
                <Select value={tempForm.partnerId} onValueChange={handleTempPartnerChange}>
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
                <Input type="date" value={tempForm.transactionDate} onChange={(e) => setTempForm((p) => ({ ...p, transactionDate: e.target.value }))} disabled={editingId !== null && monthClosed} />
              </div>
              <div className="space-y-2">
                <Label>計上月 *</Label>
                <Input type="month" value={tempForm.accountingMonth} onChange={(e) => setTempForm((p) => ({ ...p, accountingMonth: e.target.value }))} disabled={editingId !== null && monthClosed} />
              </div>
              <div className="space-y-2">
                <Label>支払方法</Label>
                <Select value={tempForm.paymentMethod} onValueChange={(v) => setTempForm((p) => ({ ...p, paymentMethod: v as typeof tempForm.paymentMethod }))} disabled={editingId !== null && monthClosed}>
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
                <Input type="number" placeholder="0" value={tempForm.amount} onChange={(e) => setTempForm((p) => ({ ...p, amount: e.target.value }))} disabled={editingId !== null && monthClosed} />
              </div>
              <div className="space-y-2">
                <Label>勘定科目（中項目） *</Label>
                <Select value={tempForm.midId} onValueChange={handleTempMidChange}>
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
                <Select value={tempForm.subId} onValueChange={(v) => setTempForm((p) => ({ ...p, subId: v }))} disabled={tempSubCategories.length === 0}>
                  <SelectTrigger><SelectValue placeholder={tempSubCategories.length === 0 ? "なし" : "選択"} /></SelectTrigger>
                  <SelectContent>
                    {tempSubCategories.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>摘要</Label>
              <Input value={tempForm.summary} onChange={(e) => setTempForm((p) => ({ ...p, summary: e.target.value }))} placeholder="メモ・摘要を入力" />
            </div>
            {showFundTransferOption && (
              <div className="border rounded-md p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="createFundTransfer"
                    checked={createFundTransferFlag}
                    onCheckedChange={(v) => {
                      setCreateFundTransferFlag(!!v)
                      if (v && !fundTransferSourceId) setFundTransferSourceId(mainAccountId)
                    }}
                  />
                  <Label htmlFor="createFundTransfer">原資の資金移動を作成する</Label>
                </div>
                {createFundTransferFlag && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-2">
                      <Label>移動元口座</Label>
                      <Select value={fundTransferSourceId} onValueChange={setFundTransferSourceId}>
                        <SelectTrigger><SelectValue placeholder="口座を選択" /></SelectTrigger>
                        <SelectContent>
                          {accounts.filter((a) => a.id !== tempForm.accountId).map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.bankName} {a.branchName} {a.accountNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>移動日</Label>
                      <Input type="date" value={fundTransferDate} onChange={(e) => setFundTransferDate(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetTempForm}>キャンセル</Button>
            <Button onClick={handleTempSubmit} disabled={submitting || !tempForm.accountId || !tempForm.amount || !tempForm.midId}>
              {submitting ? "保存中..." : editingId ? "更新" : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
