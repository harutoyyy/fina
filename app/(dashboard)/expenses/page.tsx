"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useCompany, isAllCompanies } from "@/contexts/company-context"
import { AllCompaniesBanner } from "@/components/all-companies-banner"
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
  normalizePartner,
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
import { getCurrentUserProfile, type CurrentUserProfile } from "@/app/actions/user-profile"

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
  temporaryVendorName: "",
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
  const [userProfile, setUserProfile] = useState<CurrentUserProfile | null>(null)
  const isAdmin = userProfile?.role === "ADMIN"
  const isOperator = userProfile?.role === "OPERATOR"

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
  const [filterStatus, setFilterStatus] = useState<string>("UNCONFIRMED")
  const [showConfirmed, setShowConfirmed] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)
  const [tempForm, setTempForm] = useState(initialTempFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tempDialogOpen, setTempDialogOpen] = useState(false)
  const [evidenceTargetId, setEvidenceTargetId] = useState<string | null>(null)
  const [monthClosed, setMonthClosed] = useState(false)
  const [createFundTransferFlag, setCreateFundTransferFlag] = useState(false)
  const [fundTransferSourceId, setFundTransferSourceId] = useState("")
  const [fundTransferDate, setFundTransferDate] = useState("")
  // T-13: 正規化ダイアログ
  const [normalizeDialogOpen, setNormalizeDialogOpen] = useState(false)
  const [normalizeTargetId, setNormalizeTargetId] = useState<string | null>(null)
  const [normalizePartnerId, setNormalizePartnerId] = useState("")
  const [normalizeRegisterBank, setNormalizeRegisterBank] = useState(false)
  const [normalizeLoading, setNormalizeLoading] = useState(false)

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
    const [accts, parts, cats, profile] = await Promise.all([
      getAccounts(companyId),
      getPartners(companyId),
      getCategories(),
      getCurrentUserProfile(),
    ])
    setUserProfile(profile)
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
      // UNCONFIRMED = DRAFT + READY, ALL = 全ステータス, or specific status
      let statusFilter: "DRAFT" | "READY" | "CONFIRMED" | "CANCELLED" | undefined
      if (filterStatus === "UNCONFIRMED") {
        statusFilter = undefined // fetch all, then client-side filter
      } else if (filterStatus === "ALL") {
        statusFilter = undefined
      } else {
        statusFilter = filterStatus as "DRAFT" | "READY" | "CONFIRMED" | "CANCELLED"
      }
      const [result, closed] = await Promise.all([
        getTransactions(companyId, "EXPENSE", filterMonth || undefined, statusFilter),
        filterMonth ? checkMonthClosed(companyId, filterMonth) : Promise.resolve(false),
      ])
      let filtered = result.data.filter((t) => t.classification === "TEMPORARY")
      // 支払月BOX: scheduledDate の属する月でフィルタ（休日調整後の実行予定日ベース）
      if (filterMonth) {
        filtered = filtered.filter((t) => {
          const sd = t.scheduledDate || t.transactionDate
          if (!sd) return true // 日付なしは表示
          const d = new Date(sd)
          const sdMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          return sdMonth === filterMonth || t.accountingMonth === filterMonth
        })
      }
      // UNCONFIRMED: DRAFT + READY のみ（確定表示チェックで CONFIRMED も混在可能）
      if (filterStatus === "UNCONFIRMED") {
        if (showConfirmed) {
          filtered = filtered.filter((t) => ["DRAFT", "READY", "CONFIRMED"].includes(t.status))
        } else {
          filtered = filtered.filter((t) => ["DRAFT", "READY"].includes(t.status))
        }
      }
      // ソート: scheduledDate 昇順 → 取引先名順
      filtered.sort((a, b) => {
        const dateA = a.scheduledDate || a.transactionDate || ""
        const dateB = b.scheduledDate || b.transactionDate || ""
        if (dateA < dateB) return -1
        if (dateA > dateB) return 1
        const nameA = a.partner?.name || a.temporaryVendorName || ""
        const nameB = b.partner?.name || b.temporaryVendorName || ""
        return nameA.localeCompare(nameB, "ja")
      })
      setTransactions(filtered)
      setMonthClosed(closed)
      setSelectedIds(new Set())
    } finally {
      setLoading(false)
    }
  }, [filterMonth, filterStatus, showConfirmed])

  useEffect(() => {
    if (selectedCompany && !isAllCompanies(selectedCompany)) {
      loadMasterData(selectedCompany.id)
      loadTemplates(selectedCompany.id)
    }
  }, [selectedCompany, loadMasterData, loadTemplates])

  useEffect(() => {
    if (selectedCompany && !isAllCompanies(selectedCompany) && activeTab === "TEMPORARY") {
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
    const resolved = partnerId === "__none__" ? "" : partnerId
    setTemplateForm((prev) => {
      const partner = partners.find((p) => p.id === resolved)
      const defaults = partner?.defaults?.[0]
      return {
        ...prev,
        partnerId: resolved,
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
    const resolved = partnerId === "__none__" ? "" : partnerId
    setTempForm((prev) => {
      const partner = partners.find((p) => p.id === resolved)
      const defaults = partner?.defaults?.[0]
      return {
        ...prev,
        partnerId: resolved,
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
    if (!selectedCompany || !tempForm.accountId || !tempForm.amount) return
    if (!isOperator && !tempForm.midId) return // ADMIN は科目必須、OPERATOR は不要
    setSubmitting(true)
    try {
      if (editingId) {
        await updateTransaction(editingId, selectedCompany.id, {
          accountId: tempForm.accountId,
          partnerId: tempForm.partnerId || null,
          temporaryVendorName: tempForm.partnerId ? null : (tempForm.temporaryVendorName || null),
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
          temporaryVendorName: tempForm.partnerId ? undefined : (tempForm.temporaryVendorName || undefined),
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
      temporaryVendorName: tx.temporaryVendorName || "",
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

  const handleBatchReady = async () => {
    if (!selectedCompany || selectedIds.size === 0) return
    setBatchLoading(true)
    try {
      const targets = transactions.filter((t) => selectedIds.has(t.id) && t.status === "DRAFT")
      const errors: string[] = []
      for (const tx of targets) {
        try {
          await updateTransactionStatus(tx.id, selectedCompany.id, "READY")
        } catch (e) {
          const partnerName = tx.partner?.name || tx.temporaryVendorName || tx.id
          errors.push(`${partnerName}: ${e instanceof Error ? e.message : "エラー"}`)
        }
      }
      if (errors.length > 0) {
        alert(`一部の準備完了に失敗しました:\n${errors.join("\n")}`)
      }
      await loadTransactions(selectedCompany.id)
    } finally {
      setBatchLoading(false)
    }
  }

  const toggleSelectAll = () => {
    const draftIds = transactions.filter((t) => t.status === "DRAFT").map((t) => t.id)
    if (draftIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(draftIds))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDeleteTemp = async (id: string) => {
    if (!selectedCompany || !confirm("この経費を削除しますか？")) return
    await deleteTransaction(id, selectedCompany.id)
    loadTransactions(selectedCompany.id)
  }

  // T-13: 正規化
  const openNormalizeDialog = (txId: string) => {
    setNormalizeTargetId(txId)
    setNormalizePartnerId("")
    setNormalizeRegisterBank(false)
    setNormalizeDialogOpen(true)
  }

  const handleNormalize = async () => {
    if (!selectedCompany || !normalizeTargetId || !normalizePartnerId) return
    setNormalizeLoading(true)
    try {
      await normalizePartner(normalizeTargetId, selectedCompany.id, normalizePartnerId, normalizeRegisterBank)
      setNormalizeDialogOpen(false)
      loadTransactions(selectedCompany.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : "正規化に失敗しました")
    } finally {
      setNormalizeLoading(false)
    }
  }

  // ============================================================
  // レンダリング
  // ============================================================
  if (isAllCompanies(selectedCompany)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">経費入力</h1>
          <p className="text-muted-foreground">全社合算モード</p>
        </div>
        <AllCompaniesBanner feature="経費入力" />
      </div>
    )
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
                        {!isOperator && <TableHead>勘定科目</TableHead>}
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
                            {!isOperator && <TableCell>{midCat?.name || "—"}</TableCell>}
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
                <CardTitle>支払月BOX — 臨時経費</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">月</Label>
                    <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="showConfirmed"
                      checked={showConfirmed}
                      onCheckedChange={(v) => setShowConfirmed(v === true)}
                    />
                    <Label htmlFor="showConfirmed" className="text-sm">確定済も表示</Label>
                  </div>
                  {selectedIds.size > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={batchLoading}
                      onClick={handleBatchReady}
                    >
                      選択を準備完了 ({selectedIds.size})
                    </Button>
                  )}
                  <Button onClick={() => { setTempForm({ ...initialTempFormState, accountId: mainAccountId }); setEditingId(null); setTempDialogOpen(true) }}>新規経費</Button>
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
                      <TableHead className="w-8">
                        <Checkbox
                          checked={transactions.filter(t => t.status === "DRAFT").length > 0 && transactions.filter(t => t.status === "DRAFT").every(t => selectedIds.has(t.id))}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>予定日</TableHead>
                      <TableHead>支払先</TableHead>
                      {!isOperator && <TableHead>勘定科目</TableHead>}
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
                          <TableCell>
                            {tx.status === "DRAFT" && (
                              <Checkbox
                                checked={selectedIds.has(tx.id)}
                                onCheckedChange={() => toggleSelect(tx.id)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{tx.scheduledDate ? formatDate(tx.scheduledDate) : (tx.transactionDate ? formatDate(tx.transactionDate) : "—")}</TableCell>
                          <TableCell>
                            {tx.partner?.name || (tx.temporaryVendorName ? (
                              <div className="flex items-center gap-1">
                                <span className="text-orange-600">{tx.temporaryVendorName}（仮）</span>
                                {isAdmin && (
                                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => openNormalizeDialog(tx.id)}>
                                    正規化
                                  </Button>
                                )}
                              </div>
                            ) : "—")}
                          </TableCell>
                          {!isOperator && (
                            <TableCell>
                              {detail?.mid?.name || "—"}
                              {detail?.sub?.name ? ` / ${detail.sub.name}` : ""}
                            </TableCell>
                          )}
                          <TableCell>
                            {tx.paymentMethod ? PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod : "—"}
                            {isOperator && !detail?.mid?.name && (
                              <Badge variant="destructive" className="ml-2 text-[10px]">⚠ 科目未設定</Badge>
                            )}
                          </TableCell>
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
                <Select value={templateForm.partnerId || "__none__"} onValueChange={handleTemplatePartnerChange}>
                  <SelectTrigger><SelectValue placeholder="取引先を選択" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">未選択</SelectItem>
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
                <Select value={tempForm.partnerId || "__none__"} onValueChange={handleTempPartnerChange}>
                  <SelectTrigger><SelectValue placeholder="取引先を選択" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">未選択（仮取引先名を入力）</SelectItem>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!tempForm.partnerId && (
                <div className="space-y-2">
                  <Label>仮取引先名</Label>
                  <Input
                    placeholder="正規取引先が未登録の場合に入力"
                    value={tempForm.temporaryVendorName}
                    onChange={(e) => setTempForm((p) => ({ ...p, temporaryVendorName: e.target.value }))}
                  />
                </div>
              )}
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
              {!isOperator && (
                <>
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
                </>
              )}
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

      {/* T-13: 正規化ダイアログ */}
      <Dialog open={normalizeDialogOpen} onOpenChange={setNormalizeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取引先を正規化</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>正規取引先を選択</Label>
              <Select value={normalizePartnerId} onValueChange={setNormalizePartnerId}>
                <SelectTrigger><SelectValue placeholder="取引先を選択" /></SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {normalizeTargetId && transactions.find(t => t.id === normalizeTargetId)?.temporaryVendorName && (
              <p className="text-sm text-muted-foreground">
                仮取引先名「{transactions.find(t => t.id === normalizeTargetId)?.temporaryVendorName}」を正規取引先に紐付けます
              </p>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={normalizeRegisterBank} onCheckedChange={setNormalizeRegisterBank} />
              <Label className="text-sm">仮口座を正式口座として登録する</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNormalizeDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleNormalize} disabled={!normalizePartnerId || normalizeLoading}>
              {normalizeLoading ? "処理中..." : "正規化"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
