"use client"

import { useState, useEffect, useCallback } from "react"
import { useCompany } from "@/contexts/company-context"
import { CompanySwitcher } from "@/components/company-switcher"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, Calculator } from "lucide-react"
import { formatYen, formatDate, parseYen } from "@/lib/format"
import {
  getTaxSchedules,
  createTaxSchedule,
  updateTaxSchedule,
  deleteTaxSchedule,
  generateInterimTaxSchedules,
  TAX_TYPE_LABELS,
  type TaxType,
} from "@/app/actions/tax-schedule"

type ScheduleRow = Awaited<ReturnType<typeof getTaxSchedules>>[number]

const TAX_TYPES: TaxType[] = [
  "CORPORATE",
  "CONSUMPTION",
  "RESIDENT",
  "BUSINESS",
  "FIXED_ASSET",
  "OTHER",
]

const PERIOD_OPTIONS = ["確定", "中間", "中間1", "中間2", "中間3", "中間4", "予定"]

const initialForm = {
  taxType: "CORPORATE" as TaxType,
  fiscalYear: new Date().getFullYear(),
  periodLabel: "確定",
  dueDate: "",
  scheduledAmount: "",
  basisAmount: "",
  isPaid: false,
  paidDate: "",
  actualAmount: "",
  notes: "",
}

export default function TaxSchedulePage() {
  const { selectedCompany } = useCompany()
  const [items, setItems] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear())
  const [taxTypeFilter, setTaxTypeFilter] = useState<TaxType | "ALL">("ALL")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduleRow | null>(null)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)

  const [interimOpen, setInterimOpen] = useState(false)
  const [interimForm, setInterimForm] = useState({
    taxType: "CORPORATE" as "CORPORATE" | "CONSUMPTION",
    fiscalYear: new Date().getFullYear(),
    prevYearTaxAmount: "",
  })
  const [interimPreview, setInterimPreview] = useState<{
    ruleLabel: string
    rows: Array<{
      periodLabel: string
      dueDate: string
      scheduledAmount: string
      basisAmount: string
      calculationMethod: string
    }>
  } | null>(null)
  const [interimSaving, setInterimSaving] = useState(false)

  const load = useCallback(async () => {
    if (!selectedCompany) return
    setLoading(true)
    try {
      const data = await getTaxSchedules({
        companyId: selectedCompany.id,
        fiscalYear,
        taxType: taxTypeFilter === "ALL" ? undefined : taxTypeFilter,
      })
      setItems(data)
    } finally {
      setLoading(false)
    }
  }, [selectedCompany, fiscalYear, taxTypeFilter])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...initialForm, fiscalYear })
    setDialogOpen(true)
  }

  const openEdit = (row: ScheduleRow) => {
    setEditing(row)
    setForm({
      taxType: row.taxType,
      fiscalYear: row.fiscalYear,
      periodLabel: row.periodLabel,
      dueDate: row.dueDate.slice(0, 10),
      scheduledAmount: row.scheduledAmount,
      basisAmount: row.basisAmount ?? "",
      isPaid: row.isPaid,
      paidDate: row.paidDate?.slice(0, 10) ?? "",
      actualAmount: row.actualAmount ?? "",
      notes: row.notes ?? "",
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!selectedCompany) return
    if (!form.dueDate) {
      alert("納付期限は必須です")
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateTaxSchedule(editing.id, {
          periodLabel: form.periodLabel,
          dueDate: form.dueDate,
          scheduledAmount: parseYen(form.scheduledAmount).toString(),
          basisAmount: form.basisAmount ? parseYen(form.basisAmount).toString() : null,
          isPaid: form.isPaid,
          paidDate: form.isPaid ? (form.paidDate || null) : null,
          actualAmount: form.actualAmount ? parseYen(form.actualAmount).toString() : null,
          notes: form.notes || null,
        })
      } else {
        await createTaxSchedule({
          companyId: selectedCompany.id,
          taxType: form.taxType,
          fiscalYear: form.fiscalYear,
          periodLabel: form.periodLabel,
          dueDate: form.dueDate,
          scheduledAmount: parseYen(form.scheduledAmount).toString(),
          basisAmount: form.basisAmount ? parseYen(form.basisAmount).toString() : undefined,
          notes: form.notes || undefined,
        })
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: ScheduleRow) => {
    if (!confirm(`${TAX_TYPE_LABELS[row.taxType]} ${row.periodLabel}（${formatDate(row.dueDate)}）を削除しますか？`)) return
    try {
      await deleteTaxSchedule(row.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました")
    }
  }

  const handleInterimPreview = async () => {
    if (!selectedCompany) return
    if (!interimForm.prevYearTaxAmount) {
      alert("前年確定税額を入力してください")
      return
    }
    try {
      const res = await generateInterimTaxSchedules({
        companyId: selectedCompany.id,
        fiscalYear: interimForm.fiscalYear,
        taxType: interimForm.taxType,
        prevYearTaxAmount: parseYen(interimForm.prevYearTaxAmount).toString(),
        dryRun: true,
      })
      setInterimPreview(res)
    } catch (e) {
      alert(e instanceof Error ? e.message : "プレビューに失敗しました")
    }
  }

  const handleInterimApply = async () => {
    if (!selectedCompany || !interimPreview) return
    setInterimSaving(true)
    try {
      await generateInterimTaxSchedules({
        companyId: selectedCompany.id,
        fiscalYear: interimForm.fiscalYear,
        taxType: interimForm.taxType,
        prevYearTaxAmount: parseYen(interimForm.prevYearTaxAmount).toString(),
      })
      setInterimOpen(false)
      setInterimPreview(null)
      setInterimForm({
        taxType: "CORPORATE",
        fiscalYear,
        prevYearTaxAmount: "",
      })
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "適用に失敗しました")
    } finally {
      setInterimSaving(false)
    }
  }

  const totalScheduled = items.reduce((sum, r) => sum + BigInt(r.scheduledAmount), BigInt(0))
  const totalUnpaid = items
    .filter((r) => !r.isPaid)
    .reduce((sum, r) => sum + BigInt(r.scheduledAmount), BigInt(0))

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">会社を選択してください</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">納税予定表</h1>
          <p className="text-muted-foreground">
            法人税・消費税・住民税等の予定額と納付状況を管理します（PDF P9）
          </p>
        </div>
        <CompanySwitcher />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setInterimOpen(true)}>
            <Calculator className="h-4 w-4 mr-1" />
            中間納税を自動生成
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            新規追加
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle>納税一覧</CardTitle>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">事業年度</Label>
              <Input
                type="number"
                value={fiscalYear}
                className="w-24"
                onChange={(e) => setFiscalYear(parseInt(e.target.value) || new Date().getFullYear())}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">税目</Label>
              <Select
                value={taxTypeFilter}
                onValueChange={(v) => setTaxTypeFilter(v as TaxType | "ALL")}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  {TAX_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TAX_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">予定額合計</div>
              <div className="text-lg font-semibold mt-1">{formatYen(totalScheduled)}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">未納額合計</div>
              <div className="text-lg font-semibold mt-1 text-orange-600">
                {formatYen(totalUnpaid)}
              </div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">件数</div>
              <div className="text-lg font-semibold mt-1">{items.length}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">未納件数</div>
              <div className="text-lg font-semibold mt-1">
                {items.filter((r) => !r.isPaid).length}
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-center py-8">読み込み中...</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              納税予定が未登録です。「新規追加」または「中間納税を自動生成」から作成してください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>納付期限</TableHead>
                  <TableHead>税目</TableHead>
                  <TableHead>事業年度</TableHead>
                  <TableHead>区分</TableHead>
                  <TableHead className="text-right">予定額</TableHead>
                  <TableHead className="text-right">実納付額</TableHead>
                  <TableHead className="w-24">状態</TableHead>
                  <TableHead>備考</TableHead>
                  <TableHead className="text-right w-28">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{formatDate(row.dueDate)}</TableCell>
                    <TableCell>{TAX_TYPE_LABELS[row.taxType]}</TableCell>
                    <TableCell>{row.fiscalYear}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.periodLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatYen(BigInt(row.scheduledAmount))}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.actualAmount ? formatYen(BigInt(row.actualAmount)) : "—"}
                    </TableCell>
                    <TableCell>
                      {row.isPaid ? (
                        <Badge variant="secondary">納付済</Badge>
                      ) : (
                        <Badge variant="default">未納</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {row.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(row)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新規/編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "納税予定を編集" : "納税予定を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>税目</Label>
                <Select
                  value={form.taxType}
                  onValueChange={(v) => setForm((p) => ({ ...p, taxType: v as TaxType }))}
                  disabled={!!editing}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TAX_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TAX_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>事業年度</Label>
                <Input
                  type="number"
                  value={form.fiscalYear}
                  onChange={(e) => setForm((p) => ({ ...p, fiscalYear: parseInt(e.target.value) || fiscalYear }))}
                  disabled={!!editing}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>区分</Label>
                <Select
                  value={form.periodLabel}
                  onValueChange={(v) => setForm((p) => ({ ...p, periodLabel: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>納付期限</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>予定額</Label>
                <Input
                  inputMode="numeric"
                  value={form.scheduledAmount}
                  placeholder="0"
                  onChange={(e) => setForm((p) => ({ ...p, scheduledAmount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>算定基礎額（前年税額等）</Label>
                <Input
                  inputMode="numeric"
                  value={form.basisAmount}
                  placeholder="任意"
                  onChange={(e) => setForm((p) => ({ ...p, basisAmount: e.target.value }))}
                />
              </div>
            </div>
            {editing && (
              <>
                <div className="flex items-center justify-between border-t pt-3">
                  <Label>納付済</Label>
                  <input
                    type="checkbox"
                    checked={form.isPaid}
                    onChange={(e) => setForm((p) => ({ ...p, isPaid: e.target.checked }))}
                    className="w-4 h-4"
                  />
                </div>
                {form.isPaid && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>納付日</Label>
                      <Input
                        type="date"
                        value={form.paidDate}
                        onChange={(e) => setForm((p) => ({ ...p, paidDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>実納付額</Label>
                      <Input
                        inputMode="numeric"
                        value={form.actualAmount}
                        onChange={(e) => setForm((p) => ({ ...p, actualAmount: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label>備考</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 中間納税自動生成ダイアログ */}
      <Dialog
        open={interimOpen}
        onOpenChange={(o) => {
          setInterimOpen(o)
          if (!o) setInterimPreview(null)
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>中間納税を自動生成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              前年確定税額から閾値（法人税: 20万円 / 消費税: 48万円・400万円・4800万円）に基づき
              中間納税スケジュールを生成します。同年度の未納分は再生成されます。
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>税目</Label>
                <Select
                  value={interimForm.taxType}
                  onValueChange={(v) =>
                    setInterimForm((p) => ({ ...p, taxType: v as "CORPORATE" | "CONSUMPTION" }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CORPORATE">法人税</SelectItem>
                    <SelectItem value="CONSUMPTION">消費税</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>事業年度</Label>
                <Input
                  type="number"
                  value={interimForm.fiscalYear}
                  onChange={(e) =>
                    setInterimForm((p) => ({
                      ...p,
                      fiscalYear: parseInt(e.target.value) || fiscalYear,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>前年確定税額</Label>
                <Input
                  inputMode="numeric"
                  value={interimForm.prevYearTaxAmount}
                  placeholder="例: 500000"
                  onChange={(e) =>
                    setInterimForm((p) => ({ ...p, prevYearTaxAmount: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button variant="outline" onClick={handleInterimPreview}>プレビュー</Button>

            {interimPreview && (
              <div className="border rounded p-3 bg-muted/30">
                <div className="text-sm font-semibold mb-2">
                  判定: {interimPreview.ruleLabel}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>区分</TableHead>
                      <TableHead>納付期限</TableHead>
                      <TableHead className="text-right">予定額</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interimPreview.rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.periodLabel}</TableCell>
                        <TableCell className="font-mono text-sm">{formatDate(r.dueDate)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatYen(BigInt(r.scheduledAmount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterimOpen(false)}>キャンセル</Button>
            <Button
              onClick={handleInterimApply}
              disabled={!interimPreview || interimSaving}
            >
              {interimSaving ? "適用中..." : "この内容で生成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
