"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import { BookOpen, ChevronLeft, ChevronRight, Search } from "lucide-react"
import {
  getJournalEntries,
  type GetJournalEntriesResult,
  type SerializableJournalEntry,
} from "@/app/actions/journal-entries"
import { formatDate } from "@/lib/format"

const PAGE_SIZE = 100
const DEFAULT_MONTH = "2025-05"
const ALL_FLAGS_VALUE = "__all__"

// 識別フラグの選択肢
const IDENTIFIER_FLAG_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "2000", label: "2000 一般" },
  { value: "2100", label: "2100 給与控除" },
  { value: "2101", label: "2101 給与控除" },
  { value: "2110", label: "2110 売上入金" },
  { value: "2111", label: "2111 経費" },
]

function fmtAmount(n: number): string {
  if (!n) return ""
  return n.toLocaleString("ja-JP")
}

function shortenCompanyName(
  shortName: string | null,
  rawName: string | null
): string {
  if (shortName && shortName.trim().length > 0) return shortName
  if (!rawName) return ""
  // 「株式会社」「有限会社」等を削除して短縮
  return rawName
    .replace(/株式会社|有限会社|合同会社|合資会社|合名会社/g, "")
    .trim()
}

export default function JournalPage() {
  const { selectedCompany } = useCompany()

  // フィルタ状態（入力中）
  const [monthInput, setMonthInput] = useState<string>(DEFAULT_MONTH)
  const [voucherNoInput, setVoucherNoInput] = useState<string>("")
  const [identifierFlagInput, setIdentifierFlagInput] =
    useState<string>(ALL_FLAGS_VALUE)
  const [accountKindInput, setAccountKindInput] = useState<string>("")

  // 確定済フィルタ（検索ボタン押下後）
  const [appliedMonth, setAppliedMonth] = useState<string>(DEFAULT_MONTH)
  const [appliedVoucherNo, setAppliedVoucherNo] = useState<string>("")
  const [appliedIdentifierFlag, setAppliedIdentifierFlag] =
    useState<string>(ALL_FLAGS_VALUE)
  const [appliedAccountKind, setAppliedAccountKind] = useState<string>("")

  const [page, setPage] = useState<number>(1)
  const [data, setData] = useState<GetJournalEntriesResult | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const voucherNoNum = appliedVoucherNo.trim()
        ? parseInt(appliedVoucherNo.trim(), 10)
        : undefined
      const flagNum =
        appliedIdentifierFlag && appliedIdentifierFlag !== ALL_FLAGS_VALUE
          ? parseInt(appliedIdentifierFlag, 10)
          : undefined

      const result = await getJournalEntries({
        companyId: selectedCompany?.id ?? null,
        yearMonth: appliedMonth || undefined,
        voucherNo:
          typeof voucherNoNum === "number" && !isNaN(voucherNoNum)
            ? voucherNoNum
            : undefined,
        identifierFlag:
          typeof flagNum === "number" && !isNaN(flagNum) ? flagNum : undefined,
        accountKindKeyword: appliedAccountKind.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setData(result)
    } catch (e) {
      console.error("Failed to load journal entries:", e)
      setError(e instanceof Error ? e.message : "読み込みに失敗しました")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [
    selectedCompany,
    appliedMonth,
    appliedVoucherNo,
    appliedIdentifierFlag,
    appliedAccountKind,
    page,
  ])

  // 会社や検索条件、ページ変更時にロード
  useEffect(() => {
    load()
  }, [load])

  // 会社や検索条件変更時はページを1にリセット
  useEffect(() => {
    setPage(1)
  }, [
    selectedCompany?.id,
    appliedMonth,
    appliedVoucherNo,
    appliedIdentifierFlag,
    appliedAccountKind,
  ])

  const handleSearch = () => {
    setAppliedMonth(monthInput)
    setAppliedVoucherNo(voucherNoInput)
    setAppliedIdentifierFlag(identifierFlagInput)
    setAppliedAccountKind(accountKindInput)
    setPage(1)
  }

  const totalPages = useMemo(() => {
    if (!data || data.total === 0) return 1
    return Math.ceil(data.total / data.pageSize)
  }, [data])

  const canPrev = page > 1
  const canNext = data ? page < totalPages : false

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            仕訳帳
          </h1>
          <p className="text-muted-foreground">
            複式簿記の純粋仕訳を一覧表示します
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySwitcher />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">検索条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">対象月</Label>
              <Input
                type="month"
                value={monthInput}
                onChange={(e) => setMonthInput(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">伝票No</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="例: 12345"
                value={voucherNoInput}
                onChange={(e) => setVoucherNoInput(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">識別フラグ</Label>
              <Select
                value={identifierFlagInput}
                onValueChange={(v) => setIdentifierFlagInput(v)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="すべて" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FLAGS_VALUE}>すべて</SelectItem>
                  {IDENTIFIER_FLAG_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                勘定科目キーワード
              </Label>
              <Input
                type="text"
                placeholder="例: 現金 / 売上"
                value={accountKindInput}
                onChange={(e) => setAccountKindInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
                className="w-56"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-1" />
              検索
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>仕訳一覧</span>
            <span className="text-sm font-normal text-muted-foreground">
              {data
                ? `全 ${data.total.toLocaleString("ja-JP")} 件`
                : loading
                  ? "読み込み中..."
                  : "—"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30">
              {error}
            </div>
          )}

          <JournalTable rows={data?.rows ?? []} loading={loading} />

          {/* フッタ: 合計とページネーション */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              当ページ 借方合計{" "}
              <span className="font-mono font-medium text-blue-600">
                {data ? fmtAmount(data.totalDr) : "0"}
              </span>
              <span className="mx-2">/</span>
              貸方合計{" "}
              <span className="font-mono font-medium text-red-600">
                {data ? fmtAmount(data.totalCr) : "0"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!canPrev || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                前へ
              </Button>
              <span className="text-sm tabular-nums">
                {page} / {totalPages} ページ
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!canNext || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                次へ
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function JournalTable({
  rows,
  loading,
}: {
  rows: SerializableJournalEntry[]
  loading: boolean
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        読み込み中...
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        該当する仕訳がありません
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead className="whitespace-nowrap">日付</TableHead>
            <TableHead className="whitespace-nowrap text-right">伝票No</TableHead>
            <TableHead className="whitespace-nowrap">識別</TableHead>
            <TableHead className="whitespace-nowrap">借方科目</TableHead>
            <TableHead className="whitespace-nowrap">借方補助</TableHead>
            <TableHead className="whitespace-nowrap">借方部門</TableHead>
            <TableHead className="whitespace-nowrap text-right">
              借方金額
            </TableHead>
            <TableHead className="whitespace-nowrap">貸方科目</TableHead>
            <TableHead className="whitespace-nowrap">貸方補助</TableHead>
            <TableHead className="whitespace-nowrap">貸方部門</TableHead>
            <TableHead className="whitespace-nowrap text-right">
              貸方金額
            </TableHead>
            <TableHead className="whitespace-nowrap">摘要</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="hover:bg-muted/50">
              <TableCell className="whitespace-nowrap">
                {formatDate(r.transactionDate)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {r.voucherNo}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {r.identifierFlag}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {r.drAccountKind || "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {r.drSubAccount || ""}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {shortenCompanyName(r.drCompanyShortName, r.drCompanyName)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-mono tabular-nums text-blue-600">
                {fmtAmount(r.drAmount)}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {r.crAccountKind || "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {r.crSubAccount || ""}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {shortenCompanyName(r.crCompanyShortName, r.crCompanyName)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-mono tabular-nums text-red-600">
                {fmtAmount(r.crAmount)}
              </TableCell>
              <TableCell className="max-w-[280px] truncate text-sm">
                {r.summary || ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
