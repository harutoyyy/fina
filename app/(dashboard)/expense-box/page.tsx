"use client"

import { useState, useEffect, useCallback } from "react"
import { useCompany } from "@/contexts/company-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { updateTransactionStatus, setEvidenceNotRequired } from "@/app/actions/transactions"
import { getExpenseBoxItems, getCurrentUserProfile, type CurrentUserProfile } from "@/app/actions/user-profile"
import { formatYen } from "@/lib/format"

type ExpenseBoxRow = {
  id: string
  companyId: string
  accountId: string
  partnerId: string | null
  type: string
  status: string
  transactionDate: string | null
  scheduledDate: string | null
  accountingMonth: string
  amount: string
  paymentMethod: string | null
  summary: string | null
  hasEvidence: boolean
  evidenceNotRequired: boolean
  receivedDate: string | null
  temporaryVendorName: string | null
  latestEvidenceAt: string | null
  partner: { id: string; name: string } | null
  account: { id: string; bankName: string | null; branchName: string | null; accountNumber: string | null }
  details: {
    id: string
    midId: string | null
    midName: string | null
    subName: string | null
    amount: string
    summary: string | null
  }[]
}

const PAYMENT_LABELS: Record<string, string> = {
  BANK_TRANSFER: "振込",
  DIRECT_DEBIT: "引落",
  CASH_WITHDRAWAL: "現金",
}

function formatDD(dateStr: string | null): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  return `${d.getDate()}日`
}

function formatReceivedDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function isRecentlyUpdated(dateStr: string | null, hoursAgo = 24): boolean {
  if (!dateStr) return false
  const diff = Date.now() - new Date(dateStr).getTime()
  return diff < hoursAgo * 60 * 60 * 1000
}

export default function ExpenseBoxPage() {
  const { selectedCompany } = useCompany()
  const [expenses, setExpenses] = useState<ExpenseBoxRow[]>([])
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // フィルタ state
  const [receivedDatePreset, setReceivedDatePreset] = useState<string>("all")
  const [receivedDateFrom, setReceivedDateFrom] = useState("")
  const [receivedDateTo, setReceivedDateTo] = useState("")
  const [evidenceFilter, setEvidenceFilter] = useState<string>("all")
  const [partnerSearch, setPartnerSearch] = useState("")
  const [scheduledDateFrom, setScheduledDateFrom] = useState("")
  const [scheduledDateTo, setScheduledDateTo] = useState("")
  const [showReady, setShowReady] = useState(false)

  const loadData = useCallback(async () => {
    if (!selectedCompany) return
    setLoading(true)
    try {
      const filters: Parameters<typeof getExpenseBoxItems>[1] = {
        showReady,
      }
      if (receivedDatePreset !== "all" && receivedDatePreset !== "range") {
        filters.receivedDatePreset = receivedDatePreset as "today" | "this_week" | "this_month"
      }
      if (receivedDatePreset === "range") {
        if (receivedDateFrom) filters.receivedDateFrom = receivedDateFrom
        if (receivedDateTo) filters.receivedDateTo = receivedDateTo
      }
      if (evidenceFilter !== "all") {
        filters.evidenceFilter = evidenceFilter as "attached" | "not_required" | "missing"
      }
      if (partnerSearch.trim()) {
        filters.partnerSearch = partnerSearch.trim()
      }
      if (scheduledDateFrom) filters.scheduledDateFrom = scheduledDateFrom
      if (scheduledDateTo) filters.scheduledDateTo = scheduledDateTo

      const [expResult, userProfile] = await Promise.all([
        getExpenseBoxItems(selectedCompany.id, filters),
        getCurrentUserProfile(),
      ])
      setExpenses(expResult.data ?? [])
      setProfile(userProfile)
    } catch (e) {
      console.error("Failed to load expense box data:", e)
    } finally {
      setLoading(false)
    }
  }, [selectedCompany, receivedDatePreset, receivedDateFrom, receivedDateTo, evidenceFilter, partnerSearch, scheduledDateFrom, scheduledDateTo, showReady])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!selectedCompany) return
    setActionLoading(id)
    try {
      await updateTransactionStatus(id, selectedCompany.id, newStatus as never)
      await loadData()
    } catch (e) {
      alert(e instanceof Error ? e.message : "ステータス変更に失敗しました")
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleEvidenceNotRequired = async (id: string, value: boolean) => {
    if (!selectedCompany) return
    setActionLoading(id)
    try {
      await setEvidenceNotRequired(id, selectedCompany.id, value)
      await loadData()
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作に失敗しました")
    } finally {
      setActionLoading(null)
    }
  }

  const isAdmin = profile?.role === "ADMIN"
  const draftCount = expenses.filter((e) => e.status === "DRAFT").length
  const readyCount = expenses.filter((e) => e.status === "READY").length

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">受領BOX</h1>
          <p className="text-muted-foreground">会社を選択してください</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">受領BOX</h1>
          <p className="text-muted-foreground">
            今日届いた請求書・通知書を処理する
            {isAdmin && " （管理者）"}
          </p>
        </div>
      </div>

      {/* フィルタ */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">受領日</Label>
              <Select value={receivedDatePreset} onValueChange={setReceivedDatePreset}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="today">今日</SelectItem>
                  <SelectItem value="this_week">今週</SelectItem>
                  <SelectItem value="this_month">今月</SelectItem>
                  <SelectItem value="range">範囲指定</SelectItem>
                </SelectContent>
              </Select>
              {receivedDatePreset === "range" && (
                <div className="flex gap-1 mt-1">
                  <Input type="date" className="h-7 text-xs" value={receivedDateFrom} onChange={(e) => setReceivedDateFrom(e.target.value)} />
                  <Input type="date" className="h-7 text-xs" value={receivedDateTo} onChange={(e) => setReceivedDateTo(e.target.value)} />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">証憑</Label>
              <Select value={evidenceFilter} onValueChange={setEvidenceFilter}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="attached">添付済み</SelectItem>
                  <SelectItem value="not_required">証憑なしOK</SelectItem>
                  <SelectItem value="missing">未添付（要確認）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">取引先</Label>
              <Input
                className="h-8 text-sm"
                placeholder="部分一致検索"
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">予定日</Label>
              <div className="flex gap-1">
                <Input type="date" className="h-8 text-xs" value={scheduledDateFrom} onChange={(e) => setScheduledDateFrom(e.target.value)} />
                <Input type="date" className="h-8 text-xs" value={scheduledDateTo} onChange={(e) => setScheduledDateTo(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="showReady"
                checked={showReady}
                onCheckedChange={(v) => setShowReady(v === true)}
              />
              <Label htmlFor="showReady" className="text-sm">準備完了も表示</Label>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">下書き</Badge>
                <span className="font-mono">{draftCount}</span>
              </div>
              {showReady && (
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">準備完了</Badge>
                  <span className="font-mono">{readyCount}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">合計:</span>
                <span className="font-mono font-medium">
                  {formatYen(expenses.reduce((sum, e) => sum + Number(e.amount), 0))}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* テーブル */}
      {loading ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">読み込み中...</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              受領済み経費 ({expenses.length}件)
              {isAdmin && expenses.some(e => e.status === "READY") && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  管理者は確定操作が可能です
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">予定日</TableHead>
                  <TableHead>取引先</TableHead>
                  <TableHead>支払方法</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead className="w-20">受領日</TableHead>
                  <TableHead>証憑</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      該当するデータがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((exp) => (
                    <TableRow key={exp.id} className={isRecentlyUpdated(exp.latestEvidenceAt) ? "bg-blue-50 dark:bg-blue-950/30" : ""}>
                      <TableCell className="whitespace-nowrap font-mono text-sm">
                        {formatDD(exp.scheduledDate)}
                      </TableCell>
                      <TableCell>
                        {exp.partner?.name || (exp.temporaryVendorName
                          ? <span className="text-orange-600">{exp.temporaryVendorName}<Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">仮</Badge></span>
                          : "—")}
                      </TableCell>
                      <TableCell className="text-sm">{exp.paymentMethod ? PAYMENT_LABELS[exp.paymentMethod] || exp.paymentMethod : "—"}</TableCell>
                      <TableCell className="text-right font-mono">{formatYen(Number(exp.amount))}</TableCell>
                      <TableCell className="max-w-48 truncate text-sm">{exp.summary || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatReceivedDate(exp.receivedDate)}
                      </TableCell>
                      <TableCell>
                        {exp.evidenceNotRequired ? (
                          <Badge variant="secondary" className="text-xs cursor-pointer" onClick={isAdmin ? () => handleToggleEvidenceNotRequired(exp.id, false) : undefined}>
                            なしOK
                          </Badge>
                        ) : exp.hasEvidence ? (
                          <div className="flex items-center gap-1">
                            <Badge variant="default" className="text-xs">添付済</Badge>
                            {isRecentlyUpdated(exp.latestEvidenceAt) && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 text-blue-600 border-blue-300">NEW</Badge>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">未添付</Badge>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[10px] px-1"
                                onClick={() => handleToggleEvidenceNotRequired(exp.id, true)}
                              >
                                なしOK
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={exp.status === "READY" ? "secondary" : "outline"} className="text-xs">
                          {exp.status === "READY" ? "準備完了" : "下書き"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {exp.status === "DRAFT" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={actionLoading === exp.id}
                              onClick={() => handleStatusChange(exp.id, "READY")}
                            >
                              準備完了
                            </Button>
                          )}
                          {exp.status === "READY" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={actionLoading === exp.id}
                                onClick={() => handleStatusChange(exp.id, "DRAFT")}
                              >
                                差戻し
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={actionLoading === exp.id}
                                  onClick={() => handleStatusChange(exp.id, "CONFIRMED")}
                                >
                                  確定
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
