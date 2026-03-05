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
import { getLeases, createLease, updateLease, deleteLease, markLeaseSchedulePaid, regenerateLeaseSchedule } from "@/app/actions/leases"
import { getAccounts } from "@/app/actions/accounts"
import { getPartners } from "@/app/actions/partners"
import { getCategories } from "@/app/actions/categories"
import { formatYen, formatDate } from "@/lib/format"

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

type LeaseScheduleItem = {
  id: string
  paymentNumber: number
  dueDate: string
  amount: string
  isPaid: boolean
  transactionId: string | null
}

type LeaseItem = {
  id: string
  companyId: string
  partnerId: string | null
  contractName: string
  monthlyAmount: string
  startDate: string
  endDate: string | null
  totalPayments: number | null
  paymentDay: number | null
  holidayAdjust: string
  principalAdjust: string
  accountId: string | null
  midId: string | null
  subId: string | null
  status: string
  createdAt: string
  schedules: LeaseScheduleItem[]
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "有効",
  COMPLETED: "完了",
  CANCELLED: "解約",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
}

const initialFormState = {
  contractName: "",
  partnerId: "",
  monthlyAmount: "",
  startDate: "",
  endDate: "",
  totalPayments: "",
  paymentDay: "",
  accountId: "",
  midId: "",
  subId: "",
}

export default function LeasesPage() {
  const { selectedCompany } = useCompany()
  const [leases, setLeases] = useState<LeaseItem[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [categories, setCategories] = useState<MajorCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState(initialFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailLease, setDetailLease] = useState<LeaseItem | null>(null)

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
    })))
    setCategories(cats as MajorCategory[])
  }, [])

  const loadLeases = useCallback(async (companyId: string) => {
    setLoading(true)
    try {
      const data = await getLeases(companyId)
      setLeases(data as LeaseItem[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      loadMasterData(selectedCompany.id)
      loadLeases(selectedCompany.id)
    }
  }, [selectedCompany, loadMasterData, loadLeases])

  const resetForm = () => {
    setForm(initialFormState)
    setEditingId(null)
    setDialogOpen(false)
  }

  const openNewForm = () => {
    setForm(initialFormState)
    setEditingId(null)
    setDialogOpen(true)
  }

  const handleEdit = (lease: LeaseItem) => {
    setForm({
      contractName: lease.contractName,
      partnerId: lease.partnerId || "",
      monthlyAmount: lease.monthlyAmount,
      startDate: lease.startDate ? lease.startDate.split("T")[0] : "",
      endDate: lease.endDate ? lease.endDate.split("T")[0] : "",
      totalPayments: lease.totalPayments?.toString() || "",
      paymentDay: lease.paymentDay?.toString() || "",
      accountId: lease.accountId || "",
      midId: lease.midId || "",
      subId: lease.subId || "",
    })
    setEditingId(lease.id)
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!selectedCompany || !form.contractName || !form.monthlyAmount || !form.startDate) return
    setSubmitting(true)
    try {
      if (editingId) {
        await updateLease(editingId, selectedCompany.id, {
          contractName: form.contractName,
          partnerId: form.partnerId || null,
          monthlyAmount: form.monthlyAmount,
          startDate: form.startDate,
          endDate: form.endDate || null,
          totalPayments: form.totalPayments ? parseInt(form.totalPayments) : null,
          paymentDay: form.paymentDay ? parseInt(form.paymentDay) : null,
          accountId: form.accountId || null,
          midId: form.midId || null,
          subId: form.subId || null,
        })
      } else {
        await createLease({
          companyId: selectedCompany.id,
          contractName: form.contractName,
          partnerId: form.partnerId || undefined,
          monthlyAmount: form.monthlyAmount,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
          totalPayments: form.totalPayments ? parseInt(form.totalPayments) : undefined,
          paymentDay: form.paymentDay ? parseInt(form.paymentDay) : undefined,
          accountId: form.accountId || undefined,
          midId: form.midId || undefined,
          subId: form.subId || undefined,
        })
      }
      resetForm()
      loadLeases(selectedCompany.id)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!selectedCompany || !confirm("このリース契約を削除しますか？")) return
    await deleteLease(id, selectedCompany.id)
    if (detailLease?.id === id) setDetailLease(null)
    loadLeases(selectedCompany.id)
  }

  const handleMarkPaid = async (scheduleId: string) => {
    if (!selectedCompany) return
    await markLeaseSchedulePaid(scheduleId, selectedCompany.id)
    loadLeases(selectedCompany.id)
    if (detailLease) {
      const updated = await getLeases(selectedCompany.id) as LeaseItem[]
      const found = updated.find((l) => l.id === detailLease.id)
      if (found) setDetailLease(found)
    }
  }

  const handleViewDetail = (lease: LeaseItem) => {
    setDetailLease(detailLease?.id === lease.id ? null : lease)
  }

  const getPartnerName = (partnerId: string | null) => {
    if (!partnerId) return "—"
    return partners.find((p) => p.id === partnerId)?.name || "—"
  }

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">リース管理</h1>
          <p className="text-muted-foreground">会社を選択してください</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">リース管理</h1>
          <p className="text-muted-foreground">{selectedCompany.name} のリース契約を管理します</p>
        </div>
        <Button onClick={openNewForm}>新規契約</Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "リース契約を編集" : "新規リース契約"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>契約名 *</Label>
                <Input value={form.contractName} onChange={(e) => setForm((p) => ({ ...p, contractName: e.target.value }))} placeholder="契約名を入力" />
              </div>
              <div className="space-y-2">
                <Label>相手先</Label>
                <Select value={form.partnerId} onValueChange={(v) => setForm((p) => ({ ...p, partnerId: v }))}>
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
                <Label>月額 *</Label>
                <Input type="number" placeholder="0" value={form.monthlyAmount} onChange={(e) => setForm((p) => ({ ...p, monthlyAmount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>開始日 *</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>終了日</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>回数</Label>
                <Input type="number" placeholder="例: 60" value={form.totalPayments} onChange={(e) => setForm((p) => ({ ...p, totalPayments: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>支払日</Label>
                <Input type="number" placeholder="例: 27" min="1" max="31" value={form.paymentDay} onChange={(e) => setForm((p) => ({ ...p, paymentDay: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>引落口座</Label>
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>勘定科目（中項目）</Label>
                <Select value={form.midId} onValueChange={(v) => setForm((p) => ({ ...p, midId: v, subId: "" }))}>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>キャンセル</Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.contractName || !form.monthlyAmount || !form.startDate}>
              {submitting ? "保存中..." : editingId ? "更新" : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>リース契約一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">読み込み中...</p>
          ) : leases.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">リース契約がありません</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>契約名</TableHead>
                  <TableHead>相手先</TableHead>
                  <TableHead className="text-right">月額</TableHead>
                  <TableHead>開始日</TableHead>
                  <TableHead>終了日</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leases.map((lease) => (
                  <TableRow key={lease.id} className={detailLease?.id === lease.id ? "bg-muted/50" : ""}>
                    <TableCell className="font-medium">{lease.contractName}</TableCell>
                    <TableCell>{getPartnerName(lease.partnerId)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(Number(lease.monthlyAmount))}</TableCell>
                    <TableCell>{formatDate(lease.startDate)}</TableCell>
                    <TableCell>{lease.endDate ? formatDate(lease.endDate) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[lease.status] || "outline"}>
                        {STATUS_LABELS[lease.status] || lease.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetail(lease)}>
                          {detailLease?.id === lease.id ? "閉じる" : "詳細"}
                        </Button>
                        {lease.status === "ACTIVE" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(lease)}>編集</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(lease.id)}>削除</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {detailLease && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{detailLease.contractName} — 支払スケジュール</CardTitle>
              {detailLease.status === "ACTIVE" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!selectedCompany || !confirm("未払いスケジュールを再生成しますか？")) return
                    await regenerateLeaseSchedule(detailLease.id, selectedCompany.id)
                    await loadLeases(selectedCompany.id)
                    const updated = leases.find(l => l.id === detailLease.id)
                    if (updated) setDetailLease(updated)
                  }}
                >
                  スケジュール再生成
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {detailLease.schedules.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">スケジュールがありません</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">回数</TableHead>
                    <TableHead>期日</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead>支払済み</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailLease.schedules.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.paymentNumber}</TableCell>
                      <TableCell>{formatDate(s.dueDate)}</TableCell>
                      <TableCell className="text-right font-mono">{formatYen(Number(s.amount))}</TableCell>
                      <TableCell>
                        <Badge variant={s.isPaid ? "default" : "outline"}>
                          {s.isPaid ? "済" : "未"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!s.isPaid && (
                          <Button variant="ghost" size="sm" onClick={() => handleMarkPaid(s.id)}>
                            支払済みにする
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
