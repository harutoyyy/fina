"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatYen } from "@/lib/format"
import {
  upsertDeductionDetails,
  getDeductionDetailsForTransaction,
  copyPreviousDeductions,
} from "@/app/actions/transactions"
import { getDeductionCategories } from "@/app/actions/deduction-categories"

type DeductionCategory = {
  id: string
  forType: string
  name: string
  midId: string
  subId: string | null
  hasSubTypes: boolean
  signRule: unknown
  isActive: boolean
  displayOrder: number
}

type DeductionRow = {
  deductionCategoryId: string
  deductionSubType: string
  amount: string
  summary: string
}

type Props = {
  transactionId: string
  companyId: string
  forType: "SALES" | "COST"
  diffAmount: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

const emptyRow: DeductionRow = {
  deductionCategoryId: "",
  deductionSubType: "",
  amount: "0",
  summary: "",
}

export function DeductionDetailsPanel({
  transactionId,
  companyId,
  forType,
  diffAmount,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [categories, setCategories] = useState<DeductionCategory[]>([])
  const [rows, setRows] = useState<DeductionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoading(true)
      try {
        const [cats, existing] = await Promise.all([
          getDeductionCategories(forType),
          getDeductionDetailsForTransaction(transactionId),
        ])
        setCategories(cats as DeductionCategory[])
        if (existing.length > 0) {
          setRows(
            existing.map((d) => ({
              deductionCategoryId: d.deductionCategoryId,
              deductionSubType: d.deductionSubType || "",
              amount: d.amount,
              summary: d.summary || "",
            }))
          )
        } else {
          // PDF要件: 新規取引で控除内訳が無い場合は前月項目を自動プリロード（金額は0）
          try {
            const prev = await copyPreviousDeductions(transactionId, companyId)
            if (prev.found && prev.deductions.length > 0) {
              setRows(prev.deductions)
            } else {
              setRows([{ ...emptyRow }])
            }
          } catch {
            setRows([{ ...emptyRow }])
          }
        }
      } catch (e) {
        console.error("Failed to load deduction data:", e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, transactionId, forType, companyId])

  const updateRow = (index: number, field: keyof DeductionRow, value: string) => {
    setRows((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      if (field === "deductionCategoryId") {
        const cat = categories.find((c) => c.id === value)
        if (cat) {
          next[index].summary = cat.name
        }
      }
      return next
    })
  }

  const addRow = () => {
    setRows((prev) => [...prev, { ...emptyRow }])
  }

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCopyPrevious = async () => {
    try {
      const result = await copyPreviousDeductions(transactionId, companyId)
      if (!result.found) {
        alert("前月データなし")
        return
      }
      setRows(result.deductions)
    } catch (e) {
      console.error("Failed to copy previous deductions:", e)
      alert("前月データの取得に失敗しました")
    }
  }

  const totalDeduction = rows.reduce((sum, r) => sum + (parseInt(r.amount) || 0), 0)
  const isBalanced = totalDeduction === diffAmount

  const handleSave = async () => {
    setSaving(true)
    try {
      const validRows = rows.filter((r) => r.deductionCategoryId && parseInt(r.amount) > 0)
      await upsertDeductionDetails(transactionId, companyId, validRows)
      onOpenChange(false)
      onSaved?.()
    } catch (e) {
      console.error("Failed to save deduction details:", e)
      alert(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>控除内訳入力</DialogTitle>
          <DialogDescription>
            差額 {formatYen(diffAmount)} に対する控除内訳を入力してください
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground text-center py-8">読み込み中...</p>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">控除カテゴリ</TableHead>
                  <TableHead className="w-32">種別</TableHead>
                  <TableHead className="w-32">金額</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => {
                  const cat = categories.find((c) => c.id === row.deductionCategoryId)
                  return (
                    <TableRow key={i}>
                      <TableCell>
                        <Select
                          value={row.deductionCategoryId}
                          onValueChange={(v) => updateRow(i, "deductionCategoryId", v)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.filter((c) => c.isActive).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {cat?.hasSubTypes ? (
                          <Select
                            value={row.deductionSubType}
                            onValueChange={(v) => updateRow(i, "deductionSubType", v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="種別" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OCCURRENCE">発生</SelectItem>
                              <SelectItem value="OFFSET">相殺</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8"
                          value={row.amount}
                          onChange={(e) => updateRow(i, "amount", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8"
                          value={row.summary}
                          onChange={(e) => updateRow(i, "summary", e.target.value)}
                          placeholder="摘要"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-8"
                          onClick={() => removeRow(i)}
                        >
                          ×
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addRow}>
                  行を追加
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopyPrevious}>
                  前月からコピー
                </Button>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">差額:</Label>
                  <span className="ml-2 font-mono">{formatYen(diffAmount)}</span>
                </div>
                <div>
                  <Label className="text-muted-foreground">控除合計:</Label>
                  <span className={`ml-2 font-mono ${isBalanced ? "text-green-600" : "text-orange-600"}`}>
                    {formatYen(totalDeduction)}
                  </span>
                </div>
                {!isBalanced && (
                  <span className="text-orange-600 text-xs">
                    差額と控除合計が一致していません
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
