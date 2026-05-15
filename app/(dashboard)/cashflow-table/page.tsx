"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useCompany } from "@/contexts/company-context"
import { CompanySwitcher } from "@/components/company-switcher"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { getAccounts } from "@/app/actions/accounts"
import { Checkbox } from "@/components/ui/checkbox"
import {
  getCashFlowTable,
  getMonthCloseStatus,
  closeMonth,
  reopenMonth,
  deferTransaction,
  deferTransactionsBatch,
  reorderTransactions,
  type CashFlowTableData,
  type CashFlowRow,
  type CheckpointData,
} from "@/app/actions/cashflow-table"
import { createCheckpoint, updateCheckpoint, deleteCheckpoint } from "@/app/actions/reconciliation"
import { getCompanyInfoSummary } from "@/app/actions/companies"
import { generateCashFlowReport, type CashFlowReport } from "@/app/actions/cashflow-reports"
import { formatYen, formatDate, getCurrentMonth } from "@/lib/format"
import { Printer, GripVertical, ChevronUp, ChevronDown, CheckCircle2, AlertTriangle, Landmark, FileText, Building2, Link2 } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type AccountOption = {
  id: string
  bankName: string | null
  branchName: string | null
  accountNumber: string | null
  isActive: boolean
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "下書き",
  READY: "準備完了",
  CONFIRMED: "確定済",
  CANCELLED: "取消済",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  READY: "secondary",
  CONFIRMED: "default",
  CANCELLED: "destructive",
}

const TYPE_LABELS: Record<string, string> = {
  EXPENSE: "経費",
  SALES: "売上",
  COST_PAYMENT: "原価支払",
  SALARY: "給与",
  LOAN: "借入",
  TRANSFER: "振替",
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  FIXED: "固定",
  VARIABLE: "変動",
  TEMPORARY: "臨時",
}

const PAYMENT_LABELS: Record<string, string> = {
  BANK_TRANSFER: "振込",
  DIRECT_DEBIT: "引落",
  CASH_WITHDRAWAL: "現金",
}

const TYPE_TO_PAGE: Record<string, string> = {
  EXPENSE: "/expenses",
  SALES: "/sales",
  COST_PAYMENT: "/costs",
  SALARY: "/salary",
  LOAN: "/loans",
  TRANSFER: "/expenses",
}

function fmt(n: string | number | bigint): string {
  return `¥${Number(n).toLocaleString("ja-JP")}`
}

/**
 * PDF P1〜P2 帳票作成: 資金移動・振込・現金の3種別をHTMLで出力
 */
function buildReportHtml(r: CashFlowReport): string {
  const css = `<style>
    @page { size: A4; margin: 16mm 14mm; }
    body { font-family: "Hiragino Sans","Yu Gothic","Meiryo",sans-serif; font-size: 11pt; color: #111; }
    h1 { font-size: 18pt; margin: 0 0 4mm 0; text-align: center; letter-spacing: 0.1em; }
    .header { display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6mm; }
    .header .meta { font-size: 9pt; line-height: 1.5; text-align:right; }
    .acct { border:1px solid #333; padding: 3mm 4mm; margin-bottom: 4mm; font-size: 10pt; }
    .acct .lbl { color:#555; font-size:9pt; margin-right:4px; }
    .acct strong { font-size: 11pt; }
    table { width:100%; border-collapse: collapse; margin-bottom: 4mm; }
    th, td { border: 1px solid #333; padding: 2mm 3mm; vertical-align: top; }
    th { background: #f0f0f0; font-weight: 600; font-size: 9pt; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; font-family: monospace; }
    tfoot td { background: #fafafa; font-weight: 600; }
    .denomination { width: 100%; border-collapse: collapse; margin-top: 4mm; }
    .denomination th, .denomination td { border:1px solid #333; padding: 2mm; text-align:center; }
    .denomination th { background:#f0f0f0; font-size:9pt; }
    .denomination .total { background:#fafafa; font-weight:600; }
    .footnote { font-size: 9pt; color:#555; margin-top: 6mm; }
    @media print { button { display: none !important; } }
  </style>`

  const titleMap = {
    FUND_TRANSFER: "資金移動帳票",
    BANK_TRANSFER: "振込依頼書",
    CASH: "現金支払帳票",
  } as const
  const title = titleMap[r.type]

  const acctText = (a: { bankName: string | null; bankCode: string | null; branchName: string | null; branchCode: string | null; accountType: string | null; accountNumber: string | null; accountHolder: string | null }) => {
    const parts = [
      a.bankName ? `${a.bankName}${a.bankCode ? `(${a.bankCode})` : ""}` : "",
      a.branchName ? `${a.branchName}${a.branchCode ? `(${a.branchCode})` : ""}` : "",
      a.accountType ?? "",
      a.accountNumber ?? "",
      a.accountHolder ? `名義: ${a.accountHolder}` : "",
    ].filter(Boolean)
    return parts.join(" / ") || "—"
  }

  const headerHtml = `
    <div class="header">
      <h1>${title}</h1>
      <div class="meta">
        ${r.company.companyName}<br/>
        ${r.company.address ? r.company.address + "<br/>" : ""}
        ${r.company.phone ? "TEL " + r.company.phone + "<br/>" : ""}
        ${r.company.invoiceNumber ? "登録番号 " + r.company.invoiceNumber + "<br/>" : ""}
        作成日: ${new Date().toLocaleDateString("ja-JP")}
      </div>
    </div>
    <div class="acct">
      <span class="lbl">自社口座:</span><strong>${acctText(r.selfAccount)}</strong>
    </div>
  `

  if (r.type === "FUND_TRANSFER") {
    const dest = r.destinationAccount
    const destHtml = dest
      ? `<div class="acct"><span class="lbl">移動先口座:</span><strong>${acctText(dest)}</strong></div>`
      : ""
    const rowsHtml = r.rows
      .map(
        (row, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${row.date ?? ""}</td>
          <td>${row.partnerName}</td>
          <td>${row.summary}</td>
          <td class="num">${fmt(row.amount)}</td>
        </tr>`
      )
      .join("")
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${title}</title>${css}</head>
      <body>
        ${headerHtml}
        ${destHtml}
        <table>
          <thead><tr><th>#</th><th>日付</th><th>相手先</th><th>内容</th><th>金額</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot><tr><td colspan="4">合計</td><td class="num">${fmt(r.totalAmount)}</td></tr></tfoot>
        </table>
        <button onclick="window.print()" style="margin-top:6mm;padding:6px 12px;">印刷</button>
      </body></html>`
  }

  if (r.type === "BANK_TRANSFER") {
    const rowsHtml = r.rows
      .map((row, i) => {
        const bank = row.partnerBank
        const bankCell = bank
          ? `${bank.bankCode ?? ""}/${bank.branchCode ?? ""} ${bank.accountType ?? ""} ${bank.accountNumber ?? ""}<br/><small>${bank.accountHolder ?? ""}</small>`
          : "—"
        return `
          <tr>
            <td>${i + 1}</td>
            <td>${row.date ?? ""}</td>
            <td>${row.partnerName}</td>
            <td>${row.summary}</td>
            <td class="num">${fmt(row.amount)}</td>
            <td>${bankCell}</td>
          </tr>`
      })
      .join("")
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${title}</title>${css}</head>
      <body>
        ${headerHtml}
        <table>
          <thead><tr><th>#</th><th>日付</th><th>相手先</th><th>内容</th><th>金額</th><th>振込先口座</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr><td colspan="4">件数 ${r.rows.length}件 / 振込合計</td><td class="num">${fmt(r.totalAmount)}</td><td></td></tr>
            <tr><td colspan="4">自社負担 振込手数料合計</td><td class="num">${fmt(r.totalFeeAmount)}</td><td></td></tr>
          </tfoot>
        </table>
        <p class="footnote">※ 振込手数料は実際の振込時に銀行画面で確認してください。</p>
        <button onclick="window.print()" style="margin-top:6mm;padding:6px 12px;">印刷</button>
      </body></html>`
  }

  // CASH
  const rowsHtml = r.rows
    .map(
      (row, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${row.date ?? ""}</td>
        <td>${row.partnerName}</td>
        <td>${row.summary}</td>
        <td class="num">${fmt(row.amount)}</td>
      </tr>`
    )
    .join("")
  const denomHtml = r.denominations
    .map(
      (d) => `
      <tr>
        <td>${d.value.toLocaleString()}</td>
        <td contenteditable="true">&nbsp;</td>
      </tr>`
    )
    .join("")
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${title}</title>${css}</head>
    <body>
      ${headerHtml}
      <table>
        <thead><tr><th>#</th><th>日付</th><th>相手先</th><th>内容</th><th>金額</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td colspan="4">件数 ${r.rows.length}件 / 合計</td><td class="num">${fmt(r.totalAmount)}</td></tr></tfoot>
      </table>
      <h3 style="font-size:11pt;margin-top:6mm;">金種表（手書き用）</h3>
      <table class="denomination" style="max-width:60mm;">
        <thead><tr><th>金種</th><th>枚数</th></tr></thead>
        <tbody>${denomHtml}</tbody>
        <tfoot><tr class="total"><td>合計</td><td>${fmt(r.totalAmount)}</td></tr></tfoot>
      </table>
      <button onclick="window.print()" style="margin-top:6mm;padding:6px 12px;">印刷</button>
    </body></html>`
}

function getVariance(row: CashFlowRow): number | null {
  const est = row.estimatedAmount ? Number(row.estimatedAmount) : null
  const act = row.actualAmount ? Number(row.actualAmount) : null
  if (est !== null && act !== null) return act - est

  const rec = row.recordedAmount ? Number(row.recordedAmount) : null
  const trn = row.transferAmount ? Number(row.transferAmount) : null
  if (rec !== null && trn !== null) return trn - rec

  const inv = row.invoiceAmount ? Number(row.invoiceAmount) : null
  const amt = Number(row.amount)
  if (inv !== null) return amt - inv

  return null
}

function SortableRow({
  row,
  isClosed,
  selectedRows,
  toggleRowSelection,
  handleDeferSingle,
  deferLoading,
  onDoubleClick,
  onRowClick,
  isSelected,
  isBeingDraggedWithGroup,
  checkpoint,
  onSetCheckpoint,
}: {
  row: CashFlowRow
  isClosed: boolean
  selectedRows: Set<string>
  toggleRowSelection: (id: string) => void
  handleDeferSingle: (id: string) => void
  deferLoading: boolean
  onDoubleClick: (row: CashFlowRow) => void
  onRowClick: (row: CashFlowRow) => void
  isSelected: boolean
  isBeingDraggedWithGroup: boolean
  checkpoint: CheckpointData | null
  onSetCheckpoint: (row: CashFlowRow) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : isBeingDraggedWithGroup ? 0.5 : 1,
  }

  const deposit = Number(row.deposit)
  const withdrawal = Number(row.withdrawal)
  const detail = row.details[0]
  const categoryDisplay = detail
    ? [detail.midName, detail.subName].filter(Boolean).join(" / ")
    : "—"
  const canDefer = row.status !== "CONFIRMED"
  const variance = getVariance(row)

  // PDF P1: 未達は薄色表示
  const overdueClass = row.isOverdue ? "opacity-60 italic" : ""

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer ${overdueClass} ${isSelected ? "bg-muted/50" : ""} ${isBeingDraggedWithGroup ? "bg-blue-50 dark:bg-blue-950/30" : ""} ${row.isInterGroup ? "border-l-2 border-l-purple-400" : ""}`}
      onClick={() => onRowClick(row)}
      onDoubleClick={() => onDoubleClick(row)}
      title={row.isOverdue ? "未達: 予定日を過ぎていますが未確定です" : undefined}
    >
      <TableCell className="w-8 cursor-grab" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </TableCell>
      {!isClosed && (
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedRows.has(row.id)}
            onCheckedChange={() => toggleRowSelection(row.id)}
            disabled={!canDefer}
          />
        </TableCell>
      )}
      <TableCell className="whitespace-nowrap">
        {row.transactionDate ? formatDate(row.transactionDate) : "—"}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {row.scheduledDate ? formatDate(row.scheduledDate) : "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Badge variant="outline">
            {TYPE_LABELS[row.type] || row.type}
          </Badge>
          {row.isInterGroup && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1" title="グループ間取引">
              <Link2 className="h-3 w-3 mr-0.5" />G間
            </Badge>
          )}
          {row.isOverdue && (
            <Badge variant="outline" className="text-[10px] py-0 px-1 border-orange-400 text-orange-600">未達</Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {row.classification ? CLASSIFICATION_LABELS[row.classification] || row.classification : "—"}
      </TableCell>
      <TableCell>
        {row.partnerName
          ? (row.partnerId ? row.partnerName : <span className="text-orange-600">{row.partnerName}（仮）</span>)
          : "—"}
      </TableCell>
      <TableCell className="text-sm">{row.paymentMethod ? PAYMENT_LABELS[row.paymentMethod] || row.paymentMethod : "—"}</TableCell>
      <TableCell className="text-right font-mono text-green-600">
        {deposit > 0 ? formatYen(deposit) : ""}
      </TableCell>
      <TableCell className="text-right font-mono text-red-600">
        {withdrawal < 0 ? formatYen(Math.abs(withdrawal)) : ""}
      </TableCell>
      <TableCell className={`text-right font-mono font-medium ${checkpoint ? "border-b-2 border-green-500" : ""}`}>
        <div className="flex items-center justify-end gap-1">
          {checkpoint && (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
          )}
          {formatYen(Number(row.runningBalance))}
        </div>
        {checkpoint && Number(checkpoint.verifiedBalance) !== Number(row.runningBalance) && (
          <div className="flex items-center justify-end gap-1 text-xs text-orange-600 mt-0.5">
            <AlertTriangle className="h-3 w-3" />
            差額 {formatYen(Number(row.runningBalance) - Number(checkpoint.verifiedBalance))}
          </div>
        )}
      </TableCell>
      <TableCell className="max-w-[200px] truncate">{row.summary || "—"}</TableCell>
      <TableCell className="text-sm">{categoryDisplay}</TableCell>
      <TableCell className={`text-right font-mono ${variance !== null && variance !== 0 ? (variance > 0 ? "text-green-600" : "text-red-600") : ""}`}>
        {variance !== null ? formatYen(variance) : "—"}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANTS[row.status] || "outline"}>
          {STATUS_LABELS[row.status] || row.status}
        </Badge>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          {!isClosed && canDefer && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeferSingle(row.id)}
              disabled={deferLoading}
            >
              繰延
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSetCheckpoint(row)}
            title={checkpoint ? "照合点編集" : "照合点設定"}
          >
            <Landmark className={`h-4 w-4 ${checkpoint ? "text-green-600" : ""}`} />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function CashFlowTablePage() {
  const router = useRouter()
  const { selectedCompany } = useCompany()
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [tableData, setTableData] = useState<CashFlowTableData | null>(null)
  const [loading, setLoading] = useState(false)
  const [monthCloseStatus, setMonthCloseStatus] = useState<{ isClosed: boolean; closedAt: string | null } | null>(null)

  const [filterPartner, setFilterPartner] = useState("")
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [filterType, setFilterType] = useState("ALL")

  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const [reopenReason, setReopenReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [deferLoading, setDeferLoading] = useState(false)
  const [previewRow, setPreviewRow] = useState<CashFlowRow | null>(null)

  // 並べ替え時の日付設定ダイアログ
  const [reorderPending, setReorderPending] = useState<{
    reordered: CashFlowRow[]
    updates: { id: string; displayOrder: number }[]
    movedIds: string[]
    suggestedDay: string
  } | null>(null)
  const [reorderDay, setReorderDay] = useState("")
  const [reorderSaving, setReorderSaving] = useState(false)
  const [prevTableData, setPrevTableData] = useState<CashFlowTableData | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  // 照合点チェックポイント
  const [checkpointDialogRow, setCheckpointDialogRow] = useState<CashFlowRow | null>(null)
  const [checkpointBalance, setCheckpointBalance] = useState("")
  const [checkpointNote, setCheckpointNote] = useState("")
  const [checkpointSaving, setCheckpointSaving] = useState(false)

  // 会社情報一覧（PDF P1）
  type CompanyInfo = Awaited<ReturnType<typeof getCompanyInfoSummary>>
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(null)
  const [companyInfoOpen, setCompanyInfoOpen] = useState(false)

  // 帳票作成ダイアログ
  const [reportData, setReportData] = useState<CashFlowReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  const loadAccounts = useCallback(async (companyId: string) => {
    const accts = await getAccounts(companyId)
    const activeAccounts = accts.filter((a) => a.isActive).map((a) => ({
      id: a.id,
      bankName: a.bankName,
      branchName: a.branchName,
      accountNumber: a.accountNumber,
      isActive: a.isActive,
    }))
    setAccounts(activeAccounts)
    if (activeAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(activeAccounts[0].id)
    }
  }, [selectedAccountId])

  const loadTableData = useCallback(async (companyId: string, accountId: string, yearMonth: string) => {
    if (!accountId || !yearMonth) return
    setLoading(true)
    try {
      const [data, closeStatus] = await Promise.all([
        getCashFlowTable(companyId, accountId, yearMonth),
        getMonthCloseStatus(companyId, yearMonth),
      ])
      setTableData(data)
      setMonthCloseStatus(closeStatus as { isClosed: boolean; closedAt: string | null } | null)
    } catch (e) {
      console.error("Failed to load cash flow table:", e)
      setTableData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      loadAccounts(selectedCompany.id)
      getCompanyInfoSummary(selectedCompany.id).then(setCompanyInfo).catch(() => setCompanyInfo(null))
    }
  }, [selectedCompany, loadAccounts])

  useEffect(() => {
    if (selectedCompany && selectedAccountId && selectedMonth) {
      loadTableData(selectedCompany.id, selectedAccountId, selectedMonth)
    }
  }, [selectedCompany, selectedAccountId, selectedMonth, loadTableData])

  const filteredRows = useMemo(() => {
    if (!tableData) return []
    return tableData.rows.filter((row) => {
      if (filterPartner && row.partnerName && !row.partnerName.includes(filterPartner)) return false
      if (filterPartner && !row.partnerName) return false
      if (filterStatus !== "ALL" && row.status !== filterStatus) return false
      if (filterType !== "ALL" && row.type !== filterType) return false
      return true
    })
  }, [tableData, filterPartner, filterStatus, filterType])

  const handleCloseMonth = async () => {
    if (!selectedCompany || !selectedMonth) return
    if (!confirm("この月を締めますか？締め後は取引の編集ができなくなります。")) return
    setActionLoading(true)
    try {
      await closeMonth(selectedCompany.id, selectedMonth)
      await loadTableData(selectedCompany.id, selectedAccountId, selectedMonth)
    } catch (e) {
      console.error("Failed to close month:", e)
      alert("月締めに失敗しました")
    } finally {
      setActionLoading(false)
    }
  }

  const handleReopenMonth = async () => {
    if (!selectedCompany || !selectedMonth || !reopenReason.trim()) return
    setActionLoading(true)
    try {
      await reopenMonth(selectedCompany.id, selectedMonth, reopenReason)
      setReopenDialogOpen(false)
      setReopenReason("")
      await loadTableData(selectedCompany.id, selectedAccountId, selectedMonth)
    } catch (e) {
      console.error("Failed to reopen month:", e)
      alert("月締め解除に失敗しました")
    } finally {
      setActionLoading(false)
    }
  }

  const toggleRowSelection = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllRows = () => {
    const deferableRows = filteredRows.filter(r => r.status !== "CONFIRMED")
    if (selectedRows.size === deferableRows.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(deferableRows.map(r => r.id)))
    }
  }

  const handleDeferSelected = async () => {
    if (!selectedCompany || selectedRows.size === 0) return
    if (!confirm(`${selectedRows.size}件の取引を翌月へ繰り延べますか？`)) return
    setDeferLoading(true)
    try {
      await deferTransactionsBatch(Array.from(selectedRows), selectedCompany.id)
      setSelectedRows(new Set())
      await loadTableData(selectedCompany.id, selectedAccountId, selectedMonth)
    } catch (e) {
      console.error("Failed to defer:", e)
      alert("繰り延べに失敗しました")
    } finally {
      setDeferLoading(false)
    }
  }

  const handleDeferSingle = async (transactionId: string) => {
    if (!selectedCompany) return
    if (!confirm("この取引を翌月へ繰り延べますか？")) return
    setDeferLoading(true)
    try {
      await deferTransaction(transactionId, selectedCompany.id)
      await loadTableData(selectedCompany.id, selectedAccountId, selectedMonth)
    } catch (e) {
      console.error("Failed to defer:", e)
      alert(e instanceof Error ? e.message : "繰り延べに失敗しました")
    } finally {
      setDeferLoading(false)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const getSuggestedDay = (rows: CashFlowRow[], targetIndex: number): string => {
    // 移動先の直上の行の日付からDDを取得
    if (targetIndex > 0) {
      const above = rows[targetIndex - 1]
      const d = above.scheduledDate || above.transactionDate
      if (d) {
        const day = new Date(d).getDate()
        return String(day).padStart(2, "0")
      }
    }
    return "01"
  }

  const applyOptimisticReorder = (reordered: CashFlowRow[]) => {
    if (!tableData) return
    setPrevTableData(tableData)
    const openBal = Number(tableData.openingBalance)
    let running = openBal
    const updatedRows = reordered.map((r) => {
      const amt = Number(r.amount)
      running += amt
      return { ...r, runningBalance: running.toString() }
    })
    setTableData((prev) =>
      prev ? { ...prev, rows: updatedRows } : prev
    )
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || !selectedCompany || !tableData) return

    const draggedId = active.id as string
    // ドラッグした行がチェック済みなら、チェック済み行を全てまとめて移動
    const movedIds = selectedRows.has(draggedId)
      ? new Set(selectedRows)
      : new Set([draggedId])

    const rows = [...filteredRows]
    const overIndex = rows.findIndex((r) => r.id === over.id)
    if (overIndex === -1) return

    // ドロップ先が移動対象自身で、かつ1行だけなら何もしない
    if (active.id === over.id && movedIds.size <= 1) return

    // 移動対象の行と残りの行を分離
    const moved: CashFlowRow[] = []
    const rest: CashFlowRow[] = []
    rows.forEach((r) => {
      if (movedIds.has(r.id)) moved.push(r)
      else rest.push(r)
    })

    if (rest.length === 0) return // 全行が選択されている場合は移動不要

    // ドロップ先の行を基準に挿入位置を決定
    const overRow = rows[overIndex]
    const restIndex = rest.indexOf(overRow)

    let insertPos: number
    if (restIndex !== -1) {
      // ドロップ先が非移動行 → その行の前か後に挿入
      const draggedOrigIndex = rows.findIndex((r) => r.id === draggedId)
      insertPos = draggedOrigIndex < overIndex ? restIndex + 1 : restIndex
    } else {
      // ドロップ先も移動行 → 元のoverIndex前後の非移動行を基準にする
      insertPos = rest.length
      for (let i = overIndex + 1; i < rows.length; i++) {
        const idx = rest.indexOf(rows[i])
        if (idx !== -1) { insertPos = idx; break }
      }
    }

    const reordered = [
      ...rest.slice(0, insertPos),
      ...moved,
      ...rest.slice(insertPos),
    ]

    // 元の順序と変わっていなければ何もしない
    const isSame = reordered.every((r, i) => r.id === filteredRows[i]?.id)
    if (isSame) return

    const updates = reordered.map((r, i) => ({ id: r.id, displayOrder: i }))
    const blockStart = reordered.findIndex((r) => movedIds.has(r.id))
    const suggested = getSuggestedDay(reordered, blockStart)
    setReorderDay(suggested)
    setReorderPending({
      reordered,
      updates,
      movedIds: Array.from(movedIds),
      suggestedDay: suggested,
    })

    applyOptimisticReorder(reordered)
  }

  const handleConfirmReorder = async () => {
    if (!reorderPending || !selectedCompany) return
    setReorderSaving(true)
    try {
      const fullDate = `${selectedMonth}-${reorderDay.padStart(2, "0")}`
      const dateUpdates = reorderPending.movedIds.map((id) => ({
        transactionId: id,
        scheduledDate: fullDate,
      }))
      await reorderTransactions(
        reorderPending.updates,
        selectedCompany.id,
        selectedAccountId,
        selectedMonth,
        dateUpdates
      )
      await loadTableData(selectedCompany.id, selectedAccountId, selectedMonth)
    } catch (e) {
      console.error("Failed to reorder:", e)
      if (prevTableData) setTableData(prevTableData)
    } finally {
      setReorderPending(null)
      setReorderDay("")
      setReorderSaving(false)
      setPrevTableData(null)
    }
  }

  const handleCancelReorder = () => {
    if (prevTableData) setTableData(prevTableData)
    setReorderPending(null)
    setReorderDay("")
    setPrevTableData(null)
  }

  // 照合点: 行の日付からチェックポイントをマッチ
  const getCheckpointForRow = useCallback((row: CashFlowRow): CheckpointData | null => {
    if (!tableData?.checkpoints) return null
    const rowDate = row.scheduledDate || row.transactionDate
    if (!rowDate) return null
    const rowDateStr = new Date(rowDate).toISOString().split("T")[0]
    return tableData.checkpoints.find((cp) => {
      const cpDateStr = new Date(cp.checkpointDate).toISOString().split("T")[0]
      return cpDateStr === rowDateStr
    }) ?? null
  }, [tableData?.checkpoints])

  const handleOpenCheckpointDialog = (row: CashFlowRow) => {
    const existing = getCheckpointForRow(row)
    setCheckpointDialogRow(row)
    setCheckpointBalance(existing ? existing.verifiedBalance : row.runningBalance)
    setCheckpointNote(existing?.note || "")
  }

  const handleSaveCheckpoint = async () => {
    if (!checkpointDialogRow || !selectedCompany || !selectedAccountId) return
    setCheckpointSaving(true)
    try {
      const existing = getCheckpointForRow(checkpointDialogRow)
      const rowDate = checkpointDialogRow.scheduledDate || checkpointDialogRow.transactionDate
      if (!rowDate) return

      if (existing) {
        await updateCheckpoint(existing.id, selectedCompany.id, {
          verifiedBalance: checkpointBalance,
          note: checkpointNote || null,
        })
      } else {
        await createCheckpoint({
          companyId: selectedCompany.id,
          accountId: selectedAccountId,
          checkpointDate: new Date(rowDate).toISOString().split("T")[0],
          yearMonth: selectedMonth,
          verifiedBalance: checkpointBalance,
          note: checkpointNote || undefined,
        })
      }
      setCheckpointDialogRow(null)
      await loadTableData(selectedCompany.id, selectedAccountId, selectedMonth)
    } catch (e) {
      console.error("Failed to save checkpoint:", e)
      alert(e instanceof Error ? e.message : "照合点の保存に失敗しました")
    } finally {
      setCheckpointSaving(false)
    }
  }

  const handleDeleteCheckpoint = async () => {
    if (!checkpointDialogRow || !selectedCompany) return
    const existing = getCheckpointForRow(checkpointDialogRow)
    if (!existing) return
    if (!confirm("この照合点を削除しますか？")) return
    setCheckpointSaving(true)
    try {
      await deleteCheckpoint(existing.id, selectedCompany.id)
      setCheckpointDialogRow(null)
      await loadTableData(selectedCompany.id, selectedAccountId, selectedMonth)
    } catch (e) {
      console.error("Failed to delete checkpoint:", e)
      alert(e instanceof Error ? e.message : "照合点の削除に失敗しました")
    } finally {
      setCheckpointSaving(false)
    }
  }

  const handleRowDoubleClick = (row: CashFlowRow) => {
    const page = TYPE_TO_PAGE[row.type]
    if (page) {
      router.push(`${page}?edit=${row.id}`)
    }
  }

  // PDF P1: 帳票作成（連続選択した同一種別の取引から生成）
  const handleGenerateReport = async () => {
    if (!selectedCompany || selectedRows.size === 0) return
    setReportLoading(true)
    try {
      const data = await generateCashFlowReport(selectedCompany.id, Array.from(selectedRows))
      setReportData(data)
    } catch (e) {
      alert(e instanceof Error ? e.message : "帳票作成に失敗しました")
    } finally {
      setReportLoading(false)
    }
  }

  const printReport = () => {
    if (!reportData) return
    const win = window.open("", "_blank", "width=900,height=700")
    if (!win) {
      alert("ポップアップがブロックされました。許可してください。")
      return
    }
    win.document.open()
    win.document.write(buildReportHtml(reportData))
    win.document.close()
  }

  const handleMoveSelected = (direction: "up" | "down") => {
    if (!tableData || !selectedCompany || selectedRows.size === 0) return

    const rows = [...filteredRows]
    // 選択行と非選択行を分離
    const selected: CashFlowRow[] = []
    const rest: CashFlowRow[] = []
    let firstSelectedIndex = -1

    rows.forEach((r, i) => {
      if (selectedRows.has(r.id)) {
        selected.push(r)
        if (firstSelectedIndex === -1) firstSelectedIndex = i
      } else {
        rest.push(r)
      }
    })

    if (selected.length === 0) return

    // 非選択行のみのリスト内で、選択ブロックの挿入位置を計算
    // 現在の挿入位置 = firstSelectedIndex の前にある非選択行の数
    let currentInsertPos = 0
    for (let i = 0; i < firstSelectedIndex; i++) {
      if (!selectedRows.has(rows[i].id)) currentInsertPos++
    }

    let newInsertPos: number
    if (direction === "up") {
      newInsertPos = Math.max(0, currentInsertPos - 1)
    } else {
      newInsertPos = Math.min(rest.length, currentInsertPos + 1)
    }

    if (newInsertPos === currentInsertPos) return

    // 非選択行リストに選択行ブロックを挿入
    const reordered = [
      ...rest.slice(0, newInsertPos),
      ...selected,
      ...rest.slice(newInsertPos),
    ]

    const updates = reordered.map((r, i) => ({ id: r.id, displayOrder: i }))
    const blockStartIndex = newInsertPos
    const suggested = getSuggestedDay(reordered, blockStartIndex)
    setReorderDay(suggested)
    setReorderPending({
      reordered,
      updates,
      movedIds: Array.from(selectedRows),
      suggestedDay: suggested,
    })

    applyOptimisticReorder(reordered)
  }

  const isClosed = monthCloseStatus?.isClosed === true

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">資金繰り表</h1>
          <CompanySwitcher />
        </div>
        <p className="text-muted-foreground">会社を選択してください</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">資金繰り表</h1>
          <p className="text-muted-foreground">{selectedCompany.name} の資金繰り表</p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySwitcher />
          {!isClosed && selectedRows.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMoveSelected("up")}
              >
                <ChevronUp className="h-4 w-4 mr-1" />
                上へ
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMoveSelected("down")}
              >
                <ChevronDown className="h-4 w-4 mr-1" />
                下へ
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateReport}
                disabled={reportLoading}
                title="選択行から帳票を作成（同一種別のみ）"
              >
                <FileText className="h-4 w-4 mr-1" />
                {reportLoading ? "生成中..." : "帳票作成"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDeferSelected}
                disabled={deferLoading}
              >
                {deferLoading ? "処理中..." : `${selectedRows.size}件を翌月へ繰り延べ`}
              </Button>
            </>
          )}
          {isClosed ? (
            <Button
              variant="outline"
              onClick={() => setReopenDialogOpen(true)}
              disabled={actionLoading}
            >
              月締め解除
            </Button>
          ) : (
            <Button
              onClick={handleCloseMonth}
              disabled={actionLoading || !selectedMonth}
            >
              {actionLoading ? "処理中..." : "月締め"}
            </Button>
          )}
          {isClosed && (
            <Badge variant="default">締め済み</Badge>
          )}
          <Button variant="outline" size="icon" onClick={() => window.print()} title="印刷">
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">表示条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>口座</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="口座を選択" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {[a.bankName, a.branchName, a.accountNumber].filter(Boolean).join(" ") || a.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>月</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-44"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {tableData && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">期首残高</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatYen(Number(tableData.openingBalance))}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">当月入金合計</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatYen(Number(tableData.totalDeposit))}</p>
              {Number(tableData.interGroupDeposit) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  内 グループ間 <span className="font-mono text-purple-600">{formatYen(Number(tableData.interGroupDeposit))}</span>
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">当月支払合計</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatYen(Math.abs(Number(tableData.totalWithdrawal)))}</p>
              {Number(tableData.interGroupWithdrawal) < 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  内 グループ間 <span className="font-mono text-purple-600">{formatYen(Math.abs(Number(tableData.interGroupWithdrawal)))}</span>
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">予測残高（月末）</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatYen(Number(tableData.closingBalance))}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setCompanyInfoOpen(true)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                会社情報
              </CardTitle>
            </CardHeader>
            <CardContent>
              {companyInfo ? (
                <div className="text-xs space-y-0.5">
                  <p className="truncate"><span className="text-muted-foreground">法人番号:</span> {companyInfo.corporateNumber || "—"}</p>
                  <p className="truncate"><span className="text-muted-foreground">設立:</span> {companyInfo.establishedDate ? formatDate(companyInfo.establishedDate) : "—"}</p>
                  <p className="truncate"><span className="text-muted-foreground">資本金:</span> {companyInfo.capitalAmount ? formatYen(Number(companyInfo.capitalAmount)) : "—"}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">読み込み中...</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">クリックで詳細</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">フィルター</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>取引先</Label>
              <Input
                placeholder="取引先名で絞り込み"
                value={filterPartner}
                onChange={(e) => setFilterPartner(e.target.value)}
                className="w-48"
              />
            </div>
            <div className="space-y-1">
              <Label>ステータス</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  <SelectItem value="DRAFT">下書き</SelectItem>
                  <SelectItem value="READY">準備完了</SelectItem>
                  <SelectItem value="CONFIRMED">確定済</SelectItem>
                  <SelectItem value="CANCELLED">取消済</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>取引種別</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  <SelectItem value="EXPENSE">経費</SelectItem>
                  <SelectItem value="SALES">売上</SelectItem>
                  <SelectItem value="COST_PAYMENT">原価支払</SelectItem>
                  <SelectItem value="SALARY">給与</SelectItem>
                  <SelectItem value="LOAN">借入</SelectItem>
                  <SelectItem value="TRANSFER">振替</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">取引一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">読み込み中...</p>
          ) : !tableData || filteredRows.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">取引データがありません</p>
          ) : (
            <div className="overflow-x-auto">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      {!isClosed && (
                        <TableHead className="w-8">
                          <Checkbox
                            checked={selectedRows.size > 0 && selectedRows.size === filteredRows.filter(r => r.status !== "CONFIRMED").length}
                            onCheckedChange={() => toggleAllRows()}
                          />
                        </TableHead>
                      )}
                      <TableHead className="whitespace-nowrap">実出納日</TableHead>
                      <TableHead className="whitespace-nowrap">予定日</TableHead>
                      <TableHead className="whitespace-nowrap">取引種別</TableHead>
                      <TableHead className="whitespace-nowrap">固定/変動</TableHead>
                      <TableHead className="whitespace-nowrap">取引先</TableHead>
                      <TableHead className="whitespace-nowrap">支払方法</TableHead>
                      <TableHead className="text-right whitespace-nowrap">入金額</TableHead>
                      <TableHead className="text-right whitespace-nowrap">支払額</TableHead>
                      <TableHead className="text-right whitespace-nowrap">差引残高</TableHead>
                      <TableHead className="whitespace-nowrap">摘要</TableHead>
                      <TableHead className="whitespace-nowrap">中項目/小項目</TableHead>
                      <TableHead className="text-right whitespace-nowrap">差額</TableHead>
                      <TableHead className="whitespace-nowrap">ステータス</TableHead>
                      <TableHead className="whitespace-nowrap">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <SortableContext items={filteredRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                    <TableBody>
                      {filteredRows.map((row) => (
                        <SortableRow
                          key={row.id}
                          row={row}
                          isClosed={isClosed}
                          selectedRows={selectedRows}
                          toggleRowSelection={toggleRowSelection}
                          handleDeferSingle={handleDeferSingle}
                          deferLoading={deferLoading}
                          onDoubleClick={handleRowDoubleClick}
                          onRowClick={setPreviewRow}
                          isSelected={previewRow?.id === row.id}
                          isBeingDraggedWithGroup={
                            activeDragId !== null &&
                            activeDragId !== row.id &&
                            selectedRows.has(activeDragId) &&
                            selectedRows.has(row.id)
                          }
                          checkpoint={getCheckpointForRow(row)}
                          onSetCheckpoint={handleOpenCheckpointDialog}
                        />
                      ))}
                    </TableBody>
                  </SortableContext>
                </Table>
                <DragOverlay>
                  {activeDragId && selectedRows.has(activeDragId) && selectedRows.size > 1 ? (
                    <div className="bg-background border rounded-md shadow-lg p-3 text-sm font-medium">
                      {selectedRows.size}件の取引を移動中...
                    </div>
                  ) : activeDragId ? (
                    <div className="bg-background border rounded-md shadow-lg p-3 text-sm font-medium">
                      {filteredRows.find((r) => r.id === activeDragId)?.partnerName || "取引"} を移動中...
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>月締め解除</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {selectedMonth} の月締めを解除します。解除理由を入力してください。
            </p>
            <div className="space-y-2">
              <Label>解除理由 *</Label>
              <Input
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="解除理由を入力してください"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReopenDialogOpen(false); setReopenReason("") }}>
              キャンセル
            </Button>
            <Button
              onClick={handleReopenMonth}
              disabled={actionLoading || !reopenReason.trim()}
            >
              {actionLoading ? "処理中..." : "解除する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reorderPending !== null} onOpenChange={(open) => { if (!open) handleCancelReorder() }}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>並べ替え — 予定日の設定</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {reorderPending?.movedIds.length === 1
                ? "移動した取引の予定日（日付）を設定してください。"
                : `${reorderPending?.movedIds.length}件の取引の予定日（日付）を設定してください。`}
            </p>
            <div className="space-y-2">
              <Label>{selectedMonth} の</Label>
              <div className="flex items-center gap-2">
                <Select value={reorderDay} onValueChange={setReorderDay}>
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="日" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: new Date(Number(selectedMonth.split("-")[0]), Number(selectedMonth.split("-")[1]), 0).getDate() }, (_, i) => {
                      const d = String(i + 1).padStart(2, "0")
                      return <SelectItem key={d} value={d}>{d}日</SelectItem>
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelReorder} disabled={reorderSaving}>
              キャンセル
            </Button>
            <Button
              onClick={handleConfirmReorder}
              disabled={reorderSaving || !reorderDay}
            >
              {reorderSaving ? "保存中..." : "確定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 照合点設定ダイアログ */}
      <Dialog open={checkpointDialogRow !== null} onOpenChange={(open) => { if (!open) setCheckpointDialogRow(null) }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {checkpointDialogRow && getCheckpointForRow(checkpointDialogRow) ? "照合点編集" : "照合点設定"}
            </DialogTitle>
          </DialogHeader>
          {checkpointDialogRow && (
            <div className="space-y-4 py-2">
              <div className="text-sm text-muted-foreground">
                日付: {checkpointDialogRow.scheduledDate ? formatDate(checkpointDialogRow.scheduledDate) : checkpointDialogRow.transactionDate ? formatDate(checkpointDialogRow.transactionDate) : "—"}
                <br />
                現在の差引残高: <span className="font-mono font-medium">{formatYen(Number(checkpointDialogRow.runningBalance))}</span>
              </div>
              <div className="space-y-2">
                <Label>通帳確認残高</Label>
                <Input
                  type="number"
                  value={checkpointBalance}
                  onChange={(e) => setCheckpointBalance(e.target.value)}
                  placeholder="通帳の残高を入力"
                />
              </div>
              <div className="space-y-2">
                <Label>メモ</Label>
                <Input
                  value={checkpointNote}
                  onChange={(e) => setCheckpointNote(e.target.value)}
                  placeholder="照合メモ（任意）"
                />
              </div>
              {checkpointBalance && Number(checkpointBalance) !== Number(checkpointDialogRow.runningBalance) && (
                <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-950/30 p-2 rounded">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  残高不一致: 差額 {formatYen(Number(checkpointDialogRow.runningBalance) - Number(checkpointBalance))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {checkpointDialogRow && getCheckpointForRow(checkpointDialogRow) && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteCheckpoint}
                disabled={checkpointSaving}
                className="mr-auto"
              >
                削除
              </Button>
            )}
            <Button variant="outline" onClick={() => setCheckpointDialogRow(null)} disabled={checkpointSaving}>
              キャンセル
            </Button>
            <Button onClick={handleSaveCheckpoint} disabled={checkpointSaving || !checkpointBalance}>
              {checkpointSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 会社情報詳細ダイアログ (PDF P1 ピンク枠) */}
      <Dialog open={companyInfoOpen} onOpenChange={setCompanyInfoOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />会社情報一覧</DialogTitle>
          </DialogHeader>
          {companyInfo ? (
            <div className="space-y-2 py-2 text-sm">
              <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                <div className="text-muted-foreground">会社名</div>
                <div className="col-span-2 font-medium">{companyInfo.name}{companyInfo.shortName ? `（${companyInfo.shortName}）` : ""}</div>
                <div className="text-muted-foreground">業種</div>
                <div className="col-span-2">{companyInfo.industryName || "—"}</div>
                <div className="text-muted-foreground">代表者</div>
                <div className="col-span-2">{[companyInfo.representativeTitle, companyInfo.representativeName].filter(Boolean).join(" ") || "—"}</div>
                <div className="text-muted-foreground">決算月</div>
                <div className="col-span-2">{companyInfo.fiscalMonth}月</div>
                <div className="text-muted-foreground">設立年月日</div>
                <div className="col-span-2">{companyInfo.establishedDate ? formatDate(companyInfo.establishedDate) : "—"}</div>
                <div className="text-muted-foreground">資本金</div>
                <div className="col-span-2 font-mono">{companyInfo.capitalAmount ? formatYen(Number(companyInfo.capitalAmount)) : "—"}</div>
                <div className="text-muted-foreground">法人番号</div>
                <div className="col-span-2 font-mono">{companyInfo.corporateNumber || "—"}</div>
                <div className="text-muted-foreground">インボイス番号</div>
                <div className="col-span-2 font-mono">{companyInfo.invoiceNumber || "—"}</div>
                <div className="text-muted-foreground">e-Tax番号</div>
                <div className="col-span-2 font-mono">{companyInfo.eTaxNumber || "—"}</div>
                <div className="text-muted-foreground">経理担当</div>
                <div className="col-span-2">{companyInfo.accountingManager || "—"}</div>
              </div>
              <p className="text-xs text-muted-foreground border-t pt-2 mt-3">
                編集はマスタ → 会社一覧 から
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-4">会社情報を取得できませんでした</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyInfoOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 帳票作成プレビュー (PDF P1〜P2) */}
      <Dialog open={reportData !== null} onOpenChange={(open) => { if (!open) setReportData(null) }}>
        <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {reportData?.type === "FUND_TRANSFER" && "資金移動帳票"}
              {reportData?.type === "BANK_TRANSFER" && "振込依頼書"}
              {reportData?.type === "CASH" && "現金支払帳票（金種表付）"}
            </DialogTitle>
          </DialogHeader>
          {reportData && (
            <div className="space-y-3 py-2 text-sm">
              <div className="border rounded p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">自社口座</p>
                <p className="font-mono">
                  {[reportData.selfAccount.bankName, reportData.selfAccount.branchName, reportData.selfAccount.accountType, reportData.selfAccount.accountNumber].filter(Boolean).join(" / ")}
                </p>
              </div>
              {reportData.type === "FUND_TRANSFER" && reportData.destinationAccount && (
                <div className="border rounded p-3 bg-purple-50 dark:bg-purple-950/30">
                  <p className="text-xs text-muted-foreground mb-1">移動先口座</p>
                  <p className="font-mono">
                    {[reportData.destinationAccount.bankName, reportData.destinationAccount.branchName, reportData.destinationAccount.accountType, reportData.destinationAccount.accountNumber].filter(Boolean).join(" / ")}
                  </p>
                </div>
              )}
              <div className="border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">日付</th>
                      <th className="p-2 text-left">相手先</th>
                      <th className="p-2 text-left">内容</th>
                      <th className="p-2 text-right">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.map((r, i) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2">{r.date ?? ""}</td>
                        <td className="p-2">{r.partnerName}</td>
                        <td className="p-2 truncate max-w-[180px]">{r.summary}</td>
                        <td className="p-2 text-right font-mono">{formatYen(Number(r.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted font-medium">
                    <tr>
                      <td className="p-2" colSpan={4}>件数 {reportData.rows.length}件 / 合計</td>
                      <td className="p-2 text-right font-mono">{formatYen(Number(reportData.totalAmount))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {reportData.type === "CASH" && (
                <p className="text-xs text-muted-foreground">
                  印刷後に金種表（10000/5000/1000/500/100/50/10/5/1円）に手書きで枚数を記入できます。
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportData(null)}>閉じる</Button>
            <Button onClick={printReport}>
              <Printer className="h-4 w-4 mr-1" />
              印刷
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewRow && (
        <Dialog open={true} onOpenChange={() => setPreviewRow(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>取引プレビュー</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">取引種別</div>
                <div>{TYPE_LABELS[previewRow.type] || previewRow.type}</div>
                <div className="text-muted-foreground">取引先</div>
                <div>{previewRow.partnerName || "—"}</div>
                <div className="text-muted-foreground">実出納日</div>
                <div>{previewRow.transactionDate ? formatDate(previewRow.transactionDate) : "—"}</div>
                <div className="text-muted-foreground">予定日</div>
                <div>{previewRow.scheduledDate ? formatDate(previewRow.scheduledDate) : "—"}</div>
                <div className="text-muted-foreground">金額</div>
                <div className="font-mono">{formatYen(Math.abs(Number(previewRow.amount)))}</div>
                {previewRow.estimatedAmount && (
                  <>
                    <div className="text-muted-foreground">予定金額</div>
                    <div className="font-mono">{formatYen(Math.abs(Number(previewRow.estimatedAmount)))}</div>
                  </>
                )}
                {previewRow.actualAmount && (
                  <>
                    <div className="text-muted-foreground">実績金額</div>
                    <div className="font-mono">{formatYen(Math.abs(Number(previewRow.actualAmount)))}</div>
                  </>
                )}
                {(() => {
                  const v = getVariance(previewRow)
                  if (v === null) return null
                  return (
                    <>
                      <div className="text-muted-foreground">差額</div>
                      <div className={`font-mono font-medium ${v > 0 ? "text-green-600" : v < 0 ? "text-red-600" : ""}`}>
                        {formatYen(v)}
                      </div>
                    </>
                  )
                })()}
                <div className="text-muted-foreground">ステータス</div>
                <div><Badge variant={STATUS_VARIANTS[previewRow.status] || "outline"}>{STATUS_LABELS[previewRow.status] || previewRow.status}</Badge></div>
                <div className="text-muted-foreground">摘要</div>
                <div>{previewRow.summary || "—"}</div>
              </div>
              {previewRow.details.length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <p className="font-medium mb-2">内訳</p>
                  <div className="space-y-1">
                    {previewRow.details.map((d) => (
                      <div key={d.id} className="flex justify-between text-sm">
                        <span>{[d.midName, d.subName].filter(Boolean).join(" / ") || "—"}{d.summary ? ` (${d.summary})` : ""}</span>
                        <span className="font-mono">{formatYen(Math.abs(Number(d.amount)))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewRow(null)}>
                閉じる
              </Button>
              <Button onClick={() => { handleRowDoubleClick(previewRow); setPreviewRow(null) }}>
                編集画面へ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
