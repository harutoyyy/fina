"use client"

import { useState, useRef } from "react"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Upload, FileSpreadsheet } from "lucide-react"
import { formatYen, getCurrentMonth } from "@/lib/format"
import {
  importSalesTransactions,
  importCostTransactions,
  type SalesImportRow,
  type CostImportRow,
  type ImportResult,
} from "@/app/actions/transaction-import"

type Mode = "SALES" | "COST"

type AccountOption = {
  id: string
  bankName: string | null
  branchName: string | null
  accountNumber: string | null
}

export default function TransactionExcelImport({
  mode,
  companyId,
  accounts,
  onComplete,
}: {
  mode: Mode
  companyId: string
  accounts: AccountOption[]
  onComplete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState("")
  const [yearMonth, setYearMonth] = useState(getCurrentMonth())
  const [rows, setRows] = useState<(SalesImportRow | CostImportRow)[]>([])
  const [sourceName, setSourceName] = useState("")
  const [error, setError] = useState("")
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const expectedHeaders =
    mode === "SALES"
      ? ["予定入金日", "元請会社名", "請求金額"]
      : ["予定支払日", "支払先", "計上額"]

  const optionalHeaders =
    mode === "SALES" ? ["実入金日", "実入金金額", "摘要"] : ["実支払日", "振込額", "摘要"]

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError("")
    setRows([])
    setResult(null)
    setSourceName(file.name)

    try {
      const XLSX = await import("xlsx")
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array", cellDates: true })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false })

      if (json.length === 0) {
        setError("データが見つかりません")
        return
      }
      const headers = Object.keys(json[0])
      const missing = expectedHeaders.filter((h) => !headers.includes(h))
      if (missing.length > 0) {
        setError(`必要な列が不足しています: ${missing.join(", ")}`)
        return
      }

      const parsed = json.map((r) => {
        const parseDate = (v: unknown): string => {
          if (v instanceof Date) return v.toISOString().slice(0, 10)
          if (!v) return ""
          const d = new Date(String(v).replace(/\//g, "-"))
          return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10)
        }
        const parseAmount = (v: unknown): number => {
          const s = String(v ?? "0").replace(/[,¥\s]/g, "")
          return parseInt(s) || 0
        }

        if (mode === "SALES") {
          return {
            scheduledDate: parseDate(r["予定入金日"]),
            transactionDate: parseDate(r["実入金日"]) || undefined,
            partnerName: String(r["元請会社名"] || "").trim(),
            invoiceAmount: parseAmount(r["請求金額"]),
            actualAmount: r["実入金金額"] ? parseAmount(r["実入金金額"]) : undefined,
            summary: r["摘要"] ? String(r["摘要"]) : undefined,
          } as SalesImportRow
        }
        return {
          scheduledDate: parseDate(r["予定支払日"]),
          transactionDate: parseDate(r["実支払日"]) || undefined,
          partnerName: String(r["支払先"] || "").trim(),
          recordedAmount: parseAmount(r["計上額"]),
          transferAmount: r["振込額"] ? parseAmount(r["振込額"]) : undefined,
          summary: r["摘要"] ? String(r["摘要"]) : undefined,
        } as CostImportRow
      })

      setRows(parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : "ファイルの読み込みに失敗しました")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleImport = async () => {
    if (!accountId) {
      alert("口座を選択してください")
      return
    }
    setImporting(true)
    try {
      const res =
        mode === "SALES"
          ? await importSalesTransactions({
              companyId,
              accountId,
              yearMonth,
              sourceName,
              rows: rows as SalesImportRow[],
            })
          : await importCostTransactions({
              companyId,
              accountId,
              yearMonth,
              sourceName,
              rows: rows as CostImportRow[],
            })
      setResult(res)
      onComplete()
    } catch (e) {
      alert(e instanceof Error ? e.message : "インポートに失敗しました")
    } finally {
      setImporting(false)
    }
  }

  const handleClose = (o: boolean) => {
    setOpen(o)
    if (!o) {
      setRows([])
      setError("")
      setResult(null)
      setSourceName("")
    }
  }

  const title = mode === "SALES" ? "売上Excel取込" : "原価Excel取込"

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-1" />
        {title}
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm text-muted-foreground">
              必須列: <code className="bg-muted px-1 rounded">{expectedHeaders.join(" / ")}</code>
              <br />
              任意列: <code className="bg-muted px-1 rounded">{optionalHeaders.join(" / ")}</code>
              <br />
              取引先は既存マスタとの名前一致で紐付け、未登録の場合は自動作成します。
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{mode === "SALES" ? "入金口座 *" : "支払口座 *"}</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="口座を選択" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.bankName ?? ""} {a.branchName ?? ""} {a.accountNumber ?? ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>計上月</Label>
                <Input
                  type="month"
                  value={yearMonth}
                  onChange={(e) => setYearMonth(e.target.value)}
                />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              ファイルを選択
            </Button>
            {sourceName && (
              <div className="text-xs text-muted-foreground">選択中: {sourceName}</div>
            )}
            {error && (
              <div className="rounded border border-red-300 bg-red-50 text-red-800 p-2 text-sm">
                {error}
              </div>
            )}
            {rows.length > 0 && (
              <div className="max-h-72 overflow-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{mode === "SALES" ? "予定入金日" : "予定支払日"}</TableHead>
                      <TableHead>{mode === "SALES" ? "元請会社名" : "支払先"}</TableHead>
                      <TableHead className="text-right">
                        {mode === "SALES" ? "請求金額" : "計上額"}
                      </TableHead>
                      <TableHead className="text-right">
                        {mode === "SALES" ? "実入金" : "振込額"}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.scheduledDate}</TableCell>
                        <TableCell>{r.partnerName}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatYen(
                            BigInt(
                              mode === "SALES"
                                ? (r as SalesImportRow).invoiceAmount
                                : (r as CostImportRow).recordedAmount
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {mode === "SALES"
                            ? (r as SalesImportRow).actualAmount
                              ? formatYen(BigInt((r as SalesImportRow).actualAmount!))
                              : "—"
                            : (r as CostImportRow).transferAmount
                              ? formatYen(BigInt((r as CostImportRow).transferAmount!))
                              : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {result && (
              <div className="rounded border bg-muted/30 p-3 text-sm space-y-1">
                <div>取込件数: {result.total}</div>
                <div>新規登録: {result.created}</div>
                <div>スキップ: {result.skipped}</div>
                {result.errors.length > 0 && (
                  <div className="text-red-700">
                    エラー {result.errors.length}件:
                    <ul className="list-disc ml-5">
                      {result.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>閉じる</Button>
            <Button onClick={handleImport} disabled={importing || rows.length === 0 || !accountId}>
              {importing ? "取込中..." : `${rows.length}件を取り込む`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
