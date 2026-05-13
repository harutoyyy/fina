"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Layers, TrendingUp, TrendingDown, Wallet } from "lucide-react"
import { getGroupDashboardSummary } from "@/app/actions/company-groups"
import { formatYen, getCurrentMonth } from "@/lib/format"

type GroupSummary = Awaited<ReturnType<typeof getGroupDashboardSummary>>

export default function GroupSummaryPage() {
  const [yearMonth, setYearMonth] = useState(getCurrentMonth())
  const [summary, setSummary] = useState<GroupSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getGroupDashboardSummary({ yearMonth })
      setSummary(res)
    } catch (e) {
      console.error("Failed to load group summary:", e)
    } finally {
      setLoading(false)
    }
  }, [yearMonth])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6" />
            グループ別サマリ
          </h1>
          <p className="text-muted-foreground">会社グループごとの残高・入出金を確認します</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">対象月</Label>
          <Input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} className="w-44" />
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">読み込み中...</CardContent></Card>
      ) : !summary ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">データがありません</CardContent></Card>
      ) : (
        <>
          {/* 全社合計タイル */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                全社合計 ({summary.allCompaniesTile.companyCount}社)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">合計残高</div>
                  <div className="text-2xl font-bold font-mono">{formatYen(BigInt(summary.allCompaniesTile.balance))}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    入金合計
                  </div>
                  <div className="text-2xl font-bold font-mono text-green-700">{formatYen(BigInt(summary.allCompaniesTile.income))}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-red-600" />
                    出金合計
                  </div>
                  <div className="text-2xl font-bold font-mono text-red-700">{formatYen(BigInt(summary.allCompaniesTile.expense))}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* グループ別タイル */}
          <div>
            <h2 className="text-lg font-semibold mb-3">グループ別内訳</h2>
            {summary.groupTiles.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  会社グループが未登録です。マスタ →「会社グループ」から作成してください。
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {summary.groupTiles.map((tile) => (
                  <Card
                    key={tile.id}
                    style={tile.colorCode ? { borderLeftWidth: 4, borderLeftColor: tile.colorCode } : undefined}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{tile.name}</span>
                        <Badge variant="outline">{tile.companyCount}社</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">残高</span>
                          <span className="font-mono font-medium">{formatYen(BigInt(tile.balance))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-green-600" />入金
                          </span>
                          <span className="font-mono text-green-700">{formatYen(BigInt(tile.income))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <TrendingDown className="h-3 w-3 text-red-600" />出金
                          </span>
                          <span className="font-mono text-red-700">{formatYen(BigInt(tile.expense))}</span>
                        </div>
                      </div>
                      {tile.companyNames.length > 0 && (
                        <div className="mt-4 pt-3 border-t">
                          <div className="text-xs text-muted-foreground mb-1">所属会社</div>
                          <div className="flex flex-wrap gap-1">
                            {tile.companyNames.map((n, i) => (
                              <Badge key={i} variant="secondary" className="text-xs font-normal">
                                {n}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
