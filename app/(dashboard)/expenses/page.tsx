"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useCompany } from "@/contexts/company-context"
import { CompanySwitcher } from "@/components/company-switcher"
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

// 経費一覧3サブタブ（画像準拠：未確定/確認待ち/完了）
const EXPENSE_LIST_TABS = [
  { value: "DRAFT", label: "未確定" },
  { value: "READY", label: "確認待ち" },
  { value: "CONFIRMED", label: "完了" },
] as const
type ExpenseListTab = (typeof EXPENSE_LIST_TABS)[number]["value"]

// 前月のYYYY-MMを返す
function getPreviousMonth(month: string): string {
  if (!month) return ""
  const [yStr, mStr] = month.split("-")
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  if (!y || !m) return ""
  const prev = new Date(y, m - 2, 1)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`
}

// 「内容(summary)以外」が必須。欠落していたら「未入力有」フラグを立てる
function hasMissingRequiredFields(
  tx: TransactionWithRelations,
  isOperator: boolean
): boolean {
  if (!tx.transactionDate) return true
  if (!tx.scheduledDate) return true
  if (!tx.paymentMethod) return true
  if (!tx.accountId) return true
  if (Number(tx.amount) <= 0) return true
  if (!tx.partnerId && !tx.temporaryVendorName) return true
  if (!isOperator && !tx.details[0]?.midId) return true
  return false
}

// ============================================================
// 臨時タブ用フォーム初期値
// ============================================================
type ExpensePaymentMethod = "BANK_TRANSFER" | "DIRECT_DEBIT" | "CASH_WITHDRAWAL" | "FUND_TRANSFER"
type ExpenseClassification = "FIXED" | "VARIABLE" | "TEMPORARY" | "RECURRING"

const SUMMARY_MAX_LENGTH = 30

const initialTempFormState = {
  // Row 1: 日付・種別・口座
  scheduledDate: "",
  transactionDate: "",
  paymentMethod: "BANK_TRANSFER" as ExpensePaymentMethod,
  accountId: "",
  destinationAccountId: "", // 第2口座（資金移動時のみ）
  // Row 2: 相手先 / 内容 / 区分
  partnerId: "",
  temporaryVendorName: "",
  summary: "", // 内容（全角30文字程度）
  classification: "TEMPORARY" as ExpenseClassification,
  // Row 3: 金額
  estimatedAmount: "", // 予定金額
  amount: "", // 実金額
  // Row 4: 科目
  midId: "",
  subId: "",
  // メタ
  accountingMonth: getCurrentMonth(),
  // Row 5: 振込先情報（振込時のみ）
  bankCode: "",
  bankName: "",
  branchCode: "",
  branchName: "",
  destAccountType: "ORDINARY" as "ORDINARY" | "CURRENT",
  destAccountNumber: "",
  destAccountHolder: "",
}

export default function ExpensesPage() {
  const searchParams = useSearchParams()
  const { selectedCompany } = useCompany()
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [categories, setCategories] = useState<MajorCategory[]>([])
  const [userProfile, setUserProfile] = useState<CurrentUserProfile | null>(null)
  const isAdmin = userProfile?.role === "ADMIN"
  const isOperator = userProfile?.role === "OPERATOR"

  // 経費一覧（DRAFT/READY/CONFIRMED の3タブで切替）
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [filterMonth, setFilterMonth] = useState(getCurrentMonth())
  const [listSubTab, setListSubTab] = useState<ExpenseListTab>("DRAFT")
  const [previousMonthTemplateIds, setPreviousMonthTemplateIds] = useState<Set<string>>(new Set())
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

  const loadTransactions = useCallback(async (companyId: string) => {
    setLoading(true)
    try {
      // 経費一覧サブタブ → ステータスマップ
      const statusFilter = listSubTab as "DRAFT" | "READY" | "CONFIRMED"
      const previousMonth = getPreviousMonth(filterMonth)
      const [result, closed, prevResult] = await Promise.all([
        // 当月分: 各ステータス1つだけ取得
        getTransactions(companyId, "EXPENSE", filterMonth || undefined, statusFilter),
        filterMonth ? checkMonthClosed(companyId, filterMonth) : Promise.resolve(false),
        // 前月分: 「前月数値」フラグ判定用に取得（recurringTemplateId比較のみに使用）
        previousMonth
          ? getTransactions(companyId, "EXPENSE", previousMonth)
          : Promise.resolve({ data: [] as TransactionWithRelations[], total: 0 }),
      ])
      let filtered = result.data.filter((t) => t.classification === "TEMPORARY")
      // 支払月BOX: scheduledDate の属する月でフィルタ
      if (filterMonth) {
        filtered = filtered.filter((t) => {
          const sd = t.scheduledDate || t.transactionDate
          if (!sd) return true
          const d = new Date(sd)
          const sdMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          return sdMonth === filterMonth || t.accountingMonth === filterMonth
        })
      }
      // 日付順 ↓（昇順）→ 取引先名順
      filtered.sort((a, b) => {
        const dateA = a.scheduledDate || a.transactionDate || ""
        const dateB = b.scheduledDate || b.transactionDate || ""
        if (dateA < dateB) return -1
        if (dateA > dateB) return 1
        const nameA = a.partner?.name || a.temporaryVendorName || ""
        const nameB = b.partner?.name || b.temporaryVendorName || ""
        return nameA.localeCompare(nameB, "ja")
      })
      // 前月の繰返テンプレIDのSet（前月数値フラグ判定用）
      const prevTplIds = new Set<string>()
      for (const t of prevResult.data) {
        if (t.recurringTemplateId) prevTplIds.add(t.recurringTemplateId)
      }
      setPreviousMonthTemplateIds(prevTplIds)
      setTransactions(filtered)
      setMonthClosed(closed)
      setSelectedIds(new Set())
    } finally {
      setLoading(false)
    }
  }, [filterMonth, listSubTab])

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

  // ?tab=XXX クエリ で初期タブを設定（DRAFT/READY/CONFIRMED のみ）
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && ["DRAFT", "READY", "CONFIRMED"].includes(tab)) {
      setListSubTab(tab as ExpenseListTab)
    }
  }, [searchParams])

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
    if (tempForm.paymentMethod === "FUND_TRANSFER" && !tempForm.destinationAccountId) return
    if (tempForm.paymentMethod !== "FUND_TRANSFER" && !isOperator && !tempForm.midId) return
    setSubmitting(true)
    try {
      // 種別 = 資金移動: FundTransfer として作成
      if (tempForm.paymentMethod === "FUND_TRANSFER" && !editingId) {
        await createFundTransfer({
          companyId: selectedCompany.id,
          fromAccountId: tempForm.accountId,
          toAccountId: tempForm.destinationAccountId,
          transferDate: tempForm.transactionDate || tempForm.scheduledDate || new Date().toISOString().split("T")[0],
          amount: tempForm.amount,
          accountingMonth: tempForm.accountingMonth,
          summary: tempForm.summary || "資金移動",
        })
        resetTempForm()
        loadTransactions(selectedCompany.id)
        return
      }

      // 振込先情報があれば添付（振込時のみ）
      const hasBankInfo =
        tempForm.paymentMethod === "BANK_TRANSFER" &&
        tempForm.bankCode &&
        tempForm.branchCode &&
        tempForm.destAccountNumber &&
        tempForm.destAccountHolder
      const bankInfo = hasBankInfo
        ? {
            bankCode: tempForm.bankCode,
            bankName: tempForm.bankName || undefined,
            branchCode: tempForm.branchCode,
            branchName: tempForm.branchName || undefined,
            accountType: tempForm.destAccountType,
            accountNumber: tempForm.destAccountNumber,
            accountHolder: tempForm.destAccountHolder,
          }
        : undefined

      // PaymentMethod は schema enum 3値のいずれか
      const dbPaymentMethod = tempForm.paymentMethod as "BANK_TRANSFER" | "DIRECT_DEBIT" | "CASH_WITHDRAWAL"

      if (editingId) {
        await updateTransaction(editingId, selectedCompany.id, {
          accountId: tempForm.accountId,
          partnerId: tempForm.partnerId || null,
          temporaryVendorName: tempForm.partnerId ? null : (tempForm.temporaryVendorName || null),
          transactionDate: tempForm.transactionDate || null,
          scheduledDate: tempForm.scheduledDate || null,
          accountingMonth: tempForm.accountingMonth,
          amount: tempForm.amount,
          estimatedAmount: tempForm.estimatedAmount || null,
          actualAmount: tempForm.amount || null,
          paymentMethod: dbPaymentMethod,
          classification: tempForm.classification,
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
          scheduledDate: tempForm.scheduledDate || undefined,
          accountingMonth: tempForm.accountingMonth,
          amount: tempForm.amount,
          estimatedAmount: tempForm.estimatedAmount || undefined,
          actualAmount: tempForm.amount,
          paymentMethod: dbPaymentMethod,
          summary: tempForm.summary || undefined,
          classification: tempForm.classification,
          details: [
            {
              midId: tempForm.midId,
              subId: tempForm.subId || undefined,
              amount: tempForm.amount,
              summary: tempForm.summary || undefined,
            },
          ],
          temporaryBankAccount: bankInfo,
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
      ...initialTempFormState,
      accountId: tx.account.id,
      destinationAccountId: "",
      partnerId: tx.partner?.id || "",
      temporaryVendorName: tx.temporaryVendorName || "",
      scheduledDate: tx.scheduledDate ? tx.scheduledDate.split("T")[0] : "",
      transactionDate: tx.transactionDate ? tx.transactionDate.split("T")[0] : "",
      accountingMonth: tx.accountingMonth,
      paymentMethod: (tx.paymentMethod as ExpensePaymentMethod) || "BANK_TRANSFER",
      amount: tx.amount,
      estimatedAmount: tx.estimatedAmount || "",
      classification: (tx.classification as ExpenseClassification) || "TEMPORARY",
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
  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">経費入力</h1>
          <CompanySwitcher />
        </div>
        <p className="text-muted-foreground">会社を選択してください</p>
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
        <CompanySwitcher />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>経費一覧</CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">月</Label>
                <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40" />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">口座は混在</span>
              {listSubTab === "DRAFT" && selectedIds.size > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={batchLoading}
                  onClick={handleBatchReady}
                >
                  選択を準備完了 ({selectedIds.size})
                </Button>
              )}
              <Button onClick={() => { setTempForm({ ...initialTempFormState, accountId: mainAccountId }); setEditingId(null); setTempDialogOpen(true) }}>
                + 新規経費
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={listSubTab} onValueChange={(v) => setListSubTab(v as ExpenseListTab)}>
            <TabsList>
              {EXPENSE_LIST_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
            {EXPENSE_LIST_TABS.map((t) => (
              <TabsContent key={t.value} value={t.value} className="mt-4">
                {loading ? (
                  <p className="text-muted-foreground text-center py-8">読み込み中...</p>
                ) : transactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t.label}の経費がありません</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {listSubTab === "DRAFT" && (
                          <TableHead className="w-8">
                            <Checkbox
                              checked={transactions.length > 0 && transactions.every(tx => selectedIds.has(tx.id))}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                        )}
                        <TableHead className="w-32">予定日付</TableHead>
                        <TableHead>相手先</TableHead>
                        <TableHead>内容</TableHead>
                        <TableHead className="text-right w-32">金額</TableHead>
                        <TableHead className="text-right w-48"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => {
                        const dateLabel = tx.scheduledDate ? formatDate(tx.scheduledDate) : (tx.transactionDate ? formatDate(tx.transactionDate) : "—")
                        return (
                          <TableRow key={tx.id}>
                            {listSubTab === "DRAFT" && (
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(tx.id)}
                                  onCheckedChange={() => toggleSelect(tx.id)}
                                />
                              </TableCell>
                            )}
                            <TableCell className="whitespace-nowrap font-mono text-sm">{dateLabel}</TableCell>
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
                            <TableCell className="max-w-[280px] truncate">{tx.summary || "—"}</TableCell>
                            <TableCell className="text-right font-mono">{formatYen(Number(tx.amount))}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setEvidenceTargetId(tx.id)} title="証憑">
                                  <Paperclip className="h-4 w-4" />
                                </Button>
                                {tx.status === "DRAFT" && (
                                  <>
                                    <Button variant="ghost" size="sm" onClick={() => handleEditTemp(tx)}>編集</Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleStatusChange(tx.id, "READY")}>確認待ちへ</Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteTemp(tx.id)}>削除</Button>
                                  </>
                                )}
                                {tx.status === "READY" && (
                                  <Button variant="ghost" size="sm" onClick={() => handleStatusChange(tx.id, "DRAFT")}>差戻し</Button>
                                )}
                                {monthClosed && tx.status !== "DRAFT" && (
                                  <Button variant="ghost" size="sm" onClick={() => handleEditTemp(tx)}>編集</Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>


      {/* ============================================================ */}
      {/* 経費 新規登録/編集ダイアログ（PDF P1下スケッチ準拠） */}
      {/* ============================================================ */}
      <Dialog open={tempDialogOpen} onOpenChange={setTempDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "経費を編集" : "新規経費入力"}
              {editingId && monthClosed ? "（月締め中：摘要・科目のみ変更可）" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            {/* Row 1: 予定日付 / 実日付 / 種別 / 口座 */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>予定日付</Label>
                <Input
                  type="date"
                  value={tempForm.scheduledDate}
                  onChange={(e) => {
                    const v = e.target.value
                    setTempForm((p) => ({
                      ...p,
                      scheduledDate: v,
                      // 実日付未入力なら 予定日付 を自動展開
                      transactionDate: p.transactionDate || v,
                    }))
                  }}
                  disabled={editingId !== null && monthClosed}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-amber-700 dark:text-amber-400">実日付 <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={tempForm.transactionDate}
                  onChange={(e) => setTempForm((p) => ({ ...p, transactionDate: e.target.value }))}
                  disabled={editingId !== null && monthClosed}
                  className="bg-amber-50/40 dark:bg-amber-900/10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-amber-700 dark:text-amber-400">種別 <span className="text-red-500">*</span></Label>
                <Select
                  value={tempForm.paymentMethod}
                  onValueChange={(v) => setTempForm((p) => ({ ...p, paymentMethod: v as ExpensePaymentMethod }))}
                  disabled={editingId !== null && (monthClosed || tempForm.paymentMethod === "FUND_TRANSFER")}
                >
                  <SelectTrigger className="bg-amber-50/40 dark:bg-amber-900/10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FUND_TRANSFER">資金移動</SelectItem>
                    <SelectItem value="BANK_TRANSFER">振込</SelectItem>
                    <SelectItem value="DIRECT_DEBIT">引落</SelectItem>
                    <SelectItem value="CASH_WITHDRAWAL">現金</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-amber-700 dark:text-amber-400">口座 <span className="text-red-500">*</span></Label>
                <Select
                  value={tempForm.accountId}
                  onValueChange={(v) => setTempForm((p) => ({ ...p, accountId: v }))}
                  disabled={editingId !== null && monthClosed}
                >
                  <SelectTrigger className="bg-amber-50/40 dark:bg-amber-900/10"><SelectValue placeholder="口座を選択" /></SelectTrigger>
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

            {/* Row 1b: 資金移動時の第2口座 */}
            {tempForm.paymentMethod === "FUND_TRANSFER" && (
              <div className="grid grid-cols-2 gap-4 rounded-md border border-purple-200 bg-purple-50/40 p-3 dark:border-purple-900 dark:bg-purple-950/20">
                <div className="space-y-2">
                  <Label>移動先口座 <span className="text-red-500">*</span></Label>
                  <Select
                    value={tempForm.destinationAccountId}
                    onValueChange={(v) => setTempForm((p) => ({ ...p, destinationAccountId: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="移動先口座を選択" /></SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter((a) => a.id !== tempForm.accountId)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.bankName} {a.branchName} {a.accountNumber}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 self-end text-xs text-muted-foreground">
                  ※資金移動の場合は移動元/先の2口座を入力します。資金繰表に両側自動反映されます。
                </div>
              </div>
            )}

            {/* Row 2: 相手先 / 内容 / 区分 （資金移動では非表示） */}
            {tempForm.paymentMethod !== "FUND_TRANSFER" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>相手先</Label>
                    <Select value={tempForm.partnerId || "__none__"} onValueChange={handleTempPartnerChange}>
                      <SelectTrigger><SelectValue placeholder="取引先を選択（新規は仮名で）" /></SelectTrigger>
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
                  <div className="space-y-2 col-span-2">
                    <Label className="flex items-center justify-between">
                      <span className="text-amber-700 dark:text-amber-400">内容 <span className="text-red-500">*</span></span>
                      <span className="text-xs text-muted-foreground">
                        {tempForm.summary.length}/{SUMMARY_MAX_LENGTH}
                      </span>
                    </Label>
                    <Input
                      value={tempForm.summary}
                      maxLength={SUMMARY_MAX_LENGTH}
                      onChange={(e) => setTempForm((p) => ({ ...p, summary: e.target.value }))}
                      placeholder="例: 4月分電気代"
                      className="bg-amber-50/40 dark:bg-amber-900/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>区分</Label>
                    <Select
                      value={tempForm.classification}
                      onValueChange={(v) => setTempForm((p) => ({ ...p, classification: v as ExpenseClassification }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXED">固定</SelectItem>
                        <SelectItem value="VARIABLE">変動</SelectItem>
                        <SelectItem value="TEMPORARY">臨時</SelectItem>
                        <SelectItem value="RECURRING">定期</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Row 3: 予定金額 / 実金額 / 差額 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>予定金額</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={tempForm.estimatedAmount}
                  onChange={(e) => setTempForm((p) => ({ ...p, estimatedAmount: e.target.value }))}
                  disabled={editingId !== null && monthClosed}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-amber-700 dark:text-amber-400">実金額 <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={tempForm.amount}
                  onChange={(e) => setTempForm((p) => ({ ...p, amount: e.target.value }))}
                  disabled={editingId !== null && monthClosed}
                  className="bg-amber-50/40 dark:bg-amber-900/10"
                />
              </div>
              <div className="space-y-2">
                <Label>差額</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm">
                  {(() => {
                    const e = Number(tempForm.estimatedAmount || 0)
                    const a = Number(tempForm.amount || 0)
                    if (!tempForm.estimatedAmount || !tempForm.amount) {
                      return <span className="text-muted-foreground">—</span>
                    }
                    const diff = a - e
                    if (diff === 0) return <span className="text-muted-foreground">差額なし</span>
                    return (
                      <span className={diff > 0 ? "text-red-600" : "text-blue-600"}>
                        {diff > 0 ? "△ " : "+ "}
                        {formatYen(Math.abs(diff))}
                      </span>
                    )
                  })()}
                </div>
              </div>
            </div>

            {/* Row 4: 科目設定 / 補助 （資金移動では非表示） */}
            {tempForm.paymentMethod !== "FUND_TRANSFER" && !isOperator && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>勘定科目（中項目） <span className="text-red-500">*</span></Label>
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
                  <Select
                    value={tempForm.subId}
                    onValueChange={(v) => setTempForm((p) => ({ ...p, subId: v }))}
                    disabled={tempSubCategories.length === 0}
                  >
                    <SelectTrigger><SelectValue placeholder={tempSubCategories.length === 0 ? "なし" : "選択"} /></SelectTrigger>
                    <SelectContent>
                      {tempSubCategories.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Row 5: 計上月 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>計上月 <span className="text-red-500">*</span></Label>
                <Input
                  type="month"
                  value={tempForm.accountingMonth}
                  onChange={(e) => setTempForm((p) => ({ ...p, accountingMonth: e.target.value }))}
                  disabled={editingId !== null && monthClosed}
                />
              </div>
            </div>

            {/* Row 6: 振込先情報（種別=振込のみ表示） */}
            {tempForm.paymentMethod === "BANK_TRANSFER" && (
              <div className="space-y-3 rounded-md border bg-muted/30 p-4">
                <div className="flex items-baseline justify-between">
                  <Label className="text-base font-semibold">振込先情報</Label>
                  <span className="text-xs text-muted-foreground">※半角入力 / 既存取引先口座があれば未入力でOK</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">銀行コード</Label>
                    <Input
                      value={tempForm.bankCode}
                      maxLength={4}
                      placeholder="0001"
                      onChange={(e) => setTempForm((p) => ({ ...p, bankCode: e.target.value.replace(/[^0-9]/g, "") }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">銀行名</Label>
                    <Input
                      value={tempForm.bankName}
                      placeholder="〇〇銀行"
                      onChange={(e) => setTempForm((p) => ({ ...p, bankName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">支店コード</Label>
                    <Input
                      value={tempForm.branchCode}
                      maxLength={3}
                      placeholder="001"
                      onChange={(e) => setTempForm((p) => ({ ...p, branchCode: e.target.value.replace(/[^0-9]/g, "") }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">支店名</Label>
                    <Input
                      value={tempForm.branchName}
                      placeholder="〇〇支店"
                      onChange={(e) => setTempForm((p) => ({ ...p, branchName: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">預金種別</Label>
                    <Select
                      value={tempForm.destAccountType}
                      onValueChange={(v) => setTempForm((p) => ({ ...p, destAccountType: v as "ORDINARY" | "CURRENT" }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ORDINARY">普通</SelectItem>
                        <SelectItem value="CURRENT">当座</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">口座No.</Label>
                    <Input
                      value={tempForm.destAccountNumber}
                      maxLength={8}
                      placeholder="1234567"
                      onChange={(e) => setTempForm((p) => ({ ...p, destAccountNumber: e.target.value.replace(/[^0-9]/g, "") }))}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">口座名義（半角カナ）</Label>
                    <Input
                      value={tempForm.destAccountHolder}
                      placeholder="ｶﾌﾞｼｷｶﾞｲｼｬ ｱｲｳｴｵ"
                      onChange={(e) => setTempForm((p) => ({ ...p, destAccountHolder: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Row 7: 帳票添付ガイド */}
            {!editingId && (
              <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">帳票添付（PDF）</span>
                ：登録後に一覧の <Paperclip className="inline h-3 w-3" /> アイコンから添付できます。
                <span className="ml-2">※帳票なしでもOKフラグを管理者が付けられます。</span>
              </div>
            )}

            {/* 原資の資金移動オプション（振込/引落/現金で主口座以外を使う場合のみ） */}
            {tempForm.paymentMethod !== "FUND_TRANSFER" && showFundTransferOption && (
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
            <Button
              onClick={handleTempSubmit}
              disabled={
                submitting ||
                !tempForm.accountId ||
                !tempForm.amount ||
                !tempForm.transactionDate ||
                (tempForm.paymentMethod === "FUND_TRANSFER"
                  ? !tempForm.destinationAccountId
                  : !tempForm.summary || (!isOperator && !tempForm.midId))
              }
            >
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
