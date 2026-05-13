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
import { getPartners } from "@/app/actions/partners"
import {
  getLoans,
  getLoan,
  createLoan,
  deleteLoan,
  markLoanSchedulePaid,
} from "@/app/actions/loans"
import { formatYen, formatDate } from "@/lib/format"

type PartnerOption = {
  id: string
  name: string
}

type LoanItem = {
  id: string
  contractName: string
  partnerId: string | null
  principalAmount: string
  executionDate: string
  repaymentMethod: string
  interestRate: string
  interestType: string
  status: string
  _count: { schedules: number }
}

type ScheduleItem = {
  id: string
  paymentNumber: number
  dueDate: string
  principalAmount: string
  interestAmount: string
  totalAmount: string
  remainingBalance: string
  isPaid: boolean
  transactionId: string | null
}

type LoanDetail = {
  id: string
  contractName: string
  partnerId: string | null
  principalAmount: string
  executionDate: string
  repaymentStartDate: string
  repaymentMethod: string
  repaymentFrequency: string
  repaymentDay: number | null
  totalPayments: number | null
  interestType: string
  interestRate: string
  remainingBalance: string
  status: string
  schedules: ScheduleItem[]
}

const REPAYMENT_METHOD_LABELS: Record<string, string> = {
  EQUAL_PRINCIPAL: "元金均等",
  BULLET: "一括返済",
  GRACE: "据置",
}

const REPAYMENT_FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "月次",
  QUARTERLY: "四半期",
  SEMIANNUAL: "半年",
  ANNUAL: "年次",
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "返済中",
  COMPLETED: "完済",
  CANCELLED: "取消",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
}

const initialFormState = {
  contractName: "",
  partnerId: "",
  principalAmount: "",
  executionDate: "",
  repaymentStartDate: "",
  repaymentMethod: "EQUAL_PRINCIPAL",
  repaymentFrequency: "MONTHLY",
  repaymentDay: "",
  totalPayments: "",
  interestType: "FIXED",
  interestRate: "",
}

export default function LoansPage() {
  const { selectedCompany } = useCompany()
  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [loans, setLoans] = useState<LoanItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState(initialFormState)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [selectedLoan, setSelectedLoan] = useState<LoanDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadPartners = useCallback(async (companyId: string) => {
    const parts = await getPartners(companyId)
    setPartners(
      parts.filter((p) => p.isActive).map((p) => ({ id: p.id, name: p.name }))
    )
  }, [])

  const loadLoans = useCallback(async (companyId: string) => {
    setLoading(true)
    try {
      const data = await getLoans(companyId)
      setLoans(data as LoanItem[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      loadPartners(selectedCompany.id)
      loadLoans(selectedCompany.id)
    }
  }, [selectedCompany, loadPartners, loadLoans])

  const resetForm = () => {
    setForm(initialFormState)
    setDialogOpen(false)
  }

  const handleSubmit = async () => {
    if (
      !selectedCompany ||
      !form.contractName ||
      !form.principalAmount ||
      !form.executionDate ||
      !form.repaymentStartDate ||
      !form.totalPayments ||
      !form.interestRate
    )
      return
    setSubmitting(true)
    try {
      await createLoan({
        companyId: selectedCompany.id,
        contractName: form.contractName,
        partnerId: form.partnerId || undefined,
        principalAmount: form.principalAmount,
        executionDate: form.executionDate,
        repaymentStartDate: form.repaymentStartDate,
        repaymentMethod: form.repaymentMethod,
        repaymentFrequency: form.repaymentFrequency,
        repaymentDay: form.repaymentDay ? parseInt(form.repaymentDay) : undefined,
        totalPayments: parseInt(form.totalPayments),
        interestType: form.interestType,
        interestRate: form.interestRate,
      })
      resetForm()
      loadLoans(selectedCompany.id)
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewDetail = async (loanId: string) => {
    if (!selectedCompany) return
    const detail = await getLoan(loanId, selectedCompany.id)
    setSelectedLoan(detail as LoanDetail)
    setDetailOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!selectedCompany || !confirm("この借入契約を削除しますか？")) return
    await deleteLoan(id, selectedCompany.id)
    loadLoans(selectedCompany.id)
  }

  const handleMarkPaid = async (scheduleId: string) => {
    if (!selectedCompany || !selectedLoan) return
    await markLoanSchedulePaid(scheduleId, selectedCompany.id)
    const detail = await getLoan(selectedLoan.id, selectedCompany.id)
    setSelectedLoan(detail as LoanDetail)
    loadLoans(selectedCompany.id)
  }

  const getPartnerName = (partnerId: string | null) => {
    if (!partnerId) return "—"
    return partners.find((p) => p.id === partnerId)?.name || "—"
  }

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">借入管理</h1>
          <p className="text-muted-foreground">会社を選択してください</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">借入管理</h1>
          <p className="text-muted-foreground">
            {selectedCompany.name} の借入金を管理します
          </p>
        </div>
        <Button onClick={() => { setForm(initialFormState); setDialogOpen(true) }}>
          新規借入契約
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新規借入契約</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>契約名 *</Label>
                <Input
                  value={form.contractName}
                  onChange={(e) => setForm((p) => ({ ...p, contractName: e.target.value }))}
                  placeholder="例: ○○銀行 長期借入"
                />
              </div>
              <div className="space-y-2">
                <Label>借入先</Label>
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
                <Label>借入額 *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.principalAmount}
                  onChange={(e) => setForm((p) => ({ ...p, principalAmount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>実行日 *</Label>
                <Input
                  type="date"
                  value={form.executionDate}
                  onChange={(e) => setForm((p) => ({ ...p, executionDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>返済開始日 *</Label>
                <Input
                  type="date"
                  value={form.repaymentStartDate}
                  onChange={(e) => setForm((p) => ({ ...p, repaymentStartDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>返済方法</Label>
                <Select value={form.repaymentMethod} onValueChange={(v) => setForm((p) => ({ ...p, repaymentMethod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EQUAL_PRINCIPAL">元金均等</SelectItem>
                    <SelectItem value="BULLET">一括返済</SelectItem>
                    <SelectItem value="GRACE">据置</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>返済頻度</Label>
                <Select value={form.repaymentFrequency} onValueChange={(v) => setForm((p) => ({ ...p, repaymentFrequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">月次</SelectItem>
                    <SelectItem value="QUARTERLY">四半期</SelectItem>
                    <SelectItem value="SEMIANNUAL">半年</SelectItem>
                    <SelectItem value="ANNUAL">年次</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>返済日</Label>
                <Input
                  type="number"
                  placeholder="例: 25"
                  min={1}
                  max={31}
                  value={form.repaymentDay}
                  onChange={(e) => setForm((p) => ({ ...p, repaymentDay: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>返済回数 *</Label>
                <Input
                  type="number"
                  placeholder="例: 60"
                  value={form.totalPayments}
                  onChange={(e) => setForm((p) => ({ ...p, totalPayments: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>金利タイプ</Label>
                <Select value={form.interestType} onValueChange={(v) => setForm((p) => ({ ...p, interestType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">固定</SelectItem>
                    <SelectItem value="VARIABLE">変動</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>金利（%） *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="例: 1.5"
                  value={form.interestRate}
                  onChange={(e) => setForm((p) => ({ ...p, interestRate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>キャンセル</Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                !form.contractName ||
                !form.principalAmount ||
                !form.executionDate ||
                !form.repaymentStartDate ||
                !form.totalPayments ||
                !form.interestRate
              }
            >
              {submitting ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedLoan?.contractName || "借入契約詳細"}
            </DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">借入先</span>
                  <p className="font-medium">{getPartnerName(selectedLoan.partnerId)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">借入額</span>
                  <p className="font-medium">{formatYen(Number(selectedLoan.principalAmount))}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">残高</span>
                  <p className="font-medium">{formatYen(Number(selectedLoan.remainingBalance))}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">ステータス</span>
                  <p>
                    <Badge variant={STATUS_VARIANTS[selectedLoan.status] || "outline"}>
                      {STATUS_LABELS[selectedLoan.status] || selectedLoan.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">実行日</span>
                  <p className="font-medium">{formatDate(selectedLoan.executionDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">返済方法</span>
                  <p className="font-medium">{REPAYMENT_METHOD_LABELS[selectedLoan.repaymentMethod] || selectedLoan.repaymentMethod}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">返済頻度</span>
                  <p className="font-medium">{REPAYMENT_FREQUENCY_LABELS[selectedLoan.repaymentFrequency] || selectedLoan.repaymentFrequency}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">金利</span>
                  <p className="font-medium">
                    {selectedLoan.interestRate}%（{selectedLoan.interestType === "FIXED" ? "固定" : "変動"}）
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">返済スケジュール</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">回</TableHead>
                      <TableHead>期日</TableHead>
                      <TableHead className="text-right">元金</TableHead>
                      <TableHead className="text-right">利息</TableHead>
                      <TableHead className="text-right">合計</TableHead>
                      <TableHead className="text-right">残高</TableHead>
                      <TableHead className="text-center">状態</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedLoan.schedules.map((s) => (
                      <TableRow key={s.id} className={s.isPaid ? "opacity-60" : ""}>
                        <TableCell>{s.paymentNumber}</TableCell>
                        <TableCell>{formatDate(s.dueDate)}</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(Number(s.principalAmount))}</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(Number(s.interestAmount))}</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(Number(s.totalAmount))}</TableCell>
                        <TableCell className="text-right font-mono">{formatYen(Number(s.remainingBalance))}</TableCell>
                        <TableCell className="text-center">
                          {s.isPaid ? (
                            <Badge variant="secondary">支払済</Badge>
                          ) : (
                            <Badge variant="outline">未払</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!s.isPaid && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkPaid(s.id)}
                            >
                              支払済にする
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>借入契約一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">読み込み中...</p>
          ) : loans.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">借入契約がありません</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>契約名</TableHead>
                  <TableHead>相手先</TableHead>
                  <TableHead className="text-right">借入額</TableHead>
                  <TableHead>実行日</TableHead>
                  <TableHead>返済方法</TableHead>
                  <TableHead>金利</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{loan.contractName}</TableCell>
                    <TableCell>{getPartnerName(loan.partnerId)}</TableCell>
                    <TableCell className="text-right font-mono">{formatYen(Number(loan.principalAmount))}</TableCell>
                    <TableCell>{formatDate(loan.executionDate)}</TableCell>
                    <TableCell>{REPAYMENT_METHOD_LABELS[loan.repaymentMethod] || loan.repaymentMethod}</TableCell>
                    <TableCell>
                      {loan.interestRate}%（{loan.interestType === "FIXED" ? "固定" : "変動"}）
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[loan.status] || "outline"}>
                        {STATUS_LABELS[loan.status] || loan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetail(loan.id)}>
                          詳細
                        </Button>
                        {loan.status === "ACTIVE" && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(loan.id)}>
                            削除
                          </Button>
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
    </div>
  )
}
