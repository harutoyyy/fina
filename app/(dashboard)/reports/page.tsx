"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useCompany } from "@/contexts/company-context"
import { CompanySwitcher } from "@/components/company-switcher"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileBarChart2 } from "lucide-react"
import {
  getTrialBalance,
  getYearlyReport,
  getAvailableScopes,
  getAvailableMonths,
  type ReportType,
  type ReportScope,
  type TrialBalanceData,
  type YearlyReportData,
  type ScopeOption,
} from "@/app/actions/financial-reports"
import { formatYen, getCurrentMonth } from "@/lib/format"

type ScopeSelection = {
  kind: "SINGLE" | "INDUSTRY_TOTAL" | "ALL_TOTAL"
  label: string
  scopeLabel?: string // INDUSTRY_TOTAL / ALL_TOTAL のとき DB の scopeLabel
}

const SCOPE_SINGLE_VALUE = "__single__"
const FISCAL_YEAR_OPTIONS = [2024, 2025, 2026]

function currentFiscalYear(): number {
  // 事業年度は 5月始まり 4月終わり
  const now = new Date()
  const month = now.getMonth() + 1
  return month >= 5 ? now.getFullYear() : now.getFullYear() - 1
}

function monthLabel(yearMonth: string): string {
  const [, m] = yearMonth.split("-")
  const n = parseInt(m ?? "", 10)
  if (!n) return yearMonth
  return `${n}月度`
}

function amountClass(amount: number): string {
  if (amount < 0) return "text-red-600"
  return ""
}

function rowClass(args: { isSection: boolean; isSubtotal: boolean }): string {
  if (args.isSection) {
    return "bg-muted/60 font-bold text-primary"
  }
  if (args.isSubtotal) {
    return "font-bold border-t-2 border-foreground/20"
  }
  return ""
}

export default function ReportsPage() {
  const { selectedCompany } = useCompany()

  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>([])
  const [scopeSelection, setScopeSelection] = useState<ScopeSelection>({
    kind: "SINGLE",
    label: "選択中の会社",
  })

  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [yearMonth, setYearMonth] = useState<string>(getCurrentMonth())
  const [fiscalYear, setFiscalYear] = useState<number>(currentFiscalYear())

  const [trialBalance, setTrialBalance] = useState<TrialBalanceData | null>(null)
  const [yearlyReports, setYearlyReports] = useState<
    Partial<Record<ReportType, YearlyReportData>>
  >({})
  const [activeTab, setActiveTab] = useState<ReportType>("TRIAL_BALANCE")
  const [loading, setLoading] = useState(false)

  // scope options をロード
  useEffect(() => {
    getAvailableScopes()
      .then((opts) => setScopeOptions(opts))
      .catch((e) => console.error("Failed to load scope options:", e))
  }, [])

  // 利用可能月をロード → 最新の月を初期値に
  useEffect(() => {
    getAvailableMonths()
      .then((months) => {
        setAvailableMonths(months)
        if (months.length > 0) {
          // 直近データの月にデフォルト合わせる（今月にデータが無い場合の救済）
          const current = getCurrentMonth()
          if (!months.includes(current)) {
            setYearMonth(months[0])
            // 事業年度も合わせる: yearMonth が "2026-04" なら 2025 年度
            const [yStr, mStr] = months[0].split("-")
            const y = parseInt(yStr, 10)
            const m = parseInt(mStr, 10)
            if (y && m) setFiscalYear(m >= 5 ? y : y - 1)
          }
        }
      })
      .catch((e) => console.error("Failed to load available months:", e))
  }, [])

  const buildScopeParams = useCallback(():
    | { companyId: string | null; scope: ReportScope; scopeLabel?: string }
    | null => {
    if (scopeSelection.kind === "SINGLE") {
      if (!selectedCompany) return null
      return { companyId: selectedCompany.id, scope: "SINGLE" }
    }
    return {
      companyId: null,
      scope: scopeSelection.kind,
      scopeLabel: scopeSelection.scopeLabel,
    }
  }, [scopeSelection, selectedCompany])

  // データロード（タブ・スコープ・対象期間が変わったら走る）
  const load = useCallback(async () => {
    const params = buildScopeParams()
    if (!params) return
    setLoading(true)
    try {
      if (activeTab === "TRIAL_BALANCE") {
        const data = await getTrialBalance({
          companyId: params.companyId,
          scope: params.scope,
          scopeLabel: params.scopeLabel,
          yearMonth,
        })
        setTrialBalance(data)
      } else {
        const data = await getYearlyReport({
          companyId: params.companyId,
          scope: params.scope,
          scopeLabel: params.scopeLabel,
          reportType: activeTab,
          fiscalYear,
        })
        setYearlyReports((prev) => ({ ...prev, [activeTab]: data }))
      }
    } catch (e) {
      console.error("Failed to load financial report:", e)
    } finally {
      setLoading(false)
    }
  }, [activeTab, buildScopeParams, fiscalYear, yearMonth])

  useEffect(() => {
    load()
  }, [load])

  const scopeValue = useMemo(() => {
    if (scopeSelection.kind === "SINGLE") return SCOPE_SINGLE_VALUE
    return `${scopeSelection.kind}::${scopeSelection.scopeLabel ?? scopeSelection.label}`
  }, [scopeSelection])

  const handleScopeChange = (value: string) => {
    if (value === SCOPE_SINGLE_VALUE) {
      setScopeSelection({ kind: "SINGLE", label: "選択中の会社" })
      return
    }
    const opt = scopeOptions.find(
      (o) => `${o.scope}::${o.label}` === value
    )
    if (!opt) return
    setScopeSelection({
      kind: opt.scope,
      label: opt.label,
      scopeLabel: opt.label,
    })
  }

  const currentScopeLabel = useMemo(() => {
    if (scopeSelection.kind === "SINGLE") {
      return selectedCompany ? selectedCompany.shortName || selectedCompany.name : "会社未選択"
    }
    return scopeSelection.label
  }, [scopeSelection, selectedCompany])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileBarChart2 className="h-6 w-6" />
            財務レポート
          </h1>
          <p className="text-muted-foreground">
            社外提供の試算表・損益計算書・貸借対照表・製造原価報告書を表示します
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySwitcher />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">対象スコープ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">スコープ</Label>
              <Select value={scopeValue} onValueChange={handleScopeChange}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="スコープを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SCOPE_SINGLE_VALUE}>
                    選択中会社（{selectedCompany?.shortName || selectedCompany?.name || "未選択"}）
                  </SelectItem>
                  {scopeOptions.map((opt) => (
                    <SelectItem
                      key={`${opt.scope}::${opt.label}`}
                      value={`${opt.scope}::${opt.label}`}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              現在の表示: <span className="font-medium text-foreground">{currentScopeLabel}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ReportType)}
      >
        <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto">
          <TabsTrigger value="TRIAL_BALANCE">試算表（単月）</TabsTrigger>
          <TabsTrigger value="INCOME_STATEMENT">損益計算書（年間）</TabsTrigger>
          <TabsTrigger value="BALANCE_SHEET">貸借対照表（年間）</TabsTrigger>
          <TabsTrigger value="MANUFACTURING_COST">製造原価（年間）</TabsTrigger>
        </TabsList>

        <TabsContent value="TRIAL_BALANCE" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">単月試算表</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Label className="text-sm whitespace-nowrap">対象月</Label>
                {availableMonths.length > 0 ? (
                  <Select value={yearMonth} onValueChange={setYearMonth}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMonths.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}（{monthLabel(m)}）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="month"
                    value={yearMonth}
                    onChange={(e) => setYearMonth(e.target.value)}
                    className="w-44"
                  />
                )}
                {availableMonths.length > 0 && !availableMonths.includes(yearMonth) && (
                  <span className="text-xs text-orange-600">
                    ⚠ この月にはデータがありません（利用可能: {availableMonths[availableMonths.length - 1]} 〜 {availableMonths[0]}）
                  </span>
                )}
              </div>
              <TrialBalanceTable data={trialBalance} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>

        {(["INCOME_STATEMENT", "BALANCE_SHEET", "MANUFACTURING_COST"] as const).map(
          (rt) => (
            <TabsContent key={rt} value={rt} className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {rt === "INCOME_STATEMENT"
                      ? "損益計算書（年間推移）"
                      : rt === "BALANCE_SHEET"
                      ? "貸借対照表（年間推移）"
                      : "製造原価報告書（年間推移）"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <Label className="text-sm whitespace-nowrap">事業年度</Label>
                    <Select
                      value={String(fiscalYear)}
                      onValueChange={(v) => setFiscalYear(parseInt(v, 10))}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FISCAL_YEAR_OPTIONS.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}年度（{y}/5〜{y + 1}/4）
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <YearlyReportTable data={yearlyReports[rt] ?? null} loading={loading} />
                </CardContent>
              </Card>
            </TabsContent>
          )
        )}
      </Tabs>
    </div>
  )
}

function TrialBalanceTable({
  data,
  loading,
}: {
  data: TrialBalanceData | null
  loading: boolean
}) {
  if (loading && !data) {
    return (
      <div className="py-12 text-center text-muted-foreground">読み込み中...</div>
    )
  }

  const rows = data?.rows ?? []
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        試算表データがありません。データ取込が必要です。
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[280px]">勘定科目</TableHead>
            <TableHead className="text-right">金額（円）</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.id}
              className={rowClass({ isSection: r.isSection, isSubtotal: r.isSubtotal })}
            >
              <TableCell className="whitespace-nowrap">
                {r.isSection ? `[${r.accountName}]` : r.accountName}
              </TableCell>
              <TableCell
                className={`text-right font-mono whitespace-nowrap ${amountClass(r.amount)}`}
              >
                {r.isSection ? "" : formatYen(r.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function YearlyReportTable({
  data,
  loading,
}: {
  data: YearlyReportData | null
  loading: boolean
}) {
  if (loading && !data) {
    return (
      <div className="py-12 text-center text-muted-foreground">読み込み中...</div>
    )
  }

  // データがなくても月ヘッダだけは出したいので、データがあれば months を使う
  const months = data?.months ?? []
  const rows = data?.rows ?? []

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        年間推移データがありません。データ取込が必要です。
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[240px] sticky left-0 bg-background z-10">
              勘定科目
            </TableHead>
            {months.map((m) => (
              <TableHead key={m} className="text-right whitespace-nowrap">
                {monthLabel(m)}
              </TableHead>
            ))}
            <TableHead className="text-right whitespace-nowrap bg-muted/30">
              当期合計
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, idx) => (
            <TableRow
              key={`${r.accountName}-${idx}`}
              className={rowClass({ isSection: r.isSection, isSubtotal: r.isSubtotal })}
            >
              <TableCell className="whitespace-nowrap sticky left-0 bg-background z-10">
                {r.isSection ? `[${r.accountName}]` : r.accountName}
              </TableCell>
              {r.monthly.map((cell) => (
                <TableCell
                  key={cell.yearMonth}
                  className={`text-right font-mono whitespace-nowrap ${amountClass(cell.amount)}`}
                >
                  {r.isSection ? "" : formatYen(cell.amount)}
                </TableCell>
              ))}
              <TableCell
                className={`text-right font-mono whitespace-nowrap bg-muted/30 ${amountClass(r.total)}`}
              >
                {r.isSection ? "" : formatYen(r.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
