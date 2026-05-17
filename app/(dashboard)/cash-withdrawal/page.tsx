"use client"

import { useState, useEffect, useCallback } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { getAccounts } from "@/app/actions/accounts"
import {
  getCashWithdrawalBatches,
  createCashWithdrawalBatch,
  linkTransactionToBatch,
  unlinkTransactionFromBatch,
  getUnlinkedCashTransactions,
  upsertDenomination,
  suggestDenomination,
  confirmCashWithdrawalBatch,
  deleteCashWithdrawalBatch,
} from "@/app/actions/cash-withdrawal"
import { formatYen, getCurrentMonth } from "@/lib/format"
import { Loader2, Plus, Trash2, Banknote, Check } from "lucide-react"

type AccountOption = {
  id: string
  bankName: string | null
  branchName: string | null
  accountNumber: string | null
  label: string
}

const DENOM_LABELS: { key: string; value: number; label: string }[] = [
  { key: "yen10000", value: 10000, label: "1万円" },
  { key: "yen5000", value: 5000, label: "5千円" },
  { key: "yen2000", value: 2000, label: "2千円" },
  { key: "yen1000", value: 1000, label: "1千円" },
  { key: "yen500", value: 500, label: "500円" },
  { key: "yen100", value: 100, label: "100円" },
  { key: "yen50", value: 50, label: "50円" },
  { key: "yen10", value: 10, label: "10円" },
  { key: "yen5", value: 5, label: "5円" },
  { key: "yen1", value: 1, label: "1円" },
]

type DenomState = Record<string, number>

const emptyDenom: DenomState = {
  yen10000: 0, yen5000: 0, yen2000: 0, yen1000: 0,
  yen500: 0, yen100: 0, yen50: 0, yen10: 0, yen5: 0, yen1: 0,
}

export default function CashWithdrawalPage() {
  const { selectedCompany } = useCompany()
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [batches, setBatches] = useState<Awaited<ReturnType<typeof getCashWithdrawalBatches>>>([])
  const [unlinked, setUnlinked] = useState<Awaited<ReturnType<typeof getUnlinkedCashTransactions>>>([])
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(getCurrentMonth())

  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [newForm, setNewForm] = useState({ accountId: "", withdrawalDate: "", totalAmount: "" })

  const [denomDialogBatchId, setDenomDialogBatchId] = useState<string | null>(null)
  const [denomForm, setDenomForm] = useState<DenomState>(emptyDenom)
  const [denomSaving, setDenomSaving] = useState(false)

  const [linkDialogBatchId, setLinkDialogBatchId] = useState<string | null>(null)
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set())

  const [error, setError] = useState("")

  const loadData = useCallback(async () => {
    if (!selectedCompany) return
    setLoading(true)
    const [accts, batchData, unlinkedData] = await Promise.all([
      getAccounts(selectedCompany.id),
      getCashWithdrawalBatches(selectedCompany.id, month),
      getUnlinkedCashTransactions(selectedCompany.id, month),
    ])
    setAccounts(accts.filter((a) => a.isActive).map((a) => ({
      id: a.id,
      bankName: a.bankName,
      branchName: a.branchName,
      accountNumber: a.accountNumber,
      label: `${a.bankName || ""} ${a.branchName || ""} ${a.accountNumber || ""}`.trim(),
    })))
    setBatches(batchData)
    setUnlinked(unlinkedData)
    setLoading(false)
  }, [selectedCompany, month])

  useEffect(() => { loadData() }, [loadData])

  const handleCreateBatch = async () => {
    if (!selectedCompany || !newForm.accountId || !newForm.withdrawalDate || !newForm.totalAmount) return
    setError("")
    try {
      await createCashWithdrawalBatch({
        companyId: selectedCompany.id,
        accountId: newForm.accountId,
        withdrawalDate: newForm.withdrawalDate,
        totalAmount: parseInt(newForm.totalAmount),
      })
      setNewDialogOpen(false)
      setNewForm({ accountId: "", withdrawalDate: "", totalAmount: "" })
      loadData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました")
    }
  }

  const handleUnlink = async (txId: string) => {
    await unlinkTransactionFromBatch(txId)
    loadData()
  }

  const handleOpenLinkDialog = (batchId: string) => {
    setLinkDialogBatchId(batchId)
    setSelectedTxIds(new Set())
  }

  const handleLinkSelected = async () => {
    if (!linkDialogBatchId) return
    for (const txId of selectedTxIds) {
      await linkTransactionToBatch(linkDialogBatchId, txId)
    }
    setLinkDialogBatchId(null)
    setSelectedTxIds(new Set())
    loadData()
  }

  const handleOpenDenom = async (batchId: string) => {
    const batch = batches.find((b) => b.id === batchId)
    if (!batch) return
    if (batch.denominations.length > 0) {
      const d = batch.denominations[0]
      setDenomForm({
        yen10000: d.yen10000, yen5000: d.yen5000, yen2000: d.yen2000, yen1000: d.yen1000,
        yen500: d.yen500, yen100: d.yen100, yen50: d.yen50, yen10: d.yen10,
        yen5: d.yen5, yen1: d.yen1,
      })
    } else {
      const suggested = await suggestDenomination(Number(batch.totalAmount))
      setDenomForm(suggested)
    }
    setDenomDialogBatchId(batchId)
  }

  const handleSaveDenom = async () => {
    if (!denomDialogBatchId) return
    setDenomSaving(true)
    await upsertDenomination(denomDialogBatchId, denomForm as {
      yen10000: number; yen5000: number; yen2000: number; yen1000: number
      yen500: number; yen100: number; yen50: number; yen10: number
      yen5: number; yen1: number
    })
    setDenomSaving(false)
    setDenomDialogBatchId(null)
    loadData()
  }

  const handleConfirmBatch = async (batchId: string) => {
    setError("")
    try {
      await confirmCashWithdrawalBatch(batchId)
      loadData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "確定エラー")
    }
  }

  const handleDeleteBatch = async (batchId: string) => {
    setError("")
    try {
      await deleteCashWithdrawalBatch(batchId)
      loadData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "削除エラー")
    }
  }

  const denomTotal = DENOM_LABELS.reduce(
    (sum, d) => sum + (denomForm[d.key] || 0) * d.value,
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">現金引出バッチ</h1>
          <p className="text-muted-foreground">現金引出と金種表を管理します</p>
        </div>
        <CompanySwitcher />
        <div className="flex items-center gap-3">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40"
          />
          <Button onClick={() => setNewDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新規バッチ
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : batches.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            バッチがありません
          </CardContent>
        </Card>
      ) : (
        batches.map((batch) => {
          const acct = accounts.find((a) => a.id === batch.accountId)
          const childTotal = batch.linkedTransactions.reduce((s, tx) => s + Number(tx.amount), 0)
          const isConfirmed = batch.status === "CONFIRMED"
          return (
            <Card key={batch.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    {new Date(batch.withdrawalDate).toLocaleDateString("ja-JP")} — {acct?.label || "不明口座"}
                    <Badge variant={isConfirmed ? "default" : "outline"}>
                      {isConfirmed ? "確定済" : "下書き"}
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{formatYen(Number(batch.totalAmount))}</span>
                    {!isConfirmed && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleOpenLinkDialog(batch.id)}>
                          明細追加
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleOpenDenom(batch.id)}>
                          金種表
                        </Button>
                        <Button variant="default" size="sm" onClick={() => handleConfirmBatch(batch.id)}>
                          <Check className="mr-1 h-4 w-4" />確定
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteBatch(batch.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {batch.linkedTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">用途明細なし</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日付</TableHead>
                        <TableHead>取引先</TableHead>
                        <TableHead>摘要</TableHead>
                        <TableHead className="text-right">金額</TableHead>
                        {!isConfirmed && <TableHead></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batch.linkedTransactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>{tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString("ja-JP") : "—"}</TableCell>
                          <TableCell>{tx.partner?.name || "—"}</TableCell>
                          <TableCell>{tx.summary || "—"}</TableCell>
                          <TableCell className="text-right font-mono">{formatYen(Number(tx.amount))}</TableCell>
                          {!isConfirmed && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => handleUnlink(tx.id)}>解除</Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <div className="mt-2 text-sm text-muted-foreground flex justify-between">
                  <span>用途明細合計: {formatYen(childTotal)}</span>
                  {childTotal !== Number(batch.totalAmount) && (
                    <span className="text-destructive font-medium">
                      差額: {formatYen(Number(batch.totalAmount) - childTotal)}
                    </span>
                  )}
                </div>
                {batch.denominations.length > 0 && (
                  <div className="mt-3 p-3 bg-muted/30 rounded text-sm">
                    <p className="font-medium mb-1">金種表</p>
                    <div className="grid grid-cols-5 gap-2">
                      {DENOM_LABELS.map((d) => {
                        const count = (batch.denominations[0] as Record<string, unknown>)[d.key] as number
                        if (!count) return null
                        return (
                          <span key={d.key}>{d.label}: {count}枚</span>
                        )
                      })}
                    </div>
                    <p className="mt-1">合計: {formatYen(Number(batch.denominations[0].total))}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}

      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規現金引出バッチ</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>引出口座</Label>
              <Select value={newForm.accountId} onValueChange={(v) => setNewForm({ ...newForm, accountId: v })}>
                <SelectTrigger><SelectValue placeholder="口座を選択" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>引出日</Label>
              <Input type="date" value={newForm.withdrawalDate} onChange={(e) => setNewForm({ ...newForm, withdrawalDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>引出金額</Label>
              <Input type="number" value={newForm.totalAmount} onChange={(e) => setNewForm({ ...newForm, totalAmount: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleCreateBatch}>作成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkDialogBatchId} onOpenChange={(open) => { if (!open) setLinkDialogBatchId(null) }}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>用途明細を追加</DialogTitle>
          </DialogHeader>
          {unlinked.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">未割当の現金取引がありません</p>
          ) : (
            <div className="space-y-2">
              {unlinked.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 p-2 border rounded">
                  <Checkbox
                    checked={selectedTxIds.has(tx.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedTxIds)
                      if (checked) next.add(tx.id); else next.delete(tx.id)
                      setSelectedTxIds(next)
                    }}
                  />
                  <div className="flex-1">
                    <span className="text-sm">{tx.partner?.name || "不明"}</span>
                    <span className="text-sm text-muted-foreground ml-2">{tx.summary || ""}</span>
                  </div>
                  <span className="text-sm font-mono">{formatYen(Number(tx.amount))}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogBatchId(null)}>キャンセル</Button>
            <Button onClick={handleLinkSelected} disabled={selectedTxIds.size === 0}>追加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!denomDialogBatchId} onOpenChange={(open) => { if (!open) setDenomDialogBatchId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>金種表</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {DENOM_LABELS.map((d) => (
              <div key={d.key} className="flex items-center gap-3">
                <Label className="w-16 text-right">{d.label}</Label>
                <Input
                  type="number"
                  min={0}
                  className="w-24"
                  value={denomForm[d.key] || 0}
                  onChange={(e) => setDenomForm({ ...denomForm, [d.key]: parseInt(e.target.value) || 0 })}
                />
                <span className="text-sm text-muted-foreground w-24 text-right">
                  {formatYen((denomForm[d.key] || 0) * d.value)}
                </span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-medium">
              <span>合計</span>
              <span>{formatYen(denomTotal)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenomDialogBatchId(null)}>キャンセル</Button>
            <Button onClick={handleSaveDenom} disabled={denomSaving}>
              {denomSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
