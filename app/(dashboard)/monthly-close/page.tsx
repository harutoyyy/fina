"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/contexts/company-context"
import { CompanySwitcher } from "@/components/company-switcher"
import { getAccounts } from "@/app/actions/accounts"
import {
  getMonthCloseStatus,
  closeMonth,
  reopenMonth,
  getMonthlyBalance,
  upsertMonthlyBalance,
} from "@/app/actions/cashflow-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Lock, Unlock, Save } from "lucide-react"
import { formatDate } from "@/lib/format"

type AccountItem = Awaited<ReturnType<typeof getAccounts>>[number]

type MonthCloseInfo = {
  yearMonth: string
  isClosed: boolean
  closedAt: string | null
  closedBy: string | null
  reopenedAt: string | null
  reopenedBy: string | null
  reopenReason: string | null
}

type BalanceInfo = {
  accountId: string
  bankName: string
  branchName: string
  openingBalance: string
  closingBalance: string
}

function generatePast12Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  return months
}

function formatYenStr(val: string | null | undefined): string {
  if (!val) return "¥0"
  const num = parseInt(val, 10)
  if (isNaN(num)) return "¥0"
  return `¥${num.toLocaleString("ja-JP")}`
}

export default function MonthlyClosePage() {
  const { selectedCompany } = useCompany()
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<AccountItem[]>([])
  const [monthStatuses, setMonthStatuses] = useState<Map<string, MonthCloseInfo>>(new Map())
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [balances, setBalances] = useState<BalanceInfo[]>([])
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [closing, setClosing] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const [reopenReason, setReopenReason] = useState("")
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [balanceEdits, setBalanceEdits] = useState<Record<string, string>>({})
  const [savingBalance, setSavingBalance] = useState<string | null>(null)

  const months = generatePast12Months()

  const loadStatuses = useCallback(async () => {
    if (!selectedCompany) return
    setLoading(true)
    try {
      const [accts, ...statuses] = await Promise.all([
        getAccounts(selectedCompany.id),
        ...months.map((m) => getMonthCloseStatus(selectedCompany.id, m)),
      ])
      setAccounts(accts)
      const map = new Map<string, MonthCloseInfo>()
      months.forEach((m, i) => {
        const s = statuses[i] as MonthCloseInfo | null
        map.set(m, {
          yearMonth: m,
          isClosed: s?.isClosed ?? false,
          closedAt: s?.closedAt ?? null,
          closedBy: s?.closedBy ?? null,
          reopenedAt: s?.reopenedAt ?? null,
          reopenedBy: s?.reopenedBy ?? null,
          reopenReason: s?.reopenReason ?? null,
        })
      })
      setMonthStatuses(map)
      if (!selectedMonth) {
        setSelectedMonth(months[0])
      }
    } finally {
      setLoading(false)
    }
  }, [selectedCompany])

  const loadBalances = useCallback(async () => {
    if (!selectedCompany || !selectedMonth) return
    setBalanceLoading(true)
    try {
      const activeAccounts = accounts.filter((a) => a.isActive)
      const results = await Promise.all(
        activeAccounts.map((a) => getMonthlyBalance(selectedCompany.id, a.id, selectedMonth))
      )
      const bals: BalanceInfo[] = activeAccounts.map((a, i) => {
        const r = results[i] as { openingBalance?: string; closingBalance?: string } | null
        return {
          accountId: a.id,
          bankName: a.bankName || "口座",
          branchName: a.branchName || "",
          openingBalance: r?.openingBalance ?? "0",
          closingBalance: r?.closingBalance ?? "0",
        }
      })
      setBalances(bals)
      const edits: Record<string, string> = {}
      bals.forEach((b) => {
        edits[b.accountId] = b.openingBalance
      })
      setBalanceEdits(edits)
    } finally {
      setBalanceLoading(false)
    }
  }, [selectedCompany, selectedMonth, accounts])

  useEffect(() => {
    loadStatuses()
  }, [selectedCompany])

  useEffect(() => {
    if (accounts.length > 0 && selectedMonth) {
      loadBalances()
    }
  }, [selectedMonth, accounts])

  const handleCloseMonth = async () => {
    if (!selectedCompany || !selectedMonth) return
    setClosing(true)
    try {
      await closeMonth(selectedCompany.id, selectedMonth)
      setCloseDialogOpen(false)
      await loadStatuses()
    } finally {
      setClosing(false)
    }
  }

  const handleReopenMonth = async () => {
    if (!selectedCompany || !selectedMonth || !reopenReason.trim()) return
    setReopening(true)
    try {
      await reopenMonth(selectedCompany.id, selectedMonth, reopenReason.trim())
      setReopenDialogOpen(false)
      setReopenReason("")
      await loadStatuses()
    } finally {
      setReopening(false)
    }
  }

  const handleSaveBalance = async (accountId: string) => {
    if (!selectedCompany || !selectedMonth) return
    setSavingBalance(accountId)
    try {
      await upsertMonthlyBalance(selectedCompany.id, accountId, selectedMonth, balanceEdits[accountId] || "0")
      await loadBalances()
    } finally {
      setSavingBalance(null)
    }
  }

  const currentStatus = monthStatuses.get(selectedMonth)

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">月次処理</h1>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">会社を選択してください</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">月次処理</h1>
          <p className="text-muted-foreground">{selectedCompany.name} の月次締め・残高管理</p>
        </div>
        <CompanySwitcher />
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>月次ステータス一覧（過去12ヶ月）</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>年月</TableHead>
                    <TableHead>締めステータス</TableHead>
                    <TableHead>締め日時</TableHead>
                    <TableHead>締め実行者</TableHead>
                    <TableHead>解除履歴</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {months.map((m) => {
                    const status = monthStatuses.get(m)
                    const isClosed = status?.isClosed ?? false
                    return (
                      <TableRow
                        key={m}
                        className={selectedMonth === m ? "bg-muted/50" : "cursor-pointer hover:bg-muted/30"}
                        onClick={() => setSelectedMonth(m)}
                      >
                        <TableCell className="font-medium">{m}</TableCell>
                        <TableCell>
                          <Badge variant={isClosed ? "default" : "secondary"}>
                            {isClosed ? "締め済み" : "未締め"}
                          </Badge>
                        </TableCell>
                        <TableCell>{status?.closedAt ? formatDate(status.closedAt) : "-"}</TableCell>
                        <TableCell>{status?.closedBy || "-"}</TableCell>
                        <TableCell>
                          {status?.reopenedAt ? (
                            <span className="text-sm">
                              {formatDate(status.reopenedAt)}
                              {status.reopenReason && (
                                <span className="ml-1 text-muted-foreground">（{status.reopenReason}）</span>
                              )}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedMonth(m)
                            }}
                          >
                            選択
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {selectedMonth && (
            <>
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">{selectedMonth} の操作</h2>
                {currentStatus?.isClosed ? (
                  <Button
                    variant="destructive"
                    onClick={() => setReopenDialogOpen(true)}
                  >
                    <Unlock className="mr-2 h-4 w-4" />
                    月締め解除
                  </Button>
                ) : (
                  <Button onClick={() => setCloseDialogOpen(true)}>
                    <Lock className="mr-2 h-4 w-4" />
                    月締め実行
                  </Button>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>口座別残高一覧（{selectedMonth}）</CardTitle>
                </CardHeader>
                <CardContent>
                  {balanceLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : balances.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">口座が登録されていません</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>口座</TableHead>
                          <TableHead className="text-right">期首残高</TableHead>
                          <TableHead className="text-right">月末残高</TableHead>
                          <TableHead>期首残高設定</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {balances.map((b) => (
                          <TableRow key={b.accountId}>
                            <TableCell className="font-medium">
                              {b.bankName} {b.branchName}
                            </TableCell>
                            <TableCell className="text-right">{formatYenStr(b.openingBalance)}</TableCell>
                            <TableCell className="text-right">{formatYenStr(b.closingBalance)}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                className="w-40"
                                value={balanceEdits[b.accountId] ?? ""}
                                onChange={(e) =>
                                  setBalanceEdits((prev) => ({
                                    ...prev,
                                    [b.accountId]: e.target.value,
                                  }))
                                }
                                disabled={currentStatus?.isClosed}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSaveBalance(b.accountId)}
                                disabled={currentStatus?.isClosed || savingBalance === b.accountId}
                              >
                                {savingBalance === b.accountId ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <Save className="mr-1 h-3 w-3" />
                                )}
                                保存
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>月次締め確認</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            <strong>{selectedMonth}</strong> を締めますか？締め後は取引の編集ができなくなります。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleCloseMonth} disabled={closing}>
              {closing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              締め実行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>月締め解除</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>
              <strong>{selectedMonth}</strong> の月締めを解除します。理由を入力してください。
            </p>
            <div className="space-y-2">
              <Label>解除理由 *</Label>
              <Input
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="解除理由を入力"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleReopenMonth}
              disabled={reopening || !reopenReason.trim()}
            >
              {reopening && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              解除実行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
