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
import { Switch } from "@/components/ui/switch"
import { getAccounts } from "@/app/actions/accounts"
import { getPartners } from "@/app/actions/partners"
import { getCategories } from "@/app/actions/categories"
import {
  getRecurringTemplates,
  createRecurringTemplate,
  updateRecurringTemplate,
  deleteRecurringTemplate,
  generateRecurringTransactions,
  autoGenerateRecurringTransactions,
} from "@/app/actions/recurring"
import { formatYen, getCurrentMonth } from "@/lib/format"

type AccountOption = {
  id: string
  bankName: string | null
  branchName: string | null
  accountNumber: string | null
}

type PartnerOption = {
  id: string
  name: string
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

type Template = {
  id: string
  name: string
  frequency: string
  specificMonths: number[]
  dueDayRule: string
  holidayAdjust: string
  transactionType: string
  accountId: string | null
  partnerId: string | null
  midId: string | null
  subId: string | null
  amountType: string
  fixedAmount: string | null
  paymentMethod: string | null
  classification: string | null
  summary: string | null
  isActive: boolean
  lastGeneratedMonth: string | null
}

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "毎月",
  BIMONTHLY_ODD: "隔月（奇数月）",
  BIMONTHLY_EVEN: "隔月（偶数月）",
  QUARTERLY: "四半期",
  YEARLY: "年次",
  SPECIFIC_MONTHS: "特定月",
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  EXPENSE: "経費",
  SALES: "売上",
  COST_PAYMENT: "原価支払",
  SALARY: "給与",
  LOAN: "借入",
  TRANSFER: "振替",
}

const AMOUNT_TYPE_LABELS: Record<string, string> = {
  FIXED: "固定",
  VARIABLE: "変動",
  MANUAL: "手動",
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "振込",
  DIRECT_DEBIT: "引落",
  CASH_WITHDRAWAL: "現金",
}

const initialFormState = {
  name: "",
  frequency: "MONTHLY",
  specificMonths: [] as number[],
  dueDayRule: "DAY_25",
  holidayAdjust: "PREV_BUSINESS",
  transactionType: "EXPENSE" as string,
  accountId: "",
  partnerId: "",
  midId: "",
  subId: "",
  amountType: "FIXED",
  fixedAmount: "",
  paymentMethod: "",
  classification: "",
  summary: "",
}

export default function RecurringPage() {
  const { selectedCompany } = useCompany()
  const [templates, setTemplates] = useState<Template[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [categories, setCategories] = useState<MajorCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState(initialFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [generateMonth, setGenerateMonth] = useState(getCurrentMonth())
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState<{ templateName: string; transactionId: string }[] | null>(null)
  const [autoGenResult, setAutoGenResult] = useState<{ templateName: string; month: string }[] | null>(null)
  const [autoGenRan, setAutoGenRan] = useState(false)

  const allMidCategories = categories.flatMap((m) => m.midCategories)
  const selectedMid = allMidCategories.find((m) => m.id === form.midId)
  const subCategories = selectedMid?.subCategories.filter((s) => s.isActive) || []

  const loadMasterData = useCallback(async (companyId: string) => {
    const [accts, parts, cats] = await Promise.all([
      getAccounts(companyId),
      getPartners(companyId),
      getCategories(),
    ])
    setAccounts(accts.filter((a: { isActive: boolean }) => a.isActive).map((a: { id: string; bankName: string | null; branchName: string | null; accountNumber: string | null }) => ({
      id: a.id,
      bankName: a.bankName,
      branchName: a.branchName,
      accountNumber: a.accountNumber,
    })))
    setPartners(parts.filter((p: { isActive: boolean }) => p.isActive).map((p: { id: string; name: string }) => ({
      id: p.id,
      name: p.name,
    })))
    setCategories(cats as MajorCategory[])
  }, [])

  const loadTemplates = useCallback(async (companyId: string) => {
    setLoading(true)
    try {
      const data = await getRecurringTemplates(companyId)
      setTemplates(data as Template[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      loadMasterData(selectedCompany.id)
      loadTemplates(selectedCompany.id)
    }
  }, [selectedCompany, loadMasterData, loadTemplates])

  // ページ読み込み時に未生成月を自動生成
  useEffect(() => {
    if (!selectedCompany || autoGenRan) return
    setAutoGenRan(true)
    autoGenerateRecurringTransactions(selectedCompany.id).then((results) => {
      if (results.length > 0) {
        setAutoGenResult(results)
        loadTemplates(selectedCompany.id)
      }
    }).catch(console.error)
  }, [selectedCompany, autoGenRan, loadTemplates])

  const resetForm = () => {
    setForm(initialFormState)
    setEditingId(null)
    setDialogOpen(false)
  }

  const handleSubmit = async () => {
    if (!selectedCompany || !form.name || !form.frequency || !form.dueDayRule) return
    setSubmitting(true)
    try {
      if (editingId) {
        await updateRecurringTemplate(editingId, selectedCompany.id, {
          name: form.name,
          frequency: form.frequency,
          specificMonths: form.specificMonths,
          dueDayRule: form.dueDayRule,
          holidayAdjust: form.holidayAdjust,
          transactionType: form.transactionType as "EXPENSE" | "SALES" | "COST_PAYMENT" | "SALARY" | "LOAN" | "TRANSFER",
          accountId: form.accountId || null,
          partnerId: form.partnerId || null,
          midId: form.midId || null,
          subId: form.subId || null,
          amountType: form.amountType,
          fixedAmount: form.fixedAmount || null,
          paymentMethod: form.paymentMethod ? (form.paymentMethod as "BANK_TRANSFER" | "DIRECT_DEBIT" | "CASH_WITHDRAWAL") : null,
          classification: form.classification || null,
          summary: form.summary || null,
        })
      } else {
        await createRecurringTemplate({
          companyId: selectedCompany.id,
          name: form.name,
          frequency: form.frequency,
          specificMonths: form.specificMonths,
          dueDayRule: form.dueDayRule,
          holidayAdjust: form.holidayAdjust,
          transactionType: form.transactionType as "EXPENSE" | "SALES" | "COST_PAYMENT" | "SALARY" | "LOAN" | "TRANSFER",
          accountId: form.accountId || undefined,
          partnerId: form.partnerId || undefined,
          midId: form.midId || undefined,
          subId: form.subId || undefined,
          amountType: form.amountType,
          fixedAmount: form.fixedAmount || undefined,
          paymentMethod: form.paymentMethod ? (form.paymentMethod as "BANK_TRANSFER" | "DIRECT_DEBIT" | "CASH_WITHDRAWAL") : undefined,
          classification: form.classification || undefined,
          summary: form.summary || undefined,
        })
      }
      resetForm()
      // 新規作成後は自動生成を実行（当月まで埋める）
      if (!editingId) {
        const results = await autoGenerateRecurringTransactions(selectedCompany.id)
        if (results.length > 0) {
          setAutoGenResult(results)
        }
      }
      loadTemplates(selectedCompany.id)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (tmpl: Template) => {
    setForm({
      name: tmpl.name,
      frequency: tmpl.frequency,
      specificMonths: tmpl.specificMonths || [],
      dueDayRule: tmpl.dueDayRule,
      holidayAdjust: tmpl.holidayAdjust || "PREV_BUSINESS",
      transactionType: tmpl.transactionType,
      accountId: tmpl.accountId || "",
      partnerId: tmpl.partnerId || "",
      midId: tmpl.midId || "",
      subId: tmpl.subId || "",
      amountType: tmpl.amountType,
      fixedAmount: tmpl.fixedAmount || "",
      paymentMethod: tmpl.paymentMethod || "",
      classification: tmpl.classification || "",
      summary: tmpl.summary || "",
    })
    setEditingId(tmpl.id)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!selectedCompany || !confirm("このテンプレートを削除しますか？")) return
    await deleteRecurringTemplate(id, selectedCompany.id)
    loadTemplates(selectedCompany.id)
  }

  const handleToggleActive = async (tmpl: Template) => {
    if (!selectedCompany) return
    await updateRecurringTemplate(tmpl.id, selectedCompany.id, {
      isActive: !tmpl.isActive,
    })
    loadTemplates(selectedCompany.id)
  }

  const handleGenerate = async () => {
    if (!selectedCompany || !generateMonth) return
    setGenerating(true)
    try {
      const results = await generateRecurringTransactions(selectedCompany.id, generateMonth)
      setGenerateResult(results)
      loadTemplates(selectedCompany.id)
    } finally {
      setGenerating(false)
    }
  }

  const openNewForm = () => {
    setForm(initialFormState)
    setEditingId(null)
    setDialogOpen(true)
  }

  const handleMidChange = (midId: string) => {
    setForm((prev) => ({ ...prev, midId, subId: "" }))
  }

  const toggleSpecificMonth = (month: number) => {
    setForm((prev) => {
      const months = prev.specificMonths.includes(month)
        ? prev.specificMonths.filter((m) => m !== month)
        : [...prev.specificMonths, month].sort((a, b) => a - b)
      return { ...prev, specificMonths: months }
    })
  }

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">定期テンプレート</h1>
          <p className="text-muted-foreground">会社を選択してください</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">定期テンプレート</h1>
          <p className="text-muted-foreground">{selectedCompany.name} の定期取引テンプレートを管理します</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setGenerateResult(null); setGenerateDialogOpen(true) }}>
            月次一括生成
          </Button>
          <Button onClick={openNewForm}>新規テンプレート</Button>
        </div>
      </div>

      {autoGenResult && autoGenResult.length > 0 && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {autoGenResult.length}件の取引を自動生成しました
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {autoGenResult.map((r) => `${r.templateName}（${r.month}）`).join("、")}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setAutoGenResult(null)}>閉じる</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>月次一括生成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>対象月</Label>
              <Input type="month" value={generateMonth} onChange={(e) => setGenerateMonth(e.target.value)} />
            </div>
            {generateResult !== null && (
              <div className="space-y-2">
                {generateResult.length === 0 ? (
                  <p className="text-muted-foreground text-sm">対象のテンプレートがないか、既に生成済みです。</p>
                ) : (
                  <div>
                    <p className="text-sm font-medium mb-2">{generateResult.length}件の取引を生成しました</p>
                    <ul className="text-sm space-y-1">
                      {generateResult.map((r, i) => (
                        <li key={i} className="text-muted-foreground">・{r.templateName}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>閉じる</Button>
            <Button onClick={handleGenerate} disabled={generating || !generateMonth}>
              {generating ? "生成中..." : "生成実行"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "テンプレートを編集" : "新規テンプレート"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>テンプレート名 *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="例：電気代（東京電力）" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>頻度 *</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm((p) => ({ ...p, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>支払日ルール *</Label>
                <Select value={form.dueDayRule} onValueChange={(v) => setForm((p) => ({ ...p, dueDayRule: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTH_END">月末</SelectItem>
                    <SelectItem value="DAY_1">1日</SelectItem>
                    <SelectItem value="DAY_5">5日</SelectItem>
                    <SelectItem value="DAY_10">10日</SelectItem>
                    <SelectItem value="DAY_15">15日</SelectItem>
                    <SelectItem value="DAY_20">20日</SelectItem>
                    <SelectItem value="DAY_25">25日</SelectItem>
                    <SelectItem value="DAY_27">27日</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.frequency === "SPECIFIC_MONTHS" && (
              <div className="space-y-2">
                <Label>対象月</Label>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <Button
                      key={m}
                      type="button"
                      variant={form.specificMonths.includes(m) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleSpecificMonth(m)}
                    >
                      {m}月
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>取引種別 *</Label>
                <Select value={form.transactionType} onValueChange={(v) => setForm((p) => ({ ...p, transactionType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRANSACTION_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>支払方法</Label>
                <Select value={form.paymentMethod || "_none"} onValueChange={(v) => setForm((p) => ({ ...p, paymentMethod: v === "_none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="選択なし" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">選択なし</SelectItem>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>口座</Label>
                <Select value={form.accountId || "_none"} onValueChange={(v) => setForm((p) => ({ ...p, accountId: v === "_none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="選択なし" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">選択なし</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.bankName} {a.branchName} {a.accountNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>取引先</Label>
                <Select value={form.partnerId || "_none"} onValueChange={(v) => setForm((p) => ({ ...p, partnerId: v === "_none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="選択なし" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">選択なし</SelectItem>
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
                <Select value={form.midId || "_none"} onValueChange={(v) => handleMidChange(v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="選択なし" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">選択なし</SelectItem>
                    {allMidCategories.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>補助科目（小項目）</Label>
                <Select value={form.subId || "_none"} onValueChange={(v) => setForm((p) => ({ ...p, subId: v === "_none" ? "" : v }))} disabled={subCategories.length === 0}>
                  <SelectTrigger><SelectValue placeholder={subCategories.length === 0 ? "なし" : "選択なし"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">選択なし</SelectItem>
                    {subCategories.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>金額タイプ *</Label>
                <Select value={form.amountType} onValueChange={(v) => setForm((p) => ({ ...p, amountType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(AMOUNT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.amountType === "FIXED" && (
                <div className="space-y-2">
                  <Label>固定金額</Label>
                  <Input type="number" placeholder="0" value={form.fixedAmount} onChange={(e) => setForm((p) => ({ ...p, fixedAmount: e.target.value }))} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>摘要</Label>
              <Input value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} placeholder="メモ・摘要を入力" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>キャンセル</Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.name || !form.frequency || !form.dueDayRule}>
              {submitting ? "保存中..." : editingId ? "更新" : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>テンプレート一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">読み込み中...</p>
          ) : templates.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">テンプレートがありません</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>頻度</TableHead>
                  <TableHead>取引種別</TableHead>
                  <TableHead>金額タイプ</TableHead>
                  <TableHead className="text-right">固定金額</TableHead>
                  <TableHead>取引先</TableHead>
                  <TableHead>有効</TableHead>
                  <TableHead>最終生成月</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((tmpl) => {
                  const partner = partners.find((p) => p.id === tmpl.partnerId)
                  return (
                    <TableRow key={tmpl.id}>
                      <TableCell className="font-medium">{tmpl.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{FREQUENCY_LABELS[tmpl.frequency] || tmpl.frequency}</Badge>
                      </TableCell>
                      <TableCell>{TRANSACTION_TYPE_LABELS[tmpl.transactionType] || tmpl.transactionType}</TableCell>
                      <TableCell>{AMOUNT_TYPE_LABELS[tmpl.amountType] || tmpl.amountType}</TableCell>
                      <TableCell className="text-right font-mono">
                        {tmpl.fixedAmount ? formatYen(Number(tmpl.fixedAmount)) : "—"}
                      </TableCell>
                      <TableCell>{partner?.name || "—"}</TableCell>
                      <TableCell>
                        <Switch
                          checked={tmpl.isActive}
                          onCheckedChange={() => handleToggleActive(tmpl)}
                        />
                      </TableCell>
                      <TableCell>{tmpl.lastGeneratedMonth || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(tmpl)}>編集</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(tmpl.id)}>削除</Button>
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
    </div>
  )
}
