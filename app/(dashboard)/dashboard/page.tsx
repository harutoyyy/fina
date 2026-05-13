"use client"

import { useState, useEffect, useCallback } from "react"
import { useCompany } from "@/contexts/company-context"
import { CompanySwitcher } from "@/components/company-switcher"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Building2, CreditCard, Handshake, FileText, Inbox, TrendingUp, Layers } from "lucide-react"
import { getDashboardData, type DashboardSummary } from "@/app/actions/dashboard"
import { getGroupDashboardSummary } from "@/app/actions/company-groups"
import { formatYen, formatDate, getCurrentMonth } from "@/lib/format"

type GroupSummary = Awaited<ReturnType<typeof getGroupDashboardSummary>>

const TYPE_LABELS: Record<string, string> = {
  EXPENSE: "経費",
  SALES: "売上",
  COST_PAYMENT: "原価",
  SALARY: "給与",
  LOAN: "借入",
  TRANSFER: "振替",
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "下書き",
  READY: "準備完了",
  CONFIRMED: "確定済",
}

export default function DashboardPage() {
  const { selectedCompany } = useCompany()
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [groupSummary, setGroupSummary] = useState<GroupSummary | null>(null)
  const [groupMonth, setGroupMonth] = useState(getCurrentMonth())

  const loadData = useCallback(async () => {
    if (!selectedCompany) {
      setData(null)
      return
    }
    setLoading(true)
    try {
      const result = await getDashboardData(selectedCompany.id)
      setData(result)
    } catch (e) {
      console.error("Failed to load dashboard:", e)
    } finally {
      setLoading(false)
    }
  }, [selectedCompany])

  const loadGroupSummary = useCallback(async () => {
    try {
      const res = await getGroupDashboardSummary({ yearMonth: groupMonth })
      setGroupSummary(res)
    } catch (e) {
      console.error("Failed to load group summary:", e)
    }
  }, [groupMonth])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    loadGroupSummary()
  }, [loadGroupSummary])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ダッシュボード</h1>
          <p className="text-muted-foreground">
            {selectedCompany ? `${selectedCompany.name} の概要` : "会社を選択してください"}
          </p>
        </div>
        <CompanySwitcher />
      </div>

      {/* 会社グループ・全社サマリタイル（PDF P1） */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">グループ別サマリ</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">対象月</Label>
            <Input
              type="month"
              value={groupMonth}
              onChange={(e) => setGroupMonth(e.target.value)}
              className="w-36"
            />
          </div>
        </CardHeader>
        <CardContent>
          {!groupSummary ? (
            <p className="text-muted-foreground text-sm">読み込み中...</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-4 bg-primary/5">
                <div className="text-xs text-muted-foreground">全社合計</div>
                <div className="font-semibold mt-1">
                  {groupSummary.allCompaniesTile.companyCount}社
                </div>
                <div className="mt-2 space-y-0.5 text-sm font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">残高</span>
                    <span>{formatYen(BigInt(groupSummary.allCompaniesTile.balance))}</span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>入金</span>
                    <span>{formatYen(BigInt(groupSummary.allCompaniesTile.income))}</span>
                  </div>
                  <div className="flex justify-between text-red-700">
                    <span>出金</span>
                    <span>{formatYen(BigInt(groupSummary.allCompaniesTile.expense))}</span>
                  </div>
                </div>
              </div>

              {groupSummary.groupTiles.map((tile) => (
                <div
                  key={tile.id}
                  className="rounded-lg border p-4"
                  style={
                    tile.colorCode
                      ? { borderLeftWidth: 4, borderLeftColor: tile.colorCode }
                      : undefined
                  }
                >
                  <div className="text-xs text-muted-foreground">{tile.name}</div>
                  <div className="font-semibold mt-1">{tile.companyCount}社</div>
                  <div className="mt-2 space-y-0.5 text-sm font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">残高</span>
                      <span>{formatYen(BigInt(tile.balance))}</span>
                    </div>
                    <div className="flex justify-between text-green-700">
                      <span>入金</span>
                      <span>{formatYen(BigInt(tile.income))}</span>
                    </div>
                    <div className="flex justify-between text-red-700">
                      <span>出金</span>
                      <span>{formatYen(BigInt(tile.expense))}</span>
                    </div>
                  </div>
                  {tile.companyNames.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tile.companyNames.slice(0, 4).map((n, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {n}
                        </Badge>
                      ))}
                      {tile.companyNames.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{tile.companyNames.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {groupSummary.groupTiles.length === 0 && (
                <div className="col-span-full text-sm text-muted-foreground border rounded-lg p-4">
                  会社グループが未登録です。マスタ →「会社グループ」から作成してください。
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">会社</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedCompany?.name || "-"}</div>
            <p className="text-xs text-muted-foreground">{selectedCompany?.industryType || ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">口座数</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.accountCount ?? "-"}</div>
            <p className="text-xs text-muted-foreground">登録済み口座</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">取引先数</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.partnerCount ?? "-"}</div>
            <p className="text-xs text-muted-foreground">登録済み取引先</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今月の取引</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.transactionCountThisMonth ?? "-"}</div>
            <p className="text-xs text-muted-foreground">件</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">メイン口座残高</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {data ? formatYen(Number(data.mainAccountBalance)) : "-"}
            </div>
            <p className="text-xs text-muted-foreground">{data?.mainAccountName || "未設定"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">経費確定待ち</CardTitle>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.pendingExpenses ?? "-"}</div>
            <p className="text-xs text-muted-foreground">
              合計 {data ? formatYen(Math.abs(Number(data.pendingAmount))) : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {data && data.mainAccountTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              メイン口座 直近の入出金
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {data.mainAccountName}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日付</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>取引先</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                  <TableHead className="text-right">残高</TableHead>
                  <TableHead>状態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.mainAccountTransactions.map((tx) => {
                  const amt = Number(tx.amount)
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(tx.transactionDate || tx.scheduledDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{TYPE_LABELS[tx.type] || tx.type}</Badge>
                      </TableCell>
                      <TableCell>{tx.partnerName || "-"}</TableCell>
                      <TableCell className="max-w-48 truncate text-sm">{tx.summary || "-"}</TableCell>
                      <TableCell className={`text-right font-mono ${amt > 0 ? "text-green-600" : "text-red-600"}`}>
                        {amt > 0 ? "+" : ""}{formatYen(amt)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatYen(Number(tx.runningBalance))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{STATUS_LABELS[tx.status] || tx.status}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!selectedCompany && (
        <Card>
          <CardHeader>
            <CardTitle>セットアップガイド</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm">
              <p>まずは以下の順序でセットアップしてください：</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>マスタ管理 → 会社一覧で会社情報を確認</li>
                <li>マスタ管理 → 銀行口座で口座を登録</li>
                <li>マスタ管理 → 取引先を登録</li>
                <li>各入力画面から取引データを入力</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
