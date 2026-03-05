"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { importSalaryEntries, type SalaryImportRow, type SalaryImportResult } from "@/app/actions/salary-import"
import { Upload, Loader2, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react"
import { formatYen } from "@/lib/format"

const EXPECTED_HEADERS = [
  "給与グループ", "支給月", "支給日", "人数",
  "課税支給額", "通勤手当", "諸経費", "繰越調整", "立替経費",
]

export default function SalaryExcelImport({
  companyId,
  onComplete,
}: {
  companyId: string
  onComplete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [parsedRows, setParsedRows] = useState<SalaryImportRow[]>([])
  const [parseError, setParseError] = useState("")
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<SalaryImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError("")
    setParsedRows([])
    setResult(null)

    try {
      const XLSX = (await import("xlsx")).default
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false })

      if (jsonData.length === 0) {
        setParseError("データが見つかりません")
        return
      }

      const headers = Object.keys(jsonData[0])
      const missing = EXPECTED_HEADERS.filter((h) => !headers.includes(h))
      if (missing.length > 0) {
        setParseError(`必要な列が不足しています: ${missing.join(", ")}`)
        return
      }

      const rows: SalaryImportRow[] = jsonData.map((row) => ({
        payrollGroupName: String(row["給与グループ"] || ""),
        payMonth: String(row["支給月"] || ""),
        payDate: String(row["支給日"] || ""),
        headcount: parseInt(String(row["人数"] || "0")) || 0,
        taxablePayment: parseInt(String(row["課税支給額"] || "0").replace(/,/g, "")) || 0,
        transportAllowance: parseInt(String(row["通勤手当"] || "0").replace(/,/g, "")) || 0,
        miscExpenses: parseInt(String(row["諸経費"] || "0").replace(/,/g, "")) || 0,
        carryoverAdjust: parseInt(String(row["繰越調整"] || "0").replace(/,/g, "")) || 0,
        advanceExpenses: parseInt(String(row["立替経費"] || "0").replace(/,/g, "")) || 0,
      }))

      setParsedRows(rows)
      setOpen(true)
    } catch {
      setParseError("ファイルの読み込みに失敗しました")
    }

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleImport = async () => {
    setImporting(true)
    const res = await importSalaryEntries(companyId, parsedRows)
    setResult(res)
    setImporting(false)
    if (res.errors.length === 0) {
      setTimeout(() => {
        setOpen(false)
        setParsedRows([])
        setResult(null)
        onComplete()
      }, 1500)
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Excelインポート
      </Button>
      {parseError && (
        <span className="text-sm text-destructive ml-2">{parseError}</span>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setParsedRows([]); setResult(null) } }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>給与データ インポート確認</DialogTitle>
          </DialogHeader>

          {result ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                {result.errors.length === 0 ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="font-medium">
                  {result.total}件中 新規{result.created}件 / 更新{result.updated}件 / エラー{result.errors.length}件
                </span>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-destructive/10 p-3 rounded space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-sm text-destructive">{err}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {parsedRows.length}件のデータを読み込みました。内容を確認してインポートしてください。
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>給与グループ</TableHead>
                      <TableHead>支給月</TableHead>
                      <TableHead>支給日</TableHead>
                      <TableHead className="text-right">人数</TableHead>
                      <TableHead className="text-right">課税支給額</TableHead>
                      <TableHead className="text-right">通勤手当</TableHead>
                      <TableHead className="text-right">合計</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, i) => {
                      const total = row.taxablePayment + row.transportAllowance +
                        row.miscExpenses + row.carryoverAdjust + row.advanceExpenses
                      return (
                        <TableRow key={i}>
                          <TableCell>{row.payrollGroupName}</TableCell>
                          <TableCell>{row.payMonth}</TableCell>
                          <TableCell>{row.payDate}</TableCell>
                          <TableCell className="text-right">{row.headcount}</TableCell>
                          <TableCell className="text-right font-mono">{formatYen(row.taxablePayment)}</TableCell>
                          <TableCell className="text-right font-mono">{formatYen(row.transportAllowance)}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatYen(total)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setParsedRows([]); setResult(null) }}>
              {result ? "閉じる" : "キャンセル"}
            </Button>
            {!result && (
              <Button onClick={handleImport} disabled={importing || parsedRows.length === 0}>
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    インポート中...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    インポート実行
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
